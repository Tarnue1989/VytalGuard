// 📁 master-item-category-constants.js – FINAL (ORDER TYPE INCLUDED)
// ============================================================================
// 🔥 Updated to include order_type across all layers
// ============================================================================

/* ============================================================
   🏷️ Field Labels
============================================================ */
export const FIELD_LABELS_MASTER_ITEM_CATEGORY = {
  organization: "Organization",
  facility: "Facility",
  name: "Category Name",
  code: "Category Code",

  // 🔥 NEW
  order_type: "Order Type",

  description: "Description",
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
   📋 Field Order
============================================================ */
export const FIELD_ORDER_MASTER_ITEM_CATEGORY = [
  "organization",
  "facility",
  "name",
  "code",

  // 🔥 NEW (placed logically after code)
  "order_type",

  "description",
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
   👥 Role-Based Field Visibility Defaults
============================================================ */
export const FIELD_DEFAULTS_MASTER_ITEM_CATEGORY = {
  superadmin: [
    "organization",
    "facility",
    "name",
    "code",
    "order_type", // 🔥 NEW
    "description",
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
    "name",
    "code",
    "order_type", // 🔥 NEW
    "description",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "actions",
  ],

  manager: [
    "facility",
    "name",
    "code",
    "order_type", // 🔥 NEW
    "description",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  staff: [
    "facility",
    "name",
    "code",
    "order_type", // 🔥 NEW
    "description",
    "status",
    "actions",
  ],
};

/* ============================================================
   ⚙️ Module Metadata
============================================================ */
export const MODULE_KEY_MASTER_ITEM_CATEGORY = "master-item-category";
export const MODULE_LABEL_MASTER_ITEM_CATEGORY = "Master Item Category";