// src/controllers/donationController.js

import Donation from "../models/Donation.js";

/**
 * Get donation history for the logged-in user (with pagination and filters).
 */
export const getDonationHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const filter = { userId };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [donations, total] = await Promise.all([
      Donation.find(filter)
        .populate("cowId", "name photos")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Donation.countDocuments(filter),
    ]);

    return res.json({
      data: donations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getDonationHistory error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Get only cow donations for user
export const getCowDonations = async (req, res) => {
  try {
    const userId = req.user.id;

    const donations = await Donation.find({ userId, type: "cow" })
      .populate("cowId", "name photos")
      .sort({ createdAt: -1 });

    return res.json({ data: donations });
  } catch (error) {
    console.error("getCowDonations error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Get only ashram donations for user
export const getAshramDonations = async (req, res) => {
  try {
    const userId = req.user.id;

    const donations = await Donation.find({ userId, type: "ashram" }).sort({
      createdAt: -1,
    });

    return res.json({ data: donations });
  } catch (error) {
    console.error("getAshramDonations error:", error);
    return res.status(500).json({ error: error.message });
  }
};
