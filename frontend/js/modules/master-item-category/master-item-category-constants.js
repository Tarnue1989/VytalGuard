// 📁 master-item-category-constants.js – Enterprise-Aligned Master Pattern (Upgraded)
// ============================================================================
// 🔹 Pattern Source: role-fields.js / vital-constants.js
// 🔹 Structural Consistency: Field labels, order, role-based visibility
// 🔹 100% ID retention (safe for linked HTML + other JS modules)
// 🔹 Includes standardized metadata + hierarchical visibility logic
// ============================================================================

export const FIELD_LABELS_MASTER_ITEM_CATEGORY = {
  organization: "Organization",
  facility: "Facility",
  name: "Category Name",
  code: "Category Code",
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

// ============================================================================
// 📋 Field Order (Enterprise Consistent Across Modules)
// ============================================================================
export const FIELD_ORDER_MASTER_ITEM_CATEGORY = [
  "organization",
  "facility",
  "name",
  "code",
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

// ============================================================================
// 👥 Role-Based Field Visibility Defaults (Fully Enterprise-Aligned)
// ============================================================================
// 🧩 Admin: Full visibility (organization, facility, metadata)
// 🧩 Manager: Scoped visibility (facility + audit trail)
// 🧩 Staff: Operational essentials only
// ============================================================================
export const FIELD_DEFAULTS_MASTER_ITEM_CATEGORY = {
  admin: [
    "organization",
    "facility",
    "name",
    "code",
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
    "organization",
    "facility",
    "name",
    "code",
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
    "description",
    "status",
    "actions",
  ],
};
