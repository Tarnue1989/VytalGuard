// 📁 consultation-constants.js – Enterprise-Aligned Master Pattern
// ============================================================================
// 🔹 Pattern Source: department-constants.js / role-fields.js (Enterprise Master)
// 🔹 Structural Consistency: Field labels, order, role-based visibility
// 🔹 100% ID retention (safe for linked HTML + JS modules)
// 🔹 Includes standardized metadata + hierarchical visibility map
// ============================================================================

/* ============================================================
   🏷️ Field Labels
============================================================ */
export const FIELD_LABELS_CONSULTATION = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  doctor: "Doctor",
  department: "Department",
  appointment: "Appointment",
  registrationLog: "Registration Log",
  parentConsultation: "Parent Consultation",
  consultationType: "Consultation Type",
  consultation_date: "Date",
  diagnosis: "Diagnosis",
  consultation_notes: "Notes",
  prescribed_medications: "Prescribed Medications",
  status: "Status",
  invoice: "Invoice",
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
export const FIELD_ORDER_CONSULTATION = [
  "organization",
  "facility",
  "patient",
  "doctor",
  "department",
  "appointment",
  "registrationLog",
  "parentConsultation",
  "consultationType",
  "consultation_date",
  "diagnosis",
  "consultation_notes",
  "prescribed_medications",
  "status",
  "invoice",
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
// 🧩 Superadmin/Admin: Full metadata visibility
// 🧩 Manager/Facility Head: Scoped operational visibility
// 🧩 Staff: Essential operational fields only
export const FIELD_DEFAULTS_CONSULTATION = {
  superadmin: [
    "organization",
    "facility",
    "patient",
    "doctor",
    "department",
    "appointment",
    "registrationLog",
    "parentConsultation",
    "consultationType",
    "consultation_date",
    "diagnosis",
    "consultation_notes",
    "prescribed_medications",
    "status",
    "invoice",
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
    "doctor",
    "department",
    "appointment",
    "registrationLog",
    "consultationType",
    "consultation_date",
    "diagnosis",
    "consultation_notes",
    "prescribed_medications",
    "status",
    "invoice",
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
    "patient",
    "doctor",
    "department",
    "appointment",
    "consultationType",
    "consultation_date",
    "diagnosis",
    "consultation_notes",
    "prescribed_medications",
    "status",
    "invoice",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  manager: [
    "facility",
    "patient",
    "doctor",
    "department",
    "appointment",
    "consultationType",
    "consultation_date",
    "diagnosis",
    "consultation_notes",
    "prescribed_medications",
    "status",
    "invoice",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  staff: [
    "facility",
    "patient",
    "doctor",
    "department",
    "consultation_date",
    "diagnosis",
    "consultation_notes",
    "status",
    "actions",
  ],
};

/* ============================================================
   ⚙️ Module Metadata (For dynamic routing / UI context)
============================================================ */
export const MODULE_KEY_CONSULTATION = "consultation";
export const MODULE_LABEL_CONSULTATION = "Consultation";
