// 📁 department-constants.js – Enterprise-Aligned Master Pattern
// ============================================================================
// 🔹 Pattern Source: role-fields.js / vital-constants.js (Enterprise Master)
// 🔹 Structural Consistency: Field labels, order, role-based visibility
// 🔹 100% ID retention (safe for linked HTML + JS modules)
// 🔹 Includes standardized metadata + hierarchical visibility map
// ============================================================================

/* ============================================================
   🏷️ Field Labels
============================================================ */
export const FIELD_LABELS_DEPARTMENT = {
  organization: "Organization",
  facility: "Facility",
  name: "Department Name",
  code: "Department Code",
  description: "Description",
  head_of_department: "Head of Department",
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
export const FIELD_ORDER_DEPARTMENT = [
  "organization",
  "facility",
  "name",
  "code",
  "description",
  "head_of_department",
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
   👥 Role-Based Field Visibility Defaults (Fully Enterprise-Aligned)
============================================================ */
// 🧩 Superadmin/Admin: Full metadata visibility
// 🧩 Manager/Facility Head: Scoped operational visibility
// 🧩 Staff: Essential operational fields only
export const FIELD_DEFAULTS_DEPARTMENT = {
  superadmin: [
    "organization",
    "facility",
    "name",
    "code",
    "description",
    "head_of_department",
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
    "head_of_department",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "actions",
  ],

  facility_head: [
    "facility",
    "name",
    "code",
    "description",
    "head_of_department",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  manager: [
    "facility",
    "name",
    "code",
    "description",
    "head_of_department",
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
    "head_of_department",
    "status",
    "actions",
  ],
};

/* ============================================================
   ⚙️ Module Metadata (For dynamic routing / UI context)
============================================================ */
export const MODULE_KEY_DEPARTMENT = "department";
export const MODULE_LABEL_DEPARTMENT = "Department";
