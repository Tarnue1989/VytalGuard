/* -------------------- Cash Closing -------------------- */

export const FIELD_LABELS_CASH_CLOSING = {
  organization: "Organization",
  facility: "Facility",
  account: "Account",
  date: "Date",
  opening_balance: "Opening Balance",
  total_in: "Total In",
  total_out: "Total Out",
  closing_balance: "Closing Balance",
  status: "Status",
  createdBy: "Closed By",
  created_at: "Closed At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  actions: "Actions",
};

export const FIELD_ORDER_CASH_CLOSING = [
  "organization",
  "facility",
  "account",
  "date",
  "opening_balance",
  "total_in",
  "total_out",
  "closing_balance",
  "status",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "actions",
];

export const FIELD_DEFAULTS_CASH_CLOSING = {
  superadmin: FIELD_ORDER_CASH_CLOSING,

  admin: [
    "organization",
    "facility",
    "account",
    "date",
    "opening_balance",
    "total_in",
    "total_out",
    "closing_balance",
    "status",
    "createdBy",
    "created_at",
    "actions",
  ],

  manager: [
    "facility",
    "account",
    "date",
    "opening_balance",
    "total_in",
    "total_out",
    "closing_balance",
    "status",
    "created_at",
    "actions",
  ],

  staff: [
    "account",
    "date",
    "opening_balance",
    "total_in",
    "total_out",
    "closing_balance",
    "status",
    "actions",
  ],
};