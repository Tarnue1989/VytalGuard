// ============================================================================
// 🏢 VytalGuard – Organization Constants (Enterprise Master Pattern Aligned)
// 🔹 Mirrors consultation-constants.js for unified structure + field handling
// 🔹 Safe for UI mapping, permissions, and role-based visibility
// 🔹 All field keys, IDs, and linkages preserved exactly
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
  updatedBy: "Updated By",
  deletedBy: "Deleted By",

  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  actions: "Actions",
};

/* ============================================================
   📋 FIELD ORDER
   - Canonical order for column rendering + export consistency
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
   ⚙️ FIELD DEFAULTS BY ROLE
   - Controls visibility tiers in grids/forms (auto-applied)
   - Matches master pattern: superadmin > admin > manager > staff
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
    "actions", // ✅ Superadmin has full visibility (delete + audit)
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
    "deleted_at", // 🟡 Can view delete audit but not trigger delete
  ],

  manager: [
    "name",
    "code",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at", // 🟢 Streamlined operational visibility
  ],

  staff: [
    "name",
    "code",
    "status", // 🧩 Minimal safe fields for regular users
  ],
};

/* ============================================================
   🧩 EXPORT GROUP (Optional)
   - Used by DataTables, field-selectors, and unified loaders
============================================================ */
export const FIELD_GROUP_ORGANIZATION = {
  LABELS: FIELD_LABELS_ORGANIZATION,
  ORDER: FIELD_ORDER_ORGANIZATION,
  DEFAULTS: FIELD_DEFAULTS_ORGANIZATION,
};

// ============================================================================
// ✅ This module follows Enterprise Master Pattern:
//    • Safe structure
//    • Consisten
