// ============================================================================
// 🏥 VytalGuard – Facility Constants (Enterprise Master Pattern Aligned)
// 🔹 Mirrors organization-constants.js for unified structure + field handling
// 🔹 Safe for UI mapping, permissions, and role-based visibility
// 🔹 All field keys, IDs, and linkages preserved exactly
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
   - Display labels for table headers, forms, and exports
============================================================ */
export const FIELD_LABELS_FACILITY = {
  name: "Facility Name",
  code: "Code",
  status: "Status",

  address: "Address",
  phone: "Phone",
  email: "Email",
  organization: "Organization",

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
export const FIELD_ORDER_FACILITY = [
  "name",
  "code",
  "status",
  "address",
  "phone",
  "email",
  "organization",
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
export const FIELD_DEFAULTS_FACILITY = {
  superadmin: [
    "name",
    "code",
    "status",
    "address",
    "phone",
    "email",
    "organization",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "actions", // ✅ Superadmin sees all (delete + audit)
  ],

  admin: [
    "name",
    "code",
    "status",
    "address",
    "phone",
    "email",
    "organization",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at", // 🟡 Admin sees audits but may not delete
  ],

  manager: [
    "name",
    "code",
    "status",
    "address",
    "phone",
    "email",
    "organization",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at", // 🟢 Operational tier
  ],

  staff: [
    "name",
    "code",
    "status",
    "address",
    "phone",
    "email",
    "organization", // 🧩 Minimal safe visibility
  ],
};

/* ============================================================
   🧩 EXPORT GROUP (Optional)
   - Used by DataTables, field-selectors, and unified loaders
============================================================ */
export const FIELD_GROUP_FACILITY = {
  LABELS: FIELD_LABELS_FACILITY,
  ORDER: FIELD_ORDER_FACILITY,
  DEFAULTS: FIELD_DEFAULTS_FACILITY,
};

// ============================================================================
// ✅ This module follows Enterprise Master Pattern:
//    • Safe structure
//    • Consistent comments + field hierarchy
//    • Unified visibility tiers across all modules
// ============================================================================
