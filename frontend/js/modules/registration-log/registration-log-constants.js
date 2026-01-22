// 📁 registrationLog-constants.js – Enterprise-Aligned Master Pattern
// ============================================================================
// 🔹 Pattern Source: department-constants.js (Enterprise Master)
// 🔹 Structural Consistency: Field labels, order, role-based visibility
// 🔹 100% ID retention (safe for linked HTML + JS modules)
// 🔹 Includes standardized metadata + hierarchical visibility map
// ============================================================================

/* ============================================================
   🏷️ Field Labels
============================================================ */
export const FIELD_LABELS_REGISTRATION_LOG = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  registrar: "Registrar",
  registration_type: "Registration Type",
  registration_method: "Registration Method",
  registration_source: "Source",
  patient_category: "Category",
  visit_reason: "Visit Reason",
  is_emergency: "Emergency",
  registration_time: "Registration Time",
  log_status: "Status",
  invoice: "Invoice",
  notes: "Notes",
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
export const FIELD_ORDER_REGISTRATION_LOG = [
  "organization",
  "facility",
  "patient",
  "registrar",
  "registration_type",
  "registration_method",
  "registration_source",
  "patient_category",
  "visit_reason",
  "is_emergency",
  "registration_time",
  "log_status",
  "invoice",
  "notes",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

/* ============================================================
   👥 Role-Based Field Visibility Defaults (Enterprise-Aligned)
============================================================ */
// 🧩 Superadmin / Org Owner: Full visibility including audit + delete metadata
// 🧩 Admin / Manager: Operational + lifecycle visibility
// 🧩 Facility Head: Scoped operational visibility
// 🧩 Staff: Essential operational fields only
export const FIELD_DEFAULTS_REGISTRATION_LOG = {
  superadmin: [
    "organization",
    "facility",
    "patient",
    "registrar",
    "registration_type",
    "registration_method",
    "registration_source",
    "patient_category",
    "visit_reason",
    "is_emergency",
    "registration_time",
    "log_status",
    "invoice",
    "notes",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "actions",
  ],

  org_owner: [
    "organization",
    "facility",
    "patient",
    "registrar",
    "registration_type",
    "registration_method",
    "registration_source",
    "patient_category",
    "visit_reason",
    "is_emergency",
    "registration_time",
    "log_status",
    "invoice",
    "notes",
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
    "patient",
    "registrar",
    "registration_type",
    "registration_method",
    "registration_source",
    "patient_category",
    "visit_reason",
    "is_emergency",
    "registration_time",
    "log_status",
    "invoice",
    "notes",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  facility_head: [
    "facility",
    "patient",
    "registrar",
    "registration_type",
    "registration_method",
    "patient_category",
    "visit_reason",
    "is_emergency",
    "registration_time",
    "log_status",
    "invoice",
    "notes",
    "createdBy",
    "created_at",
    "actions",
  ],

  manager: [
    "facility",
    "patient",
    "registrar",
    "registration_type",
    "registration_method",
    "registration_source",
    "patient_category",
    "visit_reason",
    "is_emergency",
    "registration_time",
    "log_status",
    "invoice",
    "notes",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  staff: [
    "facility",
    "patient",
    "registration_type",
    "registration_method",
    "patient_category",
    "visit_reason",
    "is_emergency",
    "registration_time",
    "log_status",
    "actions",
  ],
};

/* ============================================================
   ⚙️ Module Metadata (For dynamic routing / UI context)
============================================================ */
export const MODULE_KEY_REGISTRATION_LOG = "registration_log";
export const MODULE_LABEL_REGISTRATION_LOG = "Registration Log";
