// 📁 vital-constants.js – Enterprise-Aligned MASTER Parity
// ============================================================================
// 🔹 Pattern Source: ekgRecord-constants.js (Enterprise Master)
// 🔹 Structural Consistency: labels, order, lifecycle + audit visibility
// 🔹 100% field ID retention (safe for HTML + renderers + filters)
// 🔹 FULL parity with EKG where clinically applicable
// ============================================================================

/* ============================================================
   🏷️ Field Labels
============================================================ */
export const FIELD_LABELS_VITAL = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  admission: "Admission",
  consultation: "Consultation",
  triageRecord: "Triage Record",
  nurse: "Nurse",

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

  status: "Status",
  recorded_at: "Recorded At",

  finalized_at: "Finalized At",
  finalizedBy: "Finalized By",
  verified_at: "Verified At",
  verifiedBy: "Verified By",
  voided_at: "Voided At",
  voidedBy: "Voided By",

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
export const FIELD_ORDER_VITAL = [
  "organization",
  "facility",
  "patient",
  "admission",
  "consultation",
  "triageRecord",
  "nurse",

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

  "status",
  "recorded_at",

  "finalized_at",
  "finalizedBy",
  "verified_at",
  "verifiedBy",
  "voided_at",
  "voidedBy",

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
// Mirrors EKG RECORD constants lifecycle + audit behavior
export const FIELD_DEFAULTS_VITAL = {
  superadmin: [
    "organization",
    "facility",
    "patient",
    "admission",
    "consultation",
    "triageRecord",
    "nurse",
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
    "status",
    "recorded_at",
    "finalized_at",
    "finalizedBy",
    "verified_at",
    "verifiedBy",
    "voided_at",
    "voidedBy",
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
    "admission",
    "consultation",
    "triageRecord",
    "nurse",
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
    "status",
    "recorded_at",
    "finalized_at",
    "finalizedBy",
    "verified_at",
    "verifiedBy",
    "voided_at",
    "voidedBy",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  manager: [
    "facility",
    "patient",
    "admission",
    "consultation",
    "triageRecord",
    "nurse",
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
    "status",
    "recorded_at",
    "verified_at",
    "verifiedBy",
    "finalized_at",
    "finalizedBy",
    "voided_at",
    "voidedBy",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  facility_head: [
    "facility",
    "patient",
    "admission",
    "consultation",
    "triageRecord",
    "nurse",
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
    "status",
    "recorded_at",
    "createdBy",
    "created_at",
    "actions",
  ],

  staff: [
    "facility",
    "patient",
    "consultation",
    "triageRecord",
    "nurse",
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
    "status",
    "recorded_at",
    "actions",
  ],
};

/* ============================================================
   ⚙️ Module Metadata (Enterprise Standard)
============================================================ */
export const MODULE_KEY_VITAL = "vital";
export const MODULE_LABEL_VITAL = "Vital";
