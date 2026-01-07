export const FIELD_LABELS_CENTRAL_STOCK = {
  organization: "Organization",
  facility: "Facility",
  masterItem: "Item",           // ✅ FIXED
  supplier: "Supplier",
  quantity: "Quantity",
  received_date: "Received Date",
  expiry_date: "Expiry Date",
  batch_number: "Batch Number",
  notes: "Notes",
  is_available: "Available?",
  is_locked: "Locked?",
  status: "Status",
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",
  actions: "Actions",
};

export const FIELD_ORDER_CENTRAL_STOCK = [
  "organization",
  "facility",
  "masterItem",                 // ✅ FIXED
  "supplier",
  "quantity",
  "received_date",
  "expiry_date",
  "batch_number",
  "notes",
  "is_available",
  "is_locked",
  "status",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

export const FIELD_DEFAULTS_CENTRAL_STOCK = {
  admin: [
    "organization",
    "facility",
    "masterItem",               // ✅ FIXED
    "supplier",
    "quantity",
    "received_date",
    "expiry_date",
    "batch_number",
    "is_available",
    "status",
    "created_at",
    "actions",
  ],
  manager: [
    "facility",
    "masterItem",               // ✅ FIXED
    "supplier",
    "quantity",
    "received_date",
    "expiry_date",
    "batch_number",
    "is_available",
    "status",
    "actions",
  ],
  staff: [
    "facility",
    "masterItem",               // ✅ FIXED
    "supplier",
    "quantity",
    "status",
    "actions",
  ],
};
