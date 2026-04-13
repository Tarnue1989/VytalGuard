/* -------------------- Expenses -------------------- */

export const FIELD_LABELS_EXPENSE = {
  organization: "Organization",
  facility: "Facility",
  account: "Account",
  category: "Category",
  amount: "Amount",
  currency: "Currency",
  description: "Description",
  date: "Date",
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",
  actions: "Actions",
};

export const FIELD_ORDER_EXPENSE = [
  "organization",
  "facility",
  "account",
  "category",
  "amount",
  "currency",
  "description",
  "date",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

export const FIELD_DEFAULTS_EXPENSE = {
  superadmin: FIELD_ORDER_EXPENSE,

  admin: [
    "organization",
    "facility",
    "account",
    "category",
    "amount",
    "currency",
    "description",
    "date",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  manager: [
    "facility",
    "account",
    "category",
    "amount",
    "currency",
    "description",
    "date",
    "created_at",
    "updated_at",
    "actions",
  ],

  staff: [
    "account",
    "category",
    "amount",
    "currency",
    "date",
    "actions",
  ],
};