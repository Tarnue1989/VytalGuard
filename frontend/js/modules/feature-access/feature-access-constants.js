// 📁 feature-access-constants.js – Enterprise Master Pattern
// ============================================================================
// 🧭 Mirrors feature-module-constants.js EXACTLY (structure + intent)
// 🔹 Aligned with FeatureAccess model + API payload
// 🔹 UI-safe (NO raw UUIDs rendered)
// 🔹 Safe for list, export, card, detail, summary, sorting
// ============================================================================

/* ============================================================
   📋 Field Labels (Enterprise Aligned)
============================================================ */
export const FIELD_LABELS_FEATURE_ACCESS = {
  // 🏢 Scope
  organization: "Organization",
  module: "Module",
  role: "Role",
  facility: "Facility",

  // 🔐 Access
  status: "Status",

  // 👤 Audit (UI-safe associations)
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",

  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  // ⚙️ System
  actions: "Actions",
};

/* ============================================================
   📋 Field Display Order (Table / Export / Detail)
============================================================ */
export const FIELD_ORDER_FEATURE_ACCESS = [
  // 🏢 Scope
  "organization",
  "module",
  "role",
  "facility",

  // 🔐 Access
  "status",

  // 🧾 Audit
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",

  // ⚙️ System
  "actions",
];

/* ============================================================
   👥 Role-Based Default Field Sets
============================================================ */
export const FIELD_DEFAULTS_FEATURE_ACCESS = {
  superadmin: [
    "organization",
    "module",
    "role",
    "facility",
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
    "module",
    "role",
    "facility",
    "status",

    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",

    "actions",
  ],

  manager: [
    "organization",
    "module",
    "role",
    "facility",
    "status",

    "createdBy",
    "created_at",

    "actions",
  ],

  staff: [
    "organization",
    "module",
    "status",
  ],
};
