/* -------------------- Ledger -------------------- */

export const FIELD_LABELS_LEDGER = {
  organization: "Organization",
  facility: "Facility",
  account: "Account",
  patient: "Patient",
  invoice: "Invoice",
  transaction_type: "Type",
  amount: "Amount",
  method: "Method",
  status: "Status",
  note: "Note",
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  actions: "Actions",
};

export const FIELD_ORDER_LEDGER = [
  "organization",
  "facility",
  "account",
  "patient",
  "invoice",
  "transaction_type",
  "amount",
  "method",
  "status",
  "note",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "actions",
];

export const FIELD_DEFAULTS_LEDGER = {
  superadmin: FIELD_ORDER_LEDGER,

  admin: [
    "organization",
    "facility",
    "account",
    "patient",
    "invoice",
    "transaction_type",
    "amount",
    "method",
    "status",
    "note",
    "createdBy",
    "created_at",
    "actions",
  ],

  manager: [
    "facility",
    "account",
    "transaction_type",
    "amount",
    "method",
    "status",
    "created_at",
    "actions",
  ],

  staff: [
    "account",
    "transaction_type",
    "amount",
    "status",
    "created_at",
    "actions",
  ],
};