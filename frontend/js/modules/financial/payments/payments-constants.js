// 📦 payment-constants.js – Enterprise Master Pattern Aligned (Full Upgrade)
// ============================================================================
// 🔹 Fully upgraded to match enterprise structure (Deposit / Appointment parity)
// 🔹 Retains all working logic, IDs, and classNames
// 🔹 Adds missing enterprise features: role visibility, field groups, export, etc.
// 🔹 Ensures superadmin → admin → manager → staff visibility consistency
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
  superadmin: FIELD_ORDER_PAYMENT,
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
   🧠 FIELD GROUPS (for summary + table organization)
============================================================ */
export const FIELD_GROUPS_PAYMENT = {
  org_scope: ["organization", "facility"],
  financials: ["amount", "method", "transaction_ref", "is_deposit"],
  patient_info: ["patient", "invoice"],
  notes: ["reason"],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   🧩 MODULE FEATURES (for UI renderers)
============================================================ */
// 🔸 Enables summary rendering, export buttons, pagination, and filter scoping
export const MODULE_FEATURES_PAYMENT = {
  enableSummary: true,
  enableExport: true,
  enablePagination: true,
  enableOrgFacilityFilter: true,
  enableRoleVisibility: true,
};

/* ============================================================
   ⚙️ EXPORT (for unified import)
============================================================ */
export default {
  FIELD_LABELS_PAYMENT,
  FIELD_ORDER_PAYMENT,
  FIELD_DEFAULTS_PAYMENT,
  FIELD_GROUPS_PAYMENT,
  MODULE_FEATURES_PAYMENT,
};
