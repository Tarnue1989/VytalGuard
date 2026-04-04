// 📘 enumResolver.js – Unified Enum + Status Group Mapper

import * as ENUMS from "../constants/enums.js";

const ENUM_MAP = {
  registration: ENUMS.REGISTRATION_LOG_STATUS,
  consultation: ENUMS.CONSULTATION_STATUS,
  triage: ENUMS.TRIAGE_STATUS,
  vital: ENUMS.VITAL_STATUS,
  admission: ENUMS.ADMISSION_STATUS,
  delivery: ENUMS.DELIVERY_STATUS,
  ultrasound: ENUMS.ULTRASOUND_STATUS,
  ekg: ENUMS.EKG_STATUS,
  appointment: ENUMS.APPOINTMENT_STATUS,
  lab_request: ENUMS.LAB_REQUEST_STATUS,
  lab_request_item: ENUMS.LAB_REQUEST_ITEM_STATUS,
  prescription: ENUMS.PRESCRIPTION_STATUS,
  prescription_item: ENUMS.PRESCRIPTION_ITEM_STATUS,
  billable_item: ENUMS.BILLABLE_ITEM_STATUS,
  invoice: ENUMS.INVOICE_STATUS,
  deposit: ENUMS.DEPOSIT_STATUS,
  payment: ENUMS.PAYMENT_STATUS,
  refund: ENUMS.REFUND_STATUS,
  refund_transaction: ENUMS.REFUND_TRANSACTION_STATUS,
  discount: ENUMS.DISCOUNT_STATUS,
  discount_waiver: ENUMS.DISCOUNT_WAIVER_STATUS,
};

/* ============================================================
   🔹 ENUM VALIDATOR / NORMALIZER
============================================================ */
export const resolveEnumLabel = (type, val) => {
  const map = ENUM_MAP[type];
  if (!map) return val || "—";

  const v = (val || "").toLowerCase();

  const values = Object.values(map);

  return values.includes(v) ? v : null; // safer than ⚠️ string
};

/* ============================================================
   🔹 STATUS GROUPING (CROSS-MODULE)
============================================================ */
export const resolveStatusGroup = (val) => {
  const s = (val || "").toLowerCase();

  if (["draft", "pending", "open", "scheduled"].includes(s)) return "open";

  if (["in_progress", "active", "issued"].includes(s))
    return "in_progress";

  if (["completed", "verified", "finalized", "paid", "applied"].includes(s))
    return "closed";

  if (["cancelled", "rejected", "no_show"].includes(s))
    return "cancelled";

  if (["voided", "expired", "reversed"].includes(s))
    return "voided";

  return "other";
};