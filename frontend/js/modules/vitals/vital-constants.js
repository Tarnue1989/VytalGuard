// 📁 vital-constants.js – Enterprise-Aligned Master Pattern (Upgraded)
// ============================================================================
// 🔹 Pattern Source: consultation-constants.js (Appointment Master Pattern)
// 🔹 Maintains identical structural logic: labels, order, role-based defaults
// 🔹 Includes full role alignment, admin/manager/staff consistency
// 🔹 All field IDs remain unchanged (safe for your existing HTML)
// ============================================================================

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
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",
  actions: "Actions",
};

// ============================================================================
// 📋 Field Order (kept consistent across all roles and master modules)
// ============================================================================
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
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

// ============================================================================
// 👥 Role-Based Field Visibility Defaults (Fully Appointment-Aligned)
// ============================================================================
// Each tier mirrors the consultation master pattern hierarchy.
// Staff see only operational essentials,
// Manager adds organizational + audit scope,
// Admin sees full metadata & org-level fields.
// ============================================================================
export const FIELD_DEFAULTS_VITAL = {
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
    "updatedBy",
    "updated_at",
    "actions",
  ],

  staff: [
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
