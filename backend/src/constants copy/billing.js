// 📁 backend/src/constants/billing.js
import { logger } from "../utils/logger.js";

// ✅ Centralized Billing Trigger Conditions (Enterprise Grade)

export const AUTO_BILLABLE_MODULES = [
  "registration-log",
  "consultation",
  "admission",
  "delivery-record",
  "maternity-visit",
  "lab-request",
  "surgery",
  "ultrasound-record",
  "ekg-record",
  "medication",
  "recommendation",
  "analysis",
  "pharmacy-transaction", // ✅ Added
];

export const BILLING_TRIGGER_CONDITIONS = {
  "registration-log": ["active", "completed"],
  consultation: ["completed", "verified"],
  admission: ["admitted", "discharged"],
  "delivery-record": ["completed"],
  "maternity-visit": ["completed"],
  "lab-request": ["pending", "completed", "verified"],
  surgery: ["completed"],
  "ultrasound-record": ["completed"],
  "ekg-record": ["completed"],
  medication: ["dispensed", "fulfilled"],
  recommendation: ["confirmed"],
  analysis: ["completed"],
  "pharmacy-transaction": ["dispensed"], // ✅ Added
};

// 🔄 Normalize module/status safely
function normalize(value) {
  return (value || "").trim().toLowerCase();
}

// ✅ Check if billing should trigger for given module + status
export function shouldTriggerBilling(module, status) {
  const m = normalize(module);
  const s = normalize(status);
  const validStatuses = BILLING_TRIGGER_CONDITIONS[m] || [];

  const should = validStatuses.includes(s);

  logger.info(
    `[billing:shouldTriggerBilling] module=${m}, status=${s}, validStatuses=[${validStatuses.join(", ")}], result=${should}`
  );

  return should;
}

// ✅ Check if module is auto-billable at all
export function isAutoBillable(module) {
  const m = normalize(module);
  const result = AUTO_BILLABLE_MODULES.includes(m);

  logger.info(`[billing:isAutoBillable] module=${m}, result=${result}`);

  return result;
}
