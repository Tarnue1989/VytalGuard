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

  // ✅ ADDED
  payer_type: "Payer Type",
  patientInsurance: "Insurance",

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

  // ✅ ADDED
  "payer_type",
  "patientInsurance",

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

    // ✅ ADDED
    "payer_type",
    "patientInsurance",

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

    // ✅ ADDED
    "payer_type",
    "patientInsurance",

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

    // ✅ ADDED
    "payer_type",
    "patientInsurance",

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

    // ✅ ADDED
    "payer_type",
    "patientInsurance",

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

    // ✅ ADDED
    "payer_type",
    "patientInsurance",

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

    // ✅ ADDED (optional but recommended)
    "payer_type",

    "visit_reason",
    "is_emergency",
    "registration_time",
    "log_status",
    "actions",
  ],
};