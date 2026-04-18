// 📦 expense-constants.js – Enterprise MASTER–ALIGNED (Deposit → Expense)

export const FIELD_LABELS_EXPENSE = {
  expense_number: "Expense #",
  organization: "Organization",
  facility: "Facility",
  account: "Account",
  category: "Category",
  amount: "Amount",
  currency: "Currency",
  payment_method: "Payment Method",
  description: "Description",
  date: "Date",
  status: "Status",

  // 🔥 lifecycle audit
  approvedBy: "Approved By",
  approved_at: "Approved At",
  postedBy: "Posted By",
  posted_at: "Posted At",
  reversedBy: "Reversed By",
  reversed_at: "Reversed At",
  voidedBy: "Voided By",
  voided_at: "Voided At",

  // 🔹 base audit
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",

  actions: "Actions",
};

export const FIELD_ORDER_EXPENSE = [
  "expense_number",
  "organization",
  "facility",
  "account",
  "category",
  "amount",
  "currency",
  "payment_method",
  "description",
  "date",
  "status",

  // 🔥 lifecycle audit
  "approvedBy","approved_at",
  "postedBy","posted_at",
  "reversedBy","reversed_at",
  "voidedBy","voided_at",

  // 🔹 base audit
  "createdBy","created_at",
  "updatedBy","updated_at",
  "deletedBy","deleted_at",

  "actions",
];

export const FIELD_DEFAULTS_EXPENSE = {
  superadmin: FIELD_ORDER_EXPENSE,

  admin: FIELD_ORDER_EXPENSE,

  manager: [
    "expense_number",
    "facility",
    "account",
    "category",
    "amount",
    "currency",
    "payment_method",
    "description",
    "date",
    "status",

    // 🔥 key lifecycle only
    "approvedBy","approved_at",
    "postedBy","posted_at",

    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  staff: [
    "expense_number",
    "facility",
    "account",
    "category",
    "amount",
    "currency",
    "payment_method",
    "date",
    "status",
    "actions",
  ],
};

export const FIELD_GROUPS_EXPENSE = {
  org_scope: ["organization", "facility"],
  financials: [
    "account",
    "category",
    "amount",
    "currency",
    "payment_method",
  ],
  details: ["description", "date"],

  // 🔥 lifecycle grouped
  lifecycle: [
    "approvedBy","approved_at",
    "postedBy","posted_at",
    "reversedBy","reversed_at",
    "voidedBy","voided_at",
  ],

  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  system: ["deletedBy", "deleted_at", "actions"],
};

export const MODULE_KEY_EXPENSE = "expenses";
export const MODULE_LABEL_EXPENSE = "Expense";

export default {
  FIELD_LABELS_EXPENSE,
  FIELD_ORDER_EXPENSE,
  FIELD_DEFAULTS_EXPENSE,
  FIELD_GROUPS_EXPENSE,
  MODULE_KEY_EXPENSE,
  MODULE_LABEL_EXPENSE,
};