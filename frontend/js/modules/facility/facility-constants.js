// ============================================================================
// 🏥 VytalGuard – Facility Constants (Enterprise Master Pattern Aligned)
// 🔹 Mirrors role-fields.js for unified structure + field handling
// 🔹 Safe for UI mapping, permissions, and role-based visibility
// 🔹 All field keys, IDs, and linkages preserved exactly
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
============================================================ */
export const FIELD_LABELS_FACILITY = {
  organization: "Organization",
  name: "Facility Name",
  code: "Facility Code",
  address: "Address",
  phone: "Phone",
  email: "Email",
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
   📋 FIELD ORDER
============================================================ */
export const FIELD_ORDER_FACILITY = [
  "organization",
  "name",
  "code",
  "address",
  "phone",
  "email",
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
   👥 FIELD DEFAULTS BY ROLE
============================================================ */
export const FIELD_DEFAULTS_FACILITY = {
  superadmin: [
    "organization",
    "name",
    "code",
    "address",
    "phone",
    "email",
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
    "name",
    "code",
    "address",
    "phone",
    "email",
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
    "name",
    "code",
    "address",
    "phone",
    "email",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  staff: [
    "name",
    "code",
    "address",
    "phone",
    "email",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧩 EXPORT GROUP
============================================================ */
export const FIELD_GROUP_FACILITY = {
  LABELS: FIELD_LABELS_FACILITY,
  ORDER: FIELD_ORDER_FACILITY,
  DEFAULTS: FIELD_DEFAULTS_FACILITY,
};
