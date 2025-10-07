import mongoose from "mongoose";

import Cow from "../models/Cow.js";

/**
 * Get a specific cow by either numeric cowId OR Mongo _id (string).
 */
export const getCowByParam = async (req, res) => {
  try {
    const { id } = req.params;

    // numeric cowId path
    if (/^\d+$/.test(id)) {
      const cowId = Number(id);
      const cow = await Cow.findOne(
        { cowId },
        {
          name: 1,
          photos: 1,
          description: 1,
          calf: 1,
          gender: 1,
          adoptionStatus: 1,
          specialCare: 1,
          cowId: 1,
          totalDonated: 1,
          donators: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      );
      if (!cow) return res.status(404).json({ error: "Cow not found" });
      return res.json({ data: cow });
    }

    // fallback to ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      const cow = await Cow.findById(id, {
        name: 1,
        photos: 1,
        description: 1,
        calf: 1,
        gender: 1,
        adoptionStatus: 1,
        specialCare: 1,
        cowId: 1,
        totalDonated: 1,
        donators: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      if (!cow) return res.status(404).json({ error: "Cow not found" });
      return res.json({ data: cow });
    }

    return res.status(404).json({ error: "Cow not found" });
  } catch (error) {
    console.error("getCowByParam error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Get Cows with search, filtering, sorting, and pagination.
 */
export const getCows = async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = "name", ...filters } = req.query;
    const query = {};

    // util: parse sort string into mongoose sort object
    const parseSort = (s) => {
      if (!s || typeof s !== "string") return { name: 1 };
      const parts = s
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const out = {};
      for (const p of parts) {
        if (p.startsWith("-")) {
          out[p.slice(1)] = -1;
        } else if (p.includes(":")) {
          const [field, dir] = p.split(":");
          out[field] = dir === "desc" ? -1 : 1;
        } else {
          out[p] = 1;
        }
      }
      return out;
    };

    const aliasMap = { adopted: "adoptionStatus" };
    const booleanKeys = new Set(["adoptionStatus", "calf", "specialCare"]);
    const numericKeys = new Set(["cowId", "age", "weight"]);
    const rangeFields = {
      ageMin: "age",
      ageMax: "age",
      weightMin: "weight",
      weightMax: "weight",
      dobFrom: "dateOfBirth",
      dobTo: "dateOfBirth",
    };

    // build query
    for (const key in filters) {
      const raw = filters[key];
      if (
        raw === undefined ||
        raw === null ||
        (typeof raw === "string" && raw.trim() === "")
      ) {
        continue;
      }
      const dbKey = aliasMap[key] || key;

      if (rangeFields[key]) {
        const field = rangeFields[key];
        query[field] = query[field] || {};
        if (key.endsWith("Min") || key.endsWith("From")) {
          query[field]["$gte"] = isNaN(raw) ? raw : Number(raw);
        } else if (key.endsWith("Max") || key.endsWith("To")) {
          query[field]["$lte"] = isNaN(raw) ? raw : Number(raw);
        }
        continue;
      }

      if (dbKey === "name") {
        query[dbKey] = { $regex: raw, $options: "i" };
        continue;
      }

      if (dbKey === "gender") {
        if (String(raw).toLowerCase() === "all") continue;
        query[dbKey] = {
          $regex: `^${escapeRegex(String(raw))}$`,
          $options: "i",
        };
        continue;
      }

      if (
        booleanKeys.has(dbKey) &&
        (raw === "true" || raw === "false" || typeof raw === "boolean")
      ) {
        query[dbKey] = raw === true || raw === "true";
        continue;
      }

      if (numericKeys.has(dbKey) && !isNaN(raw)) {
        query[dbKey] = Number(raw);
        continue;
      }

      query[dbKey] = raw;
    }

    // UX guards
    if (query.calf === true && query.gender) {
      delete query.gender;
    }

    const clientSetAdoption =
      "adopted" in req.query || "adoptionStatus" in req.query;
    const nameProvided =
      typeof req.query.name === "string" && req.query.name.trim() !== "";
    const genderProvided =
      typeof req.query.gender === "string" &&
      req.query.gender.trim().toLowerCase() !== "all";
    const calfProvided = "calf" in req.query;
    const specialCareProvided = "specialCare" in req.query;

    const anyUserFilter =
      nameProvided || genderProvided || calfProvided || specialCareProvided;

    if (!clientSetAdoption && !anyUserFilter) {
      query.adoptionStatus = false;
    }

    // --- Sort logic ---
    const baseSort = parseSort(sort);
    const hasAdoptionInSort = Object.prototype.hasOwnProperty.call(
      baseSort,
      "adoptionStatus",
    );
    const hasGenderInSort = Object.prototype.hasOwnProperty.call(
      baseSort,
      "gender",
    );

    let effectiveSort = { ...baseSort };

    // Always enforce unadopted first when any filter is applied
    if (anyUserFilter && !hasAdoptionInSort) {
      effectiveSort = { adoptionStatus: 1, ...effectiveSort };
    }

    // If gender not filtered, order by gender as secondary
    if (!genderProvided && !hasGenderInSort) {
      effectiveSort = { gender: 1, ...effectiveSort };
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("getCows query:", {
        incoming: req.query,
        mongoQuery: query,
        sort: effectiveSort,
        page,
        limit,
      });
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const cows = await Cow.find(query)
      .collation({ locale: "en", strength: 2 })
      .sort(effectiveSort)
      .skip(skip)
      .limit(limitNum);

    const total = await Cow.countDocuments(query); // filtered total
    const grandTotal = await Cow.estimatedDocumentCount(); // all cows

    return res.json({
      data: cows,
      meta: {
        total, // after filters
        grandTotal, // full herd
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("getCows error:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getCowById = async (req, res) => {
  try {
    const cowId = Number(req.params.id);
    const cow = await Cow.findOne({ cowId });
    if (!cow) return res.status(404).json({ error: "Cow not found" });
    return res.json({ data: cow });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
