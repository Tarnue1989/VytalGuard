// 📦 patient-insurance-constants.js – Enterprise MASTER–ALIGNED (Patient Insurance Parity)
// ============================================================================
// 🔹 Converted from: insurance-claim-constants.js
// 🔹 Pattern Source: payment / deposit / insurance claim MASTER pattern
// 🔹 Fully aligned with patientInsuranceController + enums
// 🔹 100% ID-safe (no breaking existing HTML / JS)
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (Enterprise Standard)
============================================================ */
export const FIELD_LABELS_PATIENT_INSURANCE = {
  policy_number: "Policy #",
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  provider: "Insurance Provider",
  plan_name: "Plan Name",
  coverage_limit: "Coverage Limit",
  currency: "Currency",
  valid_from: "Valid From",
  valid_to: "Valid To",
  is_primary: "Primary",
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
   📋 FIELD ORDER (Enterprise-Consistent)
============================================================ */
export const FIELD_ORDER_PATIENT_INSURANCE = [
  "policy_number",
  "organization",
  "facility",
  "patient",
  "provider",
  "plan_name",
  "coverage_limit",
  "currency",
  "valid_from",
  "valid_to",
  "is_primary",
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
   👥 ROLE-BASED FIELD DEFAULTS (MASTER RBAC)
============================================================ */
export const FIELD_DEFAULTS_PATIENT_INSURANCE = {
  superadmin: [
    "policy_number",
    "organization",
    "facility",
    "patient",
    "provider",
    "plan_name",
    "coverage_limit",
    "currency",
    "valid_from",
    "valid_to",
    "is_primary",
    "notes",
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
    "policy_number",
    "organization",
    "facility",
    "patient",
    "provider",
    "plan_name",
    "coverage_limit",
    "currency",
    "valid_from",
    "valid_to",
    "is_primary",
    "notes",
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
    "policy_number",
    "facility",
    "patient",
    "provider",
    "plan_name",
    "coverage_limit",
    "currency",
    "valid_from",
    "valid_to",
    "is_primary",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  staff: [
    "policy_number",
    "facility",
    "patient",
    "provider",
    "plan_name",
    "coverage_limit",
    "currency",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Enterprise Optional Extension)
============================================================ */
export const FIELD_GROUPS_PATIENT_INSURANCE = {
  org_scope: ["organization", "facility"],
  patient_info: ["patient", "provider"],
  policy_info: ["policy_number", "plan_name", "is_primary"],
  coverage: ["coverage_limit", "currency"],
  dates: ["valid_from", "valid_to"],
  notes: ["notes"],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ MODULE METADATA (Enterprise UI Context)
============================================================ */
export const MODULE_KEY_PATIENT_INSURANCE = "patient_insurances";
export const MODULE_LABEL_PATIENT_INSURANCE = "Patient Insurance";

/* ============================================================
   📦 EXPORT (Unified)
============================================================ */
export default {
  FIELD_LABELS_PATIENT_INSURANCE,
  FIELD_ORDER_PATIENT_INSURANCE,
  FIELD_DEFAULTS_PATIENT_INSURANCE,
  FIELD_GROUPS_PATIENT_INSURANCE,
  MODULE_KEY_PATIENT_INSURANCE,
  MODULE_LABEL_PATIENT_INSURANCE,
};