// 📦 deposit-constants.js – Enterprise MASTER–ALIGNED (Consultation Parity)
// ============================================================================
// 🔹 Pattern Source: consultation-constants.js / appointment-constants.js
// 🔹 Structural Consistency: labels, order, RBAC visibility, metadata
// 🔹 100% ID retention (safe for existing HTML + JS modules)
// 🔹 Supports dynamic tables, cards, field selector, exports, summaries
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (Enterprise Standard)
============================================================ */
export const FIELD_LABELS_DEPOSIT = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  appliedInvoice: "Applied Invoice",
  amount: "Amount",
  applied_amount: "Applied Amount",
  remaining_balance: "Remaining Balance",
  method: "Method",
  transaction_ref: "Transaction Ref",
  notes: "Notes",
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
   👥 ROLE-BASED FIELD DEFAULTS (MASTER RBAC)
============================================================ */
// 🧩 Admin: full financial + audit visibility
// 🧩 Manager: operational + financial, scoped
// 🧩 Staff: essential operational fields only
export const FIELD_DEFAULTS_DEPOSIT = {
  superadmin: [
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
   🧠 FIELD GROUPS (Enterprise Optional Extension)
============================================================ */
export const FIELD_GROUPS_DEPOSIT = {
  org_scope: ["organization", "facility"],
  patient_info: ["patient", "appliedInvoice"],
  financials: [
    "amount",
    "applied_amount",
    "remaining_balance",
    "method",
    "transaction_ref",
  ],
  notes: ["notes", "reason"],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ MODULE METADATA (Enterprise UI Context)
============================================================ */
export const MODULE_KEY_DEPOSIT = "deposits";
export const MODULE_LABEL_DEPOSIT = "Deposit";

/* ============================================================
   📦 EXPORT (Unified)
============================================================ */
export default {
  FIELD_LABELS_DEPOSIT,
  FIELD_ORDER_DEPOSIT,
  FIELD_DEFAULTS_DEPOSIT,
  FIELD_GROUPS_DEPOSIT,
  MODULE_KEY_DEPOSIT,
  MODULE_LABEL_DEPOSIT,
};
