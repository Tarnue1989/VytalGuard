// ============================================================
// 🏷️ FIELD LABELS — Role Permission Module
// ============================================================
export const FIELD_LABELS_ROLE_PERMISSION = {
  organization: "Organization",
  facility: "Facility",
  role: "Role",
  permission: "Permission",
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
export const FIELD_ORDER_ROLE_PERMISSION = [
  "organization",
  "facility",
  "role",
  "permission",
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
export const FIELD_DEFAULTS_ROLE_PERMISSION = {
  superadmin: [
    "organization",
    "facility",
    "role",
    "permission",
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
    "role",
    "permission",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  manager: [
    "role",
    "permission",
    "created_at",
    "updated_at",
    "actions",
  ],

  staff: [
    "role",
    "permission",
    "actions",
  ],
};
