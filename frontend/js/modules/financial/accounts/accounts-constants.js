/* -------------------- Accounts -------------------- */

export const FIELD_LABELS_ACCOUNT = {
  organization: "Organization",
  facility: "Facility",
  name: "Account Name",
  type: "Type",
  currency: "Currency",
  balance: "Balance",
  is_active: "Active?",
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",
  actions: "Actions",
};

export const FIELD_ORDER_ACCOUNT = [
  "organization",
  "facility",
  "name",
  "type",
  "currency",
  "balance",
  "is_active",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

export const FIELD_DEFAULTS_ACCOUNT = {
  superadmin: FIELD_ORDER_ACCOUNT,

  admin: [
    "organization",
    "facility",
    "name",
    "type",
    "currency",
    "balance",
    "is_active",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  manager: [
    "facility",
    "name",
    "type",
    "currency",
    "balance",
    "is_active",
    "created_at",
    "updated_at",
    "actions",
  ],

  staff: [
    "name",
    "type",
    "currency",
    "balance",
    "is_active",
    "actions",
  ],
};