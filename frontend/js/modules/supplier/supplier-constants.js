// 📦 supplier-fields.js – Enterprise-Aligned Master Pattern (Upgraded)
// ============================================================================
// 🔹 Pattern Source: role-fields.js (Enterprise Master)
// 🔹 Structural Consistency: Field labels, order, role-based visibility
// 🔹 100% ID retention (safe for linked HTML / JS references)
// 🔹 Includes standardized metadata + hierarchical role visibility
// ============================================================================

/* ============================================================
   🏷️ Field Labels (Enterprise-Consistent)
============================================================ */
export const FIELD_LABELS_SUPPLIER = {
  organization: "Organization",
  facility: "Facility",
  name: "Supplier Name",
  contact_name: "Contact Person",
  contact_email: "Contact Email",
  contact_phone: "Contact Phone",
  address: "Address",
  notes: "Notes",
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
   📋 Field Order (Enterprise-Consistent Across Modules)
============================================================ */
export const FIELD_ORDER_SUPPLIER = [
  "organization",
  "facility",
  "name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "address",
  "notes",
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
   👥 Role-Based Field Visibility Defaults
   (Fully Enterprise-Aligned Hierarchical Structure)
============================================================ */
// 🧩 SuperAdmin → Full visibility (organization + facility + metadata)
// 🧩 Admin → Org-level visibility with audit trail
// 🧩 Manager → Facility-scope essentials + audit summary
// 🧩 Staff → Operational essentials only

export const FIELD_DEFAULTS_SUPPLIER = {
  superadmin: [
    "organization",
    "facility",
    "name",
    "contact_name",
    "contact_email",
    "contact_phone",
    "address",
    "notes",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  admin: [
    "organization",
    "facility",
    "name",
    "contact_name",
    "contact_email",
    "contact_phone",
    "address",
    "notes",
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
    "contact_name",
    "contact_phone",
    "address",
    "status",
    "createdBy",
    "created_at",
    "actions",
  ],

  staff: [
    "name",
    "contact_name",
    "contact_phone",
    "status",
    "actions",
  ],
};
