// 📁 master-item-constants.js – Enterprise-Aligned Master Pattern (FINAL)
// ============================================================================
// 🔹 Pattern Source: master-item-category-constants.js / vital-constants.js
// 🔹 Structural Consistency: Field labels, order, and role-based visibility
// 🔹 100% ID retention (safe for linked HTML + other JS modules)
// 🔹 Includes standardized metadata + hierarchical visibility logic
// ============================================================================

/* ============================================================
   🏷️ Field Labels
============================================================ */
export const FIELD_LABELS_MASTER_ITEM = {
  organization: "Organization",
  facility: "Facility",
  feature_module: "Feature Module",
  name: "Item Name",
  code: "Item Code",
  description: "Description",
  item_type: "Item Type",
  category: "Category",
  department: "Department",
  generic_group: "Generic Group",
  strength: "Strength",
  dosage_form: "Dosage Form",
  unit: "Unit",
  reorder_level: "Reorder Level",
  is_controlled: "Controlled Substance",
  sample_required: "Sample Required",
  test_method: "Test Method",
  reference_price: "Reference Price",
  currency: "Currency",
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
export const FIELD_ORDER_MASTER_ITEM = [
  "organization",
  "facility",
  "feature_module",
  "name",
  "code",
  "description",
  "item_type",
  "category",
  "department",
  "generic_group",
  "strength",
  "dosage_form",
  "unit",
  "reorder_level",
  "is_controlled",
  "sample_required",
  "test_method",
  "reference_price",
  "currency",
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
export const FIELD_DEFAULTS_MASTER_ITEM = {
  admin: [
    "organization",
    "facility",
    "feature_module",
    "name",
    "code",
    "description",
    "item_type",
    "category",
    "department",
    "generic_group",
    "strength",
    "dosage_form",
    "unit",
    "reorder_level",
    "is_controlled",
    "sample_required",
    "test_method",
    "reference_price",
    "currency",
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
    "organization",
    "facility",
    "feature_module",
    "name",
    "code",
    "description",
    "item_type",
    "category",
    "department",
    "generic_group",
    "strength",
    "dosage_form",
    "unit",
    "reorder_level",
    "is_controlled",
    "sample_required",
    "test_method",
    "reference_price",
    "currency",
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
    "item_type",
    "unit",
    "status",
    "actions",
  ],
};
