// 📦 invoice-constants.js – Enterprise Master Pattern Aligned (FIXED)
// ============================================================================
// Includes missing "applied_deposits" field for full financial rendering
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
============================================================ */
export const FIELD_LABELS_INVOICE = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  invoice_number: "Invoice #",
  status: "Status",

  // 💰 Financials
  subtotal: "Subtotal",
  total: "Total Amount",
  total_discount: "Discount",
  total_tax: "Tax",
  total_paid: "Amount Paid",
  refunded_amount: "Refunded",

  // ✅ ADDED (The missing field)
  applied_deposits: "Applied Deposits",

  balance: "Balance",

  notes: "Notes",

  // Meta
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
export const FIELD_ORDER_INVOICE = [
  "organization",
  "facility",
  "patient",
  "invoice_number",
  "status",
  "subtotal",
  "total",
  "total_discount",
  "total_tax",
  "total_paid",
  "refunded_amount",

  // ✅ INSERTED IN CORRECT POSITION
  "applied_deposits",

  "balance",
  "notes",
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
export const FIELD_DEFAULTS_INVOICE = {
  superadmin: FIELD_ORDER_INVOICE,

  admin: [
    "organization",
    "facility",
    "patient",
    "invoice_number",
    "status",
    "subtotal",
    "total",
    "total_discount",
    "total_tax",
    "total_paid",
    "refunded_amount",
    "applied_deposits",  // ✅ Added
    "balance",
    "notes",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  manager: [
    "facility",
    "patient",
    "invoice_number",
    "status",
    "subtotal",
    "total",
    "total_discount",
    "total_tax",
    "total_paid",
    "refunded_amount",
    "applied_deposits",  // ✅ Added
    "balance",
    "notes",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  staff: [
    "patient",
    "invoice_number",
    "status",
    "subtotal",
    "total",
    "total_tax",
    "total_paid",

    // Staff usually cannot see deposits → optional:
    // "applied_deposits",

    "balance",
    "created_at",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS
============================================================ */
export const FIELD_GROUPS_INVOICE = {
  org_scope: ["organization", "facility"],

  patient_info: ["patient", "invoice_number"],

  financials: [
    "subtotal",
    "total",
    "total_discount",
    "total_tax",
    "total_paid",
    "refunded_amount",

    // ✅ Added here as well
    "applied_deposits",

    "balance",
  ],

  notes: ["notes"],

  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],

  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ EXPORT (for external import)
============================================================ */
export default {
  FIELD_LABELS_INVOICE,
  FIELD_ORDER_INVOICE,
  FIELD_DEFAULTS_INVOICE,
  FIELD_GROUPS_INVOICE,
};
