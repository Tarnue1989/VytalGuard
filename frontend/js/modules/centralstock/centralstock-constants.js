// 📁 central-stock-constants.js – Enterprise-Aligned Master Pattern (UPGRADED)
// ============================================================================
// 🔹 Pattern Source: billableitem-constants.js (Enterprise MASTER)
// 🔹 FULL FEATURE PARITY APPLIED
// 🔹 Field labels, strict field order, role-based visibility
// 🔹 Status treated as lifecycle field (list/filter/action based)
// 🔹 Audit fields standardized
// 🔹 100% ID retention (safe for linked HTML + JS modules)
// 🔹 NO API calls introduced or removed
// ============================================================================

/* ============================================================
   🏷️ Field Labels (Enterprise Standard)
============================================================ */
export const FIELD_LABELS_CENTRAL_STOCK = {
  organization: "Organization",
  facility: "Facility",
  masterItem: "Item",
  supplier: "Supplier",
  quantity: "Quantity",
  received_date: "Received Date",
  expiry_date: "Expiry Date",
  batch_number: "Batch Number",
  is_available: "Available?",
  is_locked: "Locked?",
  status: "Status",
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",
  actions: "Actions",
};

/* ============================================================
   📋 Field Order (STRICT – Enterprise Consistent)
============================================================ */
export const FIELD_ORDER_CENTRAL_STOCK = [
  "organization",
  "facility",
  "masterItem",
  "supplier",
  "quantity",
  "received_date",
  "expiry_date",
  "batch_number",
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

/* ============================================================
   👥 Role-Based Field Visibility Defaults (Enterprise Master)
============================================================ */
export const FIELD_DEFAULTS_CENTRAL_STOCK = {
  superadmin: [
    "organization",
    "facility",
    "masterItem",
    "supplier",
    "quantity",
    "received_date",
    "expiry_date",
    "batch_number",
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
  ],

  admin: [
    "organization",
    "facility",
    "masterItem",
    "supplier",
    "quantity",
    "received_date",
    "expiry_date",
    "batch_number",
    "is_available",
    "is_locked",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  facility_head: [
    "facility",
    "masterItem",
    "supplier",
    "quantity",
    "received_date",
    "expiry_date",
    "batch_number",
    "is_available",
    "is_locked",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  manager: [
    "facility",
    "masterItem",
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
    "masterItem",
    "supplier",
    "quantity",
    "status",
    "actions",
  ],
};

/* ============================================================
   ⚙️ Module Metadata (Single Source of Truth)
============================================================ */
export const MODULE_KEY_CENTRAL_STOCK = "centralStock";
export const MODULE_LABEL_CENTRAL_STOCK = "Central Stock";
