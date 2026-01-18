// 📁 organization-fields.js – Enterprise-Aligned Master Pattern (Upgraded)
// ============================================================================
// 🔹 Pattern Source: role-fields.js (Enterprise Master)
// 🔹 Structural Consistency: Field labels, order, role-based visibility
// 🔹 100% ID retention (safe for linked HTML and other JS modules)
// 🔹 Includes standardized metadata + role-tier visibility
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
   - Display labels for table headers, forms, and exports
============================================================ */
export const FIELD_LABELS_ORGANIZATION = {
  name: "Organization Name",
  code: "Code",
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
   📋 FIELD ORDER (Enterprise-Consistent)
   - Canonical order for rendering, exports, and summaries
============================================================ */
export const FIELD_ORDER_ORGANIZATION = [
  "name",
  "code",
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
   👥 ROLE-BASED FIELD VISIBILITY DEFAULTS
   - Matches enterprise tiers: superadmin > admin > manager > staff
============================================================ */
export const FIELD_DEFAULTS_ORGANIZATION = {
  superadmin: [
    "name",
    "code",
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
    "name",
    "code",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
  ],

  manager: [
    "name",
    "code",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
  ],

  staff: [
    "name",
    "code",
    "status",
  ],
};

/* ============================================================
   🧩 EXPORT GROUP (Enterprise Standard)
   - Unified access for tables, field selectors, and loaders
============================================================ */
export const FIELD_GROUP_ORGANIZATION = {
  LABELS: FIELD_LABELS_ORGANIZATION,
  ORDER: FIELD_ORDER_ORGANIZATION,
  DEFAULTS: FIELD_DEFAULTS_ORGANIZATION,
};

// ============================================================================
// ✅ Enterprise Master Compliance
//    • Safe structure
//    • Consistent ordering
//    • Role-aware visibility
//    • No behavior changes
// ============================================================================
