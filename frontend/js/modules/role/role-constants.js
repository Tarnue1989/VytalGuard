// 📁 role-fields.js – Enterprise-Aligned Master Pattern (Upgraded)
// ============================================================================
// 🔹 Pattern Source: vital-constants.js (Enterprise Master)
// 🔹 Structural Consistency: Field labels, order, role-based visibility
// 🔹 100% ID retention (safe for linked HTML and other JS modules)
// 🔹 Includes standardized metadata + hierarchical role visibility
// ============================================================================

export const FIELD_LABELS_ROLE = {
  organization: "Organization",
  facility: "Facility",
  name: "Role Name",
  code: "Role Code",
  description: "Description",
  role_type: "Role Type",
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
// 📋 Field Order (Enterprise-Consistent Across Modules)
// ============================================================================
export const FIELD_ORDER_ROLE = [
  "organization",
  "facility",
  "name",
  "code",
  "description",
  "role_type",
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
// 🧩 Admin: Full visibility (org, facility, metadata)
// 🧩 Manager: Scoped visibility (facility + audit trail)
// 🧩 Staff: Operational essentials only
// ============================================================================
export const FIELD_DEFAULTS_ROLE = {
  admin: [
    "organization",
    "facility",
    "name",
    "code",
    "description",
    "role_type",
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
    "role_type",
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
    "role_type",
    "status",
    "actions",
  ],
};
