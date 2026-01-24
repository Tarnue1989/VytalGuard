// 📁 triageRecord-constants.js – Enterprise-Aligned MASTER Parity
// ============================================================================
// 🔹 Pattern Source: vital-constants.js (Clinical Master Pattern)
// 🔹 Structural Consistency: labels, order, lifecycle + audit visibility
// 🔹 100% field ID retention (safe for HTML + renderers + filters)
// 🔹 Unified table/card/export behavior with Vital & EKG modules
// ============================================================================

/* ============================================================
   🏷️ Field Labels
============================================================ */
export const FIELD_LABELS_TRIAGE_RECORD = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  doctor: "Doctor",
  nurse: "Nurse",
  registrationLog: "Registration Log",
  triageType: "Triage Type",

  symptoms: "Symptoms",
  triage_notes: "Notes",

  bp: "Blood Pressure",
  pulse: "Pulse",
  rr: "Respiration Rate",
  temp: "Temperature",
  oxygen: "Oxygen Saturation",
  weight: "Weight",
  height: "Height",
  rbg: "Random Blood Glucose",
  pain_score: "Pain Score",
  position: "Position",

  triage_status: "Status",
  recorded_at: "Recorded At",

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
   📋 Field Order (Enterprise-Consistent, Vital-Parity)
============================================================ */
export const FIELD_ORDER_TRIAGE_RECORD = [
  "organization",
  "facility",
  "patient",
  "doctor",
  "nurse",
  "registrationLog",
  "triageType",

  "symptoms",
  "triage_notes",

  "bp",
  "pulse",
  "rr",
  "temp",
  "oxygen",
  "weight",
  "height",
  "rbg",
  "pain_score",
  "position",

  "triage_status",
  "recorded_at",

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
   👥 Role-Based Field Visibility Defaults (MASTER-ALIGNED)
============================================================ */
export const FIELD_DEFAULTS_TRIAGE_RECORD = {
  superadmin: [
    "organization",
    "facility",
    "patient",
    "doctor",
    "nurse",
    "registrationLog",
    "triageType",
    "symptoms",
    "triage_notes",
    "bp",
    "pulse",
    "rr",
    "temp",
    "oxygen",
    "weight",
    "height",
    "rbg",
    "pain_score",
    "position",
    "triage_status",
    "recorded_at",
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
    "nurse",
    "registrationLog",
    "triageType",
    "symptoms",
    "triage_notes",
    "bp",
    "pulse",
    "rr",
    "temp",
    "oxygen",
    "weight",
    "height",
    "rbg",
    "pain_score",
    "position",
    "triage_status",
    "recorded_at",
    "invoice",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "actions",
  ],

  manager: [
    "facility",
    "patient",
    "doctor",
    "nurse",
    "registrationLog",
    "triageType",
    "symptoms",
    "triage_notes",
    "bp",
    "pulse",
    "rr",
    "temp",
    "oxygen",
    "weight",
    "height",
    "rbg",
    "pain_score",
    "position",
    "triage_status",
    "recorded_at",
    "invoice",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  facility_head: [
    "facility",
    "patient",
    "doctor",
    "nurse",
    "registrationLog",
    "triageType",
    "symptoms",
    "triage_notes",
    "bp",
    "pulse",
    "rr",
    "temp",
    "oxygen",
    "weight",
    "height",
    "rbg",
    "pain_score",
    "position",
    "triage_status",
    "recorded_at",
    "createdBy",
    "created_at",
    "actions",
  ],

  staff: [
    "patient",
    "doctor",
    "nurse",
    "symptoms",
    "triage_notes",
    "bp",
    "pulse",
    "rr",
    "temp",
    "oxygen",
    "weight",
    "height",
    "rbg",
    "pain_score",
    "position",
    "triage_status",
    "recorded_at",
    "actions",
  ],
};

/* ============================================================
   ⚙️ Module Metadata (Enterprise Standard)
============================================================ */
export const MODULE_KEY_TRIAGE_RECORD = "triage_record";
export const MODULE_LABEL_TRIAGE_RECORD = "Triage Record";
