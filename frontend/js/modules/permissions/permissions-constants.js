// 📁 permission-constants.js

// ============================================================
// 🏷️ FIELD LABELS — Permission Module
// ============================================================
export const FIELD_LABELS_PERMISSION = {
  key: "Key",
  name: "Name",
  description: "Description",
  module: "Module",
  category: "Category",
  is_global: "Global Access",
  roles: "Assigned Roles",
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",
  actions: "Actions",
};

// ============================================================
// 📋 FIELD ORDER — Controls Column Sequence
// ============================================================
export const FIELD_ORDER_PERMISSION = [
  "key",
  "name",
  "description",
  "module",
  "category",
  "is_global",
  "roles",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

// ============================================================
// 👥 FIELD DEFAULTS — Role-Based Visibility
// ============================================================
export const FIELD_DEFAULTS_PERMISSION = {
  superadmin: [
    "key",
    "name",
    "description",
    "module",
    "category",
    "is_global",
    "roles",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "actions",
  ],

  admin: [
    "key",
    "name",
    "description",
    "module",
    "category",
    "is_global",
    "roles",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  manager: [
    "key",
    "name",
    "description",
    "module",
    "category",
    "is_global",
    "actions",
  ],

  staff: [
    "key",
    "name",
    "module",
    "category",
    "actions",
  ],
};
