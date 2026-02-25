// 📦 payment-constants.js – Enterprise MASTER–ALIGNED (Deposit Parity)
// ============================================================================
// 🔹 Pattern Source: deposit-constants.js / consultation-constants.js
// 🔹 Structural Consistency: labels, order, RBAC visibility, metadata
// 🔹 100% ID retention (safe for existing HTML + JS modules)
// 🔹 Supports dynamic tables, cards, field selector, exports, summaries
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (Enterprise Standard)
============================================================ */
export const FIELD_LABELS_PAYMENT = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  invoice: "Invoice",
  amount: "Amount",
  method: "Method",
  transaction_ref: "Transaction Ref",
  is_deposit: "Deposit?",
  reason: "Reason",
  status: "Status",
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",
  actions: "Actions",
};

/* ============================================================
   📋 FIELD ORDER (Enterprise-Consistent)
============================================================ */
export const FIELD_ORDER_PAYMENT = [
  "organization",
  "facility",
  "patient",
  "invoice",
  "amount",
  "method",
  "transaction_ref",
  "is_deposit",
  "reason",
  "status",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

/* ============================================================
   👥 ROLE-BASED FIELD DEFAULTS (MASTER RBAC)
============================================================ */
export const FIELD_DEFAULTS_PAYMENT = {
  superadmin: [
    "organization",
    "facility",
    "patient",
    "invoice",
    "amount",
    "method",
    "transaction_ref",
    "is_deposit",
    "reason",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "actions",
  ],

  admin: [
    "organization",
    "facility",
    "patient",
    "invoice",
    "amount",
    "method",
    "transaction_ref",
    "is_deposit",
    "reason",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "actions",
  ],

  manager: [
    "facility",
    "patient",
    "invoice",
    "amount",
    "method",
    "transaction_ref",
    "is_deposit",
    "reason",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  staff: [
    "facility",
    "patient",
    "invoice",
    "amount",
    "method",
    "transaction_ref",
    "is_deposit",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Enterprise Optional Extension)
============================================================ */
export const FIELD_GROUPS_PAYMENT = {
  org_scope: ["organization", "facility"],
  patient_info: ["patient", "invoice"],
  financials: ["amount", "method", "transaction_ref", "is_deposit"],
  notes: ["reason"],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ MODULE METADATA (Enterprise UI Context)
============================================================ */
export const MODULE_KEY_PAYMENT = "payments";
export const MODULE_LABEL_PAYMENT = "Payment";

/* ============================================================
   📦 EXPORT (Unified)
============================================================ */
export default {
  FIELD_LABELS_PAYMENT,
  FIELD_ORDER_PAYMENT,
  FIELD_DEFAULTS_PAYMENT,
  FIELD_GROUPS_PAYMENT,
  MODULE_KEY_PAYMENT,
  MODULE_LABEL_PAYMENT,
};
