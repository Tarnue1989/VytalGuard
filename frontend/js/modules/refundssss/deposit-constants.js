// 📦 deposit-constants.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors appointment-constants.js / consultation-constants.js for consistency
// 🔹 Keeps all original field IDs intact for HTML + JS compatibility
// 🔹 Supports dynamic table rendering, tooltips, exports, and role visibility
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
============================================================ */
export const FIELD_LABELS_DEPOSIT = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  appliedInvoice: "Applied Invoice", // 🔗 Linked Invoice
  amount: "Amount",
  applied_amount: "Applied Amount",
  remaining_balance: "Remaining Balance",
  method: "Method",
  transaction_ref: "Transaction Ref",
  notes: "Notes",
  reason: "Reason", // only for updates / reversals
  status: "Status",
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
export const FIELD_ORDER_DEPOSIT = [
  "organization",
  "facility",
  "patient",
  "appliedInvoice",
  "amount",
  "applied_amount",
  "remaining_balance",
  "method",
  "transaction_ref",
  "notes",
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
   👥 ROLE-BASED FIELD DEFAULTS
   Matches enterprise master RBAC visibility (admin → manager → staff)
============================================================ */
export const FIELD_DEFAULTS_DEPOSIT = {
  // 🧑‍💼 Super Admin / Admin: full visibility
  admin: [
    "organization",
    "facility",
    "patient",
    "appliedInvoice",
    "amount",
    "applied_amount",
    "remaining_balance",
    "method",
    "transaction_ref",
    "notes",
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

  // 👔 Manager: scoped visibility (no organization)
  manager: [
    "facility",
    "patient",
    "appliedInvoice",
    "amount",
    "applied_amount",
    "remaining_balance",
    "method",
    "transaction_ref",
    "notes",
    "reason",
    "status",
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
    "appliedInvoice",
    "amount",
    "applied_amount",
    "remaining_balance",
    "method",
    "transaction_ref",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Optional Extension)
   Enables dynamic section toggling & report grouping
============================================================ */
export const FIELD_GROUPS_DEPOSIT = {
  org_scope: ["organization", "facility"],
  financials: [
    "amount",
    "applied_amount",
    "remaining_balance",
    "method",
    "transaction_ref",
  ],
  patient_info: ["patient", "appliedInvoice"],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  notes: ["notes", "reason"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ EXPORT (for external import)
============================================================ */
export default {
  FIELD_LABELS_DEPOSIT,
  FIELD_ORDER_DEPOSIT,
  FIELD_DEFAULTS_DEPOSIT,
  FIELD_GROUPS_DEPOSIT,
};
