// 📁 master-item-category-constants.js – Enterprise-Aligned Master Pattern (FINAL / LOCKED)
// ============================================================================
// 🔹 Pattern Source: role-fields.js / vital-constants.js (Enterprise Master)
// 🔹 Structural Consistency: Field labels, order, role-based visibility
// 🔹 100% ID retention (safe for linked HTML + JS modules)
// 🔹 Includes standardized metadata + hierarchical visibility map
// ============================================================================

/* ============================================================
   🏷️ Field Labels
============================================================ */
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

/* ============================================================
   📋 Field Order (Enterprise-Consistent)
============================================================ */
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

/* ============================================================
   👥 Role-Based Field Visibility Defaults (Enterprise-Aligned)
============================================================ */
// 🧩 Superadmin/Admin: Full metadata visibility
// 🧩 Manager/Facility Head: Scoped operational visibility
// 🧩 Staff: Essential operational fields only
export const FIELD_DEFAULTS_MASTER_ITEM_CATEGORY = {
  superadmin: [
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

/* ============================================================
   ⚙️ Module Metadata (For routing / permissions / UI context)
============================================================ */
export const MODULE_KEY_MASTER_ITEM_CATEGORY = "master-item-category";
export const MODULE_LABEL_MASTER_ITEM_CATEGORY = "Master Item Category";
