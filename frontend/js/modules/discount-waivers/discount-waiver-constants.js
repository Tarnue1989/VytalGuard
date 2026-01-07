// 📦 discount-waiver-constants.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors discount-constants.js / deposit-constants.js for unified structure
// 🔹 Keeps all original field IDs intact for HTML + JS compatibility
// 🔹 Supports dynamic table rendering, exports, and role-based visibility
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
============================================================ */
export const FIELD_LABELS_DISCOUNT_WAIVER = {
  organization: "Organization",
  facility: "Facility",

  invoice: "Invoice",
  patient: "Patient",

  type: "Waiver Type", // percentage | fixed
  reason: "Reason",
  percentage: "Percentage",
  amount: "Amount",
  applied_total: "Applied Total",

  status: "Status", // pending | approved | rejected | voided | reversed

  // 🛡️ Audit / actors
  approvedBy: "Approved By",
  rejectedBy: "Rejected By",
  voidedBy: "Voided By",

  // 🕑 Key timestamps
  approved_at: "Approved At",
  rejected_at: "Rejected At",
  voided_at: "Voided At",

  // 🕑 Standard timestamps
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",

  actions: "Actions",
};

/* ============================================================
   🧩 FIELD ORDER
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
   👥 ROLE-BASED FIELD DEFAULTS
   Matches enterprise master RBAC visibility (admin → manager → staff)
============================================================ */
export const FIELD_DEFAULTS_DISCOUNT_WAIVER = {
  // 🧑‍💼 Admin: full visibility
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

  // 👔 Manager: scoped (no organization/delete fields)
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

  // 👷 Staff: minimal operational view
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
   🧠 FIELD GROUPS (Optional Extension)
   Enables dynamic section toggling & report grouping
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
   ⚙️ EXPORT (for external import)
============================================================ */
export default {
  FIELD_LABELS_DISCOUNT_WAIVER,
  FIELD_ORDER_DISCOUNT_WAIVER,
  FIELD_DEFAULTS_DISCOUNT_WAIVER,
  FIELD_GROUPS_DISCOUNT_WAIVER,
};
