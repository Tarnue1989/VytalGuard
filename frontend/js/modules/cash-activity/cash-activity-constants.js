// 📦 cash-activity-constants.js – Enterprise MASTER–ALIGNED (Ledger)
// ============================================================================
// 🔹 Pattern Source: payment-constants.js
// 🔹 READ-ONLY module (no actions)
// 🔹 Designed for Cash Ledger (Activity View)
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
============================================================ */
export const FIELD_LABELS_CASH_ACTIVITY = {
  date: "Date",
  type: "Type",
  direction: "Direction",
  account: "Account",
  amount: "Amount",
  currency: "Currency",
  reference_type: "Reference Type",
  description: "Description",
  createdBy: "Created By",
  created_at: "Created At",
};

/* ============================================================
   📋 FIELD ORDER
============================================================ */
export const FIELD_ORDER_CASH_ACTIVITY = [
  "date",
  "type",
  "direction",
  "account",
  "amount",
  "currency",
  "reference_type",
  "description",
  "createdBy",
  "created_at",
];

/* ============================================================
   👥 ROLE DEFAULTS (ALL SAME — READ ONLY)
============================================================ */
export const FIELD_DEFAULTS_CASH_ACTIVITY = {
  superadmin: FIELD_ORDER_CASH_ACTIVITY,
  admin: FIELD_ORDER_CASH_ACTIVITY,
  manager: FIELD_ORDER_CASH_ACTIVITY,
  staff: FIELD_ORDER_CASH_ACTIVITY,
};

/* ============================================================
   🧩 FIELD GROUPS (🔥 REQUIRED FOR SELECTOR)
============================================================ */
export const FIELD_GROUPS_CASH_ACTIVITY = {
  core: ["date", "type", "direction"],
  financials: ["account", "amount", "currency"],
  reference: ["reference_type", "description"],
  audit: ["createdBy", "created_at"],
};

/* ============================================================
   ⚙️ MODULE META
============================================================ */
export const MODULE_KEY_CASH_ACTIVITY = "cash_ledger";
export const MODULE_LABEL_CASH_ACTIVITY = "Cash Activity";

/* ============================================================
   📦 EXPORT
============================================================ */
export default {
  FIELD_LABELS_CASH_ACTIVITY,
  FIELD_ORDER_CASH_ACTIVITY,
  FIELD_DEFAULTS_CASH_ACTIVITY,
  FIELD_GROUPS_CASH_ACTIVITY,
  MODULE_KEY_CASH_ACTIVITY,
  MODULE_LABEL_CASH_ACTIVITY,
};