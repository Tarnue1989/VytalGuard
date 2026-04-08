// 📦 invoice-constants.js – Enterprise MASTER (FINAL FIXED)
// ============================================================================
// ✔ Fully aligned with Invoice model + backend GET
// ✔ Includes invoice_date, due_date, payer_type, is_locked
// ✔ Currency + appliedDeposits correct
// ✔ Role-safe defaults
// ✔ Ready for filters + table + cards + summary
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

  // 📅 Billing Info (ADDED)
  invoice_date: "Invoice Date",
  due_date: "Due Date",
  payer_type: "Payer Type",
  is_locked: "Locked",

  // 📦 Items
  items: "Items",

  // 💱 Currency
  currency: "Currency",

  // 💰 Financials
  subtotal: "Subtotal",
  total: "Total Amount",
  total_discount: "Discount",
  total_tax: "Tax",
  total_paid: "Amount Paid",
  refunded_amount: "Refunded",

  // 💰 Deposits
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

  // 🔥 CRITICAL BILLING INFO
  "invoice_date",
  "due_date",
  "payer_type",
  "is_locked",

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

    "invoice_date",
    "due_date",
    "payer_type",

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

    "invoice_date",
    "due_date",
    "payer_type",

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

    "invoice_date",
    "due_date",
    "payer_type",

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

    "invoice_date",
    "payer_type",

    "items",
    "currency",
    "status",

    "subtotal",
    "total",
    "total_tax",
    "total_paid",

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

  billing_info: [
    "invoice_date",
    "due_date",
    "payer_type",
  ],

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

  system: ["is_locked", "deletedBy", "deleted_at", "actions"],
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