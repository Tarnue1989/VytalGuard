// 📁 lab-result-constants.js – Enterprise MASTER–ALIGNED (Patient Parity)
// ============================================================================
// 🔹 Pattern Source: patient-constants.js (Enterprise MASTER)
// 🔹 Structural Consistency: labels, order, RBAC visibility, metadata
// 🔹 100% ID retention (safe for existing HTML + JS modules)
// 🔹 Supports dynamic tables, cards, field selector, exports, summaries
// 🔹 Backend-safe: aligned with labResultController search, status, audit logic
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (Enterprise Standard)
============================================================ */
export const FIELD_LABELS_LAB_RESULT = {
  // 🏢 Organizational Scope
  organization: "Organization",
  facility: "Facility",

  // 👤 Linked Entities
  department: "Department",
  patient: "Patient",
  doctor: "Doctor",
  consultation: "Consultation",
  registration_log: "Registration Log",

  // 🧪 Lab Associations
  lab_request: "Linked Lab Request",
  lab_request_item: "Lab Request Item",
  lab_test: "Lab Test",

  // 📊 Result Data
  result: "Result",
  notes: "Notes",
  doctor_notes: "Doctor Notes",
  result_date: "Result Date",
  attachment_url: "Attachment (File)",
  status: "Status",

  // 🧾 Audit Trail
  enteredBy: "Entered By",
  reviewedBy: "Reviewed By",
  verifiedBy: "Verified By",
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",

  // ⚙️ UI
  actions: "Actions",
};

/* ============================================================
   📋 FIELD ORDER (Enterprise-Consistent)
============================================================ */
export const FIELD_ORDER_LAB_RESULT = [
  // 🔹 Organizational Scope
  "organization",
  "facility",

  // 🔹 Primary Hierarchy
  "department",
  "patient",
  "doctor",
  "consultation",
  "registration_log",

  // 🔹 Linked Entities
  "lab_request",
  "lab_request_item",
  "lab_test",

  // 🔹 Core Result Data
  "result",
  "notes",
  "doctor_notes",
  "result_date",
  "attachment_url",
  "status",

  // 🔹 Audit & Tracking
  "enteredBy",
  "reviewedBy",
  "verifiedBy",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",

  // 🔹 System
  "actions",
];

/* ============================================================
   👥 ROLE-BASED FIELD DEFAULTS (MASTER RBAC)
============================================================ */
export const FIELD_DEFAULTS_LAB_RESULT = {
  superadmin: FIELD_ORDER_LAB_RESULT,

  admin: FIELD_ORDER_LAB_RESULT,

  orgowner: [
    "facility",
    "department",
    "patient",
    "doctor",
    "consultation",
    "registration_log",
    "lab_request",
    "lab_request_item",
    "lab_test",
    "result",
    "notes",
    "doctor_notes",
    "result_date",
    "attachment_url",
    "status",
    "reviewedBy",
    "verifiedBy",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  facilityhead: [
    "facility",
    "department",
    "patient",
    "doctor",
    "consultation",
    "registration_log",
    "lab_request",
    "lab_request_item",
    "lab_test",
    "result",
    "notes",
    "doctor_notes",
    "result_date",
    "attachment_url",
    "status",
    "reviewedBy",
    "verifiedBy",
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
    "lab_request",
    "lab_request_item",
    "lab_test",
    "result",
    "notes",
    "result_date",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Enterprise Optional Extension)
============================================================ */
export const FIELD_GROUPS_LAB_RESULT = {
  org_scope: ["organization", "facility"],

  hierarchy: [
    "department",
    "patient",
    "doctor",
    "consultation",
    "registration_log",
  ],

  associations: [
    "lab_request",
    "lab_request_item",
    "lab_test",
  ],

  result_data: [
    "result",
    "notes",
    "doctor_notes",
    "result_date",
    "attachment_url",
    "status",
  ],

  audit: [
    "enteredBy",
    "reviewedBy",
    "verifiedBy",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
  ],

  system: [
    "deletedBy",
    "deleted_at",
    "actions",
  ],
};

/* ============================================================
   ⚙️ MODULE METADATA (Enterprise UI Context)
============================================================ */
export const MODULE_KEY_LAB_RESULT = "lab_result";
export const MODULE_LABEL_LAB_RESULT = "Lab Result";

/* ============================================================
   📦 EXPORT (Unified)
============================================================ */
export default {
  FIELD_LABELS_LAB_RESULT,
  FIELD_ORDER_LAB_RESULT,
  FIELD_DEFAULTS_LAB_RESULT,
  FIELD_GROUPS_LAB_RESULT,
  MODULE_KEY_LAB_RESULT,
  MODULE_LABEL_LAB_RESULT,
};