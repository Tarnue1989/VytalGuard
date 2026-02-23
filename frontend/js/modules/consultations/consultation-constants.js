// 📁 consultation-constants.js – Enterprise MASTER–ALIGNED (Deposit Parity)
// ============================================================================
// 🔹 Pattern Source: deposit-constants.js (Enterprise MASTER)
// 🔹 Structural Consistency: labels, order, RBAC visibility, metadata
// 🔹 100% ID retention (safe for existing HTML + JS modules)
// 🔹 Supports dynamic tables, cards, field selector, exports, summaries
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (Enterprise Standard)
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
   📋 FIELD ORDER (Enterprise-Consistent)
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
   👥 ROLE-BASED FIELD DEFAULTS (MASTER RBAC)
============================================================ */
// 🧩 Superadmin/Admin: full clinical + audit visibility
// 🧩 Manager/Facility Head: scoped operational visibility
// 🧩 Staff: essential operational fields only
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
   🧠 FIELD GROUPS (Enterprise Optional Extension)
============================================================ */
export const FIELD_GROUPS_CONSULTATION = {
  org_scope: ["organization", "facility"],
  patient_info: ["patient", "appointment", "registrationLog", "parentConsultation"],
  clinical: [
    "doctor",
    "department",
    "consultationType",
    "consultation_date",
    "diagnosis",
    "consultation_notes",
    "prescribed_medications",
  ],
  billing: ["invoice"],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ MODULE METADATA (Enterprise UI Context)
============================================================ */
export const MODULE_KEY_CONSULTATION = "consultation";
export const MODULE_LABEL_CONSULTATION = "Consultation";

/* ============================================================
   📦 EXPORT (Unified)
============================================================ */
export default {
  FIELD_LABELS_CONSULTATION,
  FIELD_ORDER_CONSULTATION,
  FIELD_DEFAULTS_CONSULTATION,
  FIELD_GROUPS_CONSULTATION,
  MODULE_KEY_CONSULTATION,
  MODULE_LABEL_CONSULTATION,
};
