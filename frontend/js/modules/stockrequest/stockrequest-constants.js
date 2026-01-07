// 📁 stockrequest-constants.js
// ============================================================
// 🧩 FIELD CONSTANTS — Stock Request Module
// Pattern aligned with Central Stock & Consultation modules
// ============================================================

/* ============================================================
   📋 FIELD LABELS
============================================================ */
export const FIELD_LABELS_STOCK_REQUEST = {
  organization: "Organization",
  facility: "Facility",
  department: "Department",
  reference_number: "Reference No.",
  notes: "Notes",
  status: "Status",
  items: "Requested Items",

  approvedBy: "Approved By",
  approvedAt: "Approved At",
  rejectedBy: "Rejected By",
  rejectedAt: "Rejected At",
  issuedBy: "Issued By",
  issuedAt: "Issued At",
  fulfilledBy: "Fulfilled By",
  fulfilledAt: "Fulfilled At",

  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",

  actions: "Actions",
};

/* ============================================================
   📋 FIELD ORDER
   - Includes pseudo-fields (`items`, `actions`) at the end
   - Follows Central Stock consistency
============================================================ */
export const FIELD_ORDER_STOCK_REQUEST = [
  "organization",
  "facility",
  "department",
  "reference_number",
  "notes",
  "status",
  "items",

  "approvedBy",
  "approvedAt",
  "rejectedBy",
  "rejectedAt",
  "issuedBy",
  "issuedAt",
  "fulfilledBy",
  "fulfilledAt",

  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

/* ============================================================
   👥 FIELD DEFAULTS (Role-based visibility)
   - Mirrors Central Stock and Consultation logic
============================================================ */
export const FIELD_DEFAULTS_STOCK_REQUEST = {
  admin: [
    "organization",
    "facility",
    "department",
    "reference_number",
    "notes",
    "status",
    "items",
    "approvedBy",
    "approvedAt",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],
  manager: [
    "facility",
    "department",
    "reference_number",
    "notes",
    "status",
    "items",
    "approvedBy",
    "approvedAt",
    "actions",
  ],
  staff: [
    "department",
    "reference_number",
    "status",
    "items",
    "actions",
  ],
};
