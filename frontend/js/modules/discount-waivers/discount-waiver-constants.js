// 📦 discount-waiver-constants.js – Enterprise MASTER–ALIGNED (Deposit Parity FINAL)
// ============================================================================
// 🔹 Fully aligned with DiscountWaiver model + controller
// 🔹 Currency included (multi-currency safe)
// 🔹 applied_total matches backend
// 🔹 Clean RBAC + UI-safe fields
// 🔹 100% Enterprise + MASTER parity
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (Enterprise Standard)
============================================================ */
export const FIELD_LABELS_DISCOUNT_WAIVER = {
  organization: "Organization",
  facility: "Facility",

  invoice: "Invoice",
  currency: "Currency",
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
  "currency",
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
    "currency",
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
    "currency",
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
    "currency",
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
    "currency",
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