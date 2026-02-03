// 📦 discount-waiver-constants.js – Enterprise MASTER–ALIGNED (Deposit Parity)
// ============================================================================
// 🔹 Pattern Source: deposit-constants.js / discount-constants.js
// 🔹 Structural Consistency: labels, order, RBAC visibility, metadata
// 🔹 100% ID retention (safe for existing HTML + JS modules)
// 🔹 Supports dynamic tables, cards, field selector, exports, summaries
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (Enterprise Standard)
============================================================ */
export const FIELD_LABELS_DISCOUNT_WAIVER = {
  organization: "Organization",
  facility: "Facility",

  invoice: "Invoice",
  patient: "Patient",

  type: "Waiver Type",
  reason: "Reason",
  percentage: "Percentage",
  amount: "Amount",
  applied_total: "Applied Total",

  status: "Status",

  approvedBy: "Approved By",
  rejectedBy: "Rejected By",
  voidedBy: "Voided By",

  approved_at: "Approved At",
  rejected_at: "Rejected At",
  voided_at: "Voided At",

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
export const FIELD_ORDER_DISCOUNT_WAIVER = [
  "organization",
  "facility",
  "invoice",
  "patient",

  "type",
  "reason",
  "percentage",
  "amount",
  "applied_total",
  "status",

  "approvedBy",
  "approved_at",
  "rejectedBy",
  "rejected_at",
  "voidedBy",
  "voided_at",

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
export const FIELD_DEFAULTS_DISCOUNT_WAIVER = {
  superadmin: [
    "organization",
    "facility",
    "invoice",
    "patient",
    "type",
    "reason",
    "percentage",
    "amount",
    "applied_total",
    "status",
    "approvedBy",
    "approved_at",
    "rejectedBy",
    "rejected_at",
    "voidedBy",
    "voided_at",
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
    "invoice",
    "patient",
    "type",
    "reason",
    "percentage",
    "amount",
    "applied_total",
    "status",
    "approvedBy",
    "approved_at",
    "rejectedBy",
    "rejected_at",
    "voidedBy",
    "voided_at",
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
    "invoice",
    "patient",
    "type",
    "reason",
    "percentage",
    "amount",
    "applied_total",
    "status",
    "approvedBy",
    "approved_at",
    "rejectedBy",
    "rejected_at",
    "voidedBy",
    "voided_at",
    "actions",
  ],

  staff: [
    "invoice",
    "patient",
    "type",
    "reason",
    "percentage",
    "amount",
    "applied_total",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Enterprise Optional Extension)
============================================================ */
export const FIELD_GROUPS_DISCOUNT_WAIVER = {
  org_scope: ["organization", "facility"],
  waiver_info: [
    "invoice",
    "patient",
    "type",
    "reason",
    "percentage",
    "amount",
    "applied_total",
    "status",
  ],
  approval_flow: [
    "approvedBy",
    "approved_at",
    "rejectedBy",
    "rejected_at",
    "voidedBy",
    "voided_at",
  ],
  audit_trail: [
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
  ],
  system: ["actions"],
};

/* ============================================================
   ⚙️ MODULE METADATA (Enterprise UI Context)
============================================================ */
export const MODULE_KEY_DISCOUNT_WAIVER = "discountWaiver";
export const MODULE_LABEL_DISCOUNT_WAIVER = "Discount Waiver";

/* ============================================================
   📦 EXPORT (Unified)
============================================================ */
export default {
  FIELD_LABELS_DISCOUNT_WAIVER,
  FIELD_ORDER_DISCOUNT_WAIVER,
  FIELD_DEFAULTS_DISCOUNT_WAIVER,
  FIELD_GROUPS_DISCOUNT_WAIVER,
  MODULE_KEY_DISCOUNT_WAIVER,
  MODULE_LABEL_DISCOUNT_WAIVER,
};
