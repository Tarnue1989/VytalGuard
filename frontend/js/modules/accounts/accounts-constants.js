// 📦 accounts-constants.js – Enterprise MASTER (LIGHT VERSION)

/* ============================================================
   🏷️ LABELS
============================================================ */
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
  createdAt: "Created At",     // ✅ FIXED
  updatedBy: "Updated By",
  updatedAt: "Updated At",     // ✅ FIXED

  actions: "Actions",
};

/* ============================================================
   📊 ORDER
============================================================ */
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
  "createdAt",   // ✅ FIXED
  "updatedBy",
  "updatedAt",   // ✅ FIXED

  "actions",
];

/* ============================================================
   🎯 DEFAULT VISIBILITY
============================================================ */
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
    "createdAt",
    "updatedBy",
    "updatedAt",

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
    "createdAt",
    "updatedBy",
    "updatedAt",

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

    "createdAt",

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

/* ============================================================
   🔑 MODULE
============================================================ */
export const MODULE_KEY_ACCOUNT = "accounts";
export const MODULE_LABEL_ACCOUNT = "Account";

/* ============================================================
   📤 EXPORT
============================================================ */
export default {
  FIELD_LABELS_ACCOUNT,
  FIELD_ORDER_ACCOUNT,
  FIELD_DEFAULTS_ACCOUNT,
  MODULE_KEY_ACCOUNT,
  MODULE_LABEL_ACCOUNT,
};