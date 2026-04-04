// 📦 invoice-constants.js – Enterprise MASTER (FULL FIXED)
// ============================================================================
// ✔ Currency fully supported
// ✔ appliedDeposits aligned with backend
// ✔ Role names synced (facility_head, org_owner, etc.)
// ✔ Label + items + patient_label added
// ✔ Safe for frontend rendering (table + cards + filters)
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
============================================================ */
export const FIELD_LABELS_INVOICE = {
  organization: "Organization",
  facility: "Facility",

  // 👤 Patient
  patient: "Patient",
  patient_label: "Patient",

  // 📄 Core
  invoice_number: "Invoice #",
  label: "Invoice",
  status: "Status",

  // 📦 Items
  items: "Items",

  // 💱 Currency (CRITICAL)
  currency: "Currency",

  // 💰 Financials
  subtotal: "Subtotal",
  total: "Total Amount",
  total_discount: "Discount",
  total_tax: "Tax",
  total_paid: "Amount Paid",
  refunded_amount: "Refunded",

  // 💰 Deposits (aligned with backend relation)
  appliedDeposits: "Applied Deposits",

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
   🧩 FIELD ORDER (MASTER DISPLAY ORDER)
============================================================ */
export const FIELD_ORDER_INVOICE = [
  "organization",
  "facility",

  "patient_label",

  "invoice_number",
  "items",

  // 💱 MUST come early
  "currency",

  "status",

  "subtotal",
  "total",
  "total_discount",
  "total_tax",
  "total_paid",
  "refunded_amount",

  "appliedDeposits",

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

  org_owner: [
    "organization",
    "facility",
    "patient_label",
    "invoice_number",
    "items",
    "currency",
    "status",
    "subtotal",
    "total",
    "total_discount",
    "total_tax",
    "total_paid",
    "refunded_amount",
    "appliedDeposits",
    "balance",
    "notes",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  admin: [
    "organization",
    "facility",
    "patient_label",
    "invoice_number",
    "items",
    "currency",
    "status",
    "subtotal",
    "total",
    "total_discount",
    "total_tax",
    "total_paid",
    "refunded_amount",
    "appliedDeposits",
    "balance",
    "notes",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  facility_head: [
    "facility",
    "patient_label",
    "invoice_number",
    "items",
    "currency",
    "status",
    "subtotal",
    "total",
    "total_discount",
    "total_tax",
    "total_paid",
    "refunded_amount",
    "appliedDeposits",
    "balance",
    "notes",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  staff: [
    "patient_label",
    "invoice_number",
    "items",
    "currency",
    "status",
    "subtotal",
    "total",
    "total_tax",
    "total_paid",

    // 🚫 optional (keep hidden if needed)
    // "appliedDeposits",

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

  patient_info: ["patient_label", "invoice_number"],

  items: ["items"],

  financials: [
    "currency",
    "subtotal",
    "total",
    "total_discount",
    "total_tax",
    "total_paid",
    "refunded_amount",
    "appliedDeposits",
    "balance",
  ],

  notes: ["notes"],

  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],

  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ EXPORT
============================================================ */
export default {
  FIELD_LABELS_INVOICE,
  FIELD_ORDER_INVOICE,
  FIELD_DEFAULTS_INVOICE,
  FIELD_GROUPS_INVOICE,
};