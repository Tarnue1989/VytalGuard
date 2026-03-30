// 📁 user-fields.js – Enterprise-Aligned Master Pattern (Upgraded)
// ============================================================================
// 🔹 Pattern Source: role-fields.js / vital-constants.js
// 🔹 Structural Consistency: Labels, order, role-based visibility
// 🔹 PRESERVED: All your field keys (NO breaking changes)
// 🔹 ENHANCED: Enterprise ordering + visibility + consistency
// ============================================================================


// 🧩 FIELD LABELS
export const FIELD_LABELS_USER = {
  // 🔗 Relations (moved up for consistency)
  organization: "Organization",
  facilities: "Facilities",
  roles: "Roles",

  // 🔹 Core identity
  username: "Username",
  email: "Email",
  first_name: "First Name",
  last_name: "Last Name",
  full_name: "Full Name",

  // 🔹 Status / lifecycle
  status: "Status",
  last_login_at: "Last Login",
  locked_until: "Locked Until",

  // 🕵️ Audit relations (standardized naming pattern kept)
  createdByUser: "Created By",
  created_at: "Created At",
  updatedByUser: "Updated By",
  updated_at: "Updated At",
  deletedByUser: "Deleted By",
  deleted_at: "Deleted At",

  // ⚡ UI
  actions: "Actions"
};


// ============================================================================
// 📋 FIELD ORDER (Enterprise Standardized)
// ============================================================================
// 🔹 Relations → Core → Status → Audit → Actions
// ============================================================================
export const FIELD_ORDER_USER = [
  // 🔗 Relations first (enterprise standard)
  "organization",
  "facilities",
  "roles",

  // 🔹 Core
  "username",
  "email",
  "first_name",
  "last_name",
  "full_name",

  // 🔹 Status
  "status",
  "last_login_at",
  "locked_until",

  // 🕵️ Audit
  "createdByUser",
  "created_at",
  "updatedByUser",
  "updated_at",
  "deletedByUser",
  "deleted_at",

  // ⚡ UI
  "actions"
];


// ============================================================================
// 👥 ROLE-BASED FIELD DEFAULTS (Enterprise-Aligned)
// ============================================================================
// 🧩 superadmin → full visibility
// 🧩 admin → org scoped (no org column)
// 🧩 manager → operational + audit light
// 🧩 staff → minimal
// ============================================================================
export const FIELD_DEFAULTS_USER = {

  superadmin: [
    "organization",
    "facilities",
    "roles",

    "username",
    "email",
    "first_name",
    "last_name",
    "full_name",

    "status",
    "last_login_at",
    "locked_until",

    "createdByUser",
    "created_at",
    "updatedByUser",
    "updated_at",
    "deletedByUser",
    "deleted_at",

    "actions"
  ],

  admin: [
    // ❗ org removed intentionally (scoped)
    "facilities",
    "roles",

    "username",
    "email",
    "first_name",
    "last_name",
    "full_name",

    "status",
    "last_login_at",
    "locked_until",

    "createdByUser",
    "created_at",
    "updatedByUser",
    "updated_at",

    "actions"
  ],

  manager: [
    "facilities",
    "roles",

    "username",
    "email",
    "full_name",

    "status",
    "last_login_at",
    "locked_until",

    "createdByUser",
    "created_at",
    "updatedByUser",
    "updated_at",

    "actions"
  ],

  staff: [
    "username",
    "email",
    "status",
    "actions"
  ]
};