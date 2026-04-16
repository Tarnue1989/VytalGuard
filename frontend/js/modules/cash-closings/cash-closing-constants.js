// 📦 cash-closing-constants.js – Enterprise MASTER–ALIGNED (Deposit Pattern)

export const FIELD_LABELS_CASH_CLOSING = {
  date: "Date",
  organization: "Organization",
  facility: "Facility",
  account: "Account",

  opening_balance: "Opening Balance",
  total_in: "Total In",
  total_out: "Total Out",
  closing_balance: "Closing Balance",

  is_locked: "Locked",

  closedBy: "Closed By",
  closed_at: "Closed At",

  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  actions: "Actions",
};

export const FIELD_ORDER_CASH_CLOSING = [
  "date",
  "organization",
  "facility",
  "account",

  "opening_balance",
  "total_in",
  "total_out",
  "closing_balance",

  "is_locked",

  "closedBy",
  "closed_at",

  "created_at",
  "updated_at",
  "deleted_at",

  "actions",
];

export const FIELD_DEFAULTS_CASH_CLOSING = {
  superadmin: [
    "date",
    "organization",
    "facility",
    "account",
    "opening_balance",
    "total_in",
    "total_out",
    "closing_balance",
    "is_locked",
    "closedBy",
    "closed_at",
    "created_at",
    "updated_at",
    "deleted_at",
    "actions",
  ],

  admin: [
    "date",
    "organization",
    "facility",
    "account",
    "opening_balance",
    "total_in",
    "total_out",
    "closing_balance",
    "is_locked",
    "closedBy",
    "closed_at",
    "created_at",
    "updated_at",
    "deleted_at",
    "actions",
  ],

  manager: [
    "date",
    "facility",
    "account",
    "opening_balance",
    "total_in",
    "total_out",
    "closing_balance",
    "is_locked",
    "closedBy",
    "closed_at",
    "created_at",
    "updated_at",
    "actions",
  ],

  staff: [
    "date",
    "facility",
    "account",
    "opening_balance",
    "total_in",
    "total_out",
    "closing_balance",
    "is_locked",
    "actions",
  ],
};

export const FIELD_GROUPS_CASH_CLOSING = {
  org_scope: ["organization", "facility"],
  account_info: ["account"],
  financials: [
    "opening_balance",
    "total_in",
    "total_out",
    "closing_balance",
  ],
  status: ["is_locked"],
  audit: ["closedBy", "closed_at", "created_at", "updated_at"],
  system: ["deleted_at", "actions"],
};

export const MODULE_KEY_CASH_CLOSING = "cash_closings";
export const MODULE_LABEL_CASH_CLOSING = "Cash Closing";

export default {
  FIELD_LABELS_CASH_CLOSING,
  FIELD_ORDER_CASH_CLOSING,
  FIELD_DEFAULTS_CASH_CLOSING,
  FIELD_GROUPS_CASH_CLOSING,
  MODULE_KEY_CASH_CLOSING,
  MODULE_LABEL_CASH_CLOSING,
};