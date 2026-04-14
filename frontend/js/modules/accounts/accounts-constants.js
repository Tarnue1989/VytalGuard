// 📦 accounts-constants.js – Enterprise MASTER (LIGHT VERSION)

export const FIELD_LABELS_ACCOUNT = {
  account_number: "Account Number",
  name: "Account Name",
  type: "Type",
  currency: "Currency",
  balance: "Balance",
  is_active: "Status",
  organization: "Organization",
  facility: "Facility",
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  actions: "Actions",
};

export const FIELD_ORDER_ACCOUNT = [
  "account_number",
  "name",
  "type",
  "currency",
  "balance",
  "is_active",
  "organization",
  "facility",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "actions",
];

export const FIELD_DEFAULTS_ACCOUNT = {
  superadmin: [
    "account_number",
    "name",
    "type",
    "currency",
    "balance",
    "is_active",
    "organization",
    "facility",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  admin: [
    "account_number",
    "name",
    "type",
    "currency",
    "balance",
    "is_active",
    "facility",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  manager: [
    "account_number",
    "name",
    "type",
    "currency",
    "balance",
    "is_active",
    "facility",
    "created_at",
    "actions",
  ],

  staff: [
    "account_number",
    "name",
    "type",
    "currency",
    "balance",
    "is_active",
    "actions",
  ],
};

export const MODULE_KEY_ACCOUNT = "accounts";
export const MODULE_LABEL_ACCOUNT = "Account";

export default {
  FIELD_LABELS_ACCOUNT,
  FIELD_ORDER_ACCOUNT,
  FIELD_DEFAULTS_ACCOUNT,
  MODULE_KEY_ACCOUNT,
  MODULE_LABEL_ACCOUNT,
};