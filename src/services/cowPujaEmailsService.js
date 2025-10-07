// src/services/cowPujaEmailService.js
import { sendMailResend } from "../utils/sendMailResend.js";

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtIST = (d) => {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
};

const buildTemplateData = (order) => ({
  customerName: order?.customer?.name || "Devotee",
  orderId: order?.orderId || "",
  amountINR: fmtINR(order?.amount),
  currency: order?.currency || "INR",
  preferredDate: order?.pujaDetails?.preferredDate
    ? fmtIST(order.pujaDetails.preferredDate)
    : null,
  gotra: order?.pujaDetails?.gotra || "-",
  sankalpam: order?.pujaDetails?.sankalpam || "-",
  namesToInclude: order?.pujaDetails?.namesToInclude || "-",
  additionalNotes: order?.pujaDetails?.additionalNotes || "-",
  createdAt: order?.createdAt ? fmtIST(order.createdAt) : null,
});

/**
 * Payment received email (called from webhook after payment.captured).
 */
export async function emailPujaPaymentReceived(to, order) {
  return sendMailResend({
    to,
    subject: "Cow Puja – Payment received",
    templateName: "cow-puja-payment-received",
    templateData: buildTemplateData(order),
  });
}
