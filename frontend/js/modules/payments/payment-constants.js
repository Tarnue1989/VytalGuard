// 📦 payment-constants.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors deposit-constants.js / appointment-constants.js for consistency
// 🔹 Keeps all original field IDs intact for HTML + JS compatibility
// 🔹 Supports dynamic table rendering, tooltips, exports, and role visibility
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
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
   👥 ROLE-BASED FIELD DEFAULTS
============================================================ */
export const FIELD_DEFAULTS_PAYMENT = {
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
    "reason",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Optional Extension)
============================================================ */
export const FIELD_GROUPS_PAYMENT = {
  org_scope: ["organization", "facility"],
  financials: ["amount", "method", "transaction_ref", "is_deposit"],
  patient_info: ["patient", "invoice"],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  notes: ["reason"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ EXPORT (for external import)
============================================================ */
export default {
  FIELD_LABELS_PAYMENT,
  FIELD_ORDER_PAYMENT,
  FIELD_DEFAULTS_PAYMENT,
  FIELD_GROUPS_PAYMENT,
};
