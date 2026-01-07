// 📦 refund-constants.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors deposit-constants.js / appointment-constants.js for consistency
// 🔹 Keeps all original field IDs intact for HTML + JS compatibility
// 🔹 Supports dynamic table rendering, tooltips, exports, and role visibility
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
============================================================ */
export const FIELD_LABELS_REFUND = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  invoice: "Invoice",
  payment: "Payment", // 🔗 Parent Payment
  method: "Method",   // 💳 Payment Method
  amount: "Amount",
  reason: "Reason",
  status: "Status",

  // 🔹 Lifecycle audit
  approvedBy: "Approved By",
  approved_at: "Approved At",
  rejectedBy: "Rejected By",
  rejected_at: "Rejected At",
  processedBy: "Processed By",
  processed_at: "Processed At",
  cancelledBy: "Cancelled By",
  cancelled_at: "Cancelled At",

  // 🔹 Generic audit
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  actions: "Actions",
};

/* ============================================================
   🧩 FIELD ORDER
============================================================ */
export const FIELD_ORDER_REFUND = [
  "organization",
  "facility",
  "patient",
  "invoice",
  "payment",
  "method",  // 💳 Added between payment and amount
  "amount",
  "reason",
  "status",

  // 🔹 Lifecycle audit order
  "approvedBy",
  "approved_at",
  "rejectedBy",
  "rejected_at",
  "processedBy",
  "processed_at",
  "cancelledBy",
  "cancelled_at",

  // 🔹 Generic audit
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
export const FIELD_DEFAULTS_REFUND = {
  // 🧑‍💼 Super Admin / Admin: full visibility
  admin: [
    "organization",
    "facility",
    "patient",
    "invoice",
    "payment",
    "method",
    "amount",
    "reason",
    "status",
    "approvedBy",
    "approved_at",
    "rejectedBy",
    "rejected_at",
    "processedBy",
    "processed_at",
    "cancelledBy",
    "cancelled_at",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "actions",
  ],

  // 👔 Manager: scoped visibility (no organization)
  manager: [
    "facility",
    "patient",
    "invoice",
    "payment",
    "method",
    "amount",
    "reason",
    "status",
    "approvedBy",
    "approved_at",
    "processedBy",
    "processed_at",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  // 👷 Staff / General Employee: restricted operational view
  staff: [
    "facility",
    "patient",
    "invoice",
    "payment",
    "method",
    "amount",
    "reason",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Optional Extension)
   Enables dynamic section toggling & report grouping
============================================================ */
export const FIELD_GROUPS_REFUND = {
  org_scope: ["organization", "facility"],
  financials: ["payment", "method", "amount", "invoice"],
  patient_info: ["patient"],
  lifecycle: [
    "approvedBy",
    "approved_at",
    "rejectedBy",
    "rejected_at",
    "processedBy",
    "processed_at",
    "cancelledBy",
    "cancelled_at",
  ],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  notes: ["reason"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ EXPORT (for external import)
============================================================ */
export default {
  FIELD_LABELS_REFUND,
  FIELD_ORDER_REFUND,
  FIELD_DEFAULTS_REFUND,
  FIELD_GROUPS_REFUND,
};
