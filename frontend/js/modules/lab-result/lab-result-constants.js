/* ============================================================
   💉 LAB RESULT – Field Labels, Order & Visibility
   ------------------------------------------------------------
   Fully aligned with Master Pattern (EKG / Central Stock).
   Includes consistent structure, naming, permissions,
   and UI logic (tooltip-ready, role-based visibility).
============================================================ */

export const FIELD_LABELS_LAB_RESULT = {
  // 🔹 Core Links
  organization: "Organization",
  facility: "Facility",
  department: "Department",
  patient: "Patient",
  doctor: "Doctor",
  consultation: "Consultation",
  registrationLog: "Registration Log",

  // 🔹 Lab Associations
  labRequest: "Linked Lab Request",
  labRequestItem: "Lab Request Item",
  labTest: "Lab Test",

  // 🔹 Result Data
  result: "Result",
  notes: "Notes",
  doctor_notes: "Doctor Notes",
  result_date: "Result Date",
  attachment_url: "Attachment (File)",
  status: "Status",

  // 🔹 Audit Trail
  enteredBy: "Entered By",
  reviewedBy: "Reviewed By",
  verifiedBy: "Verified By",
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",

  // 🔹 Time Stamps
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  // 🔹 UI
  actions: "Actions",
};

/* ============================================================
   📋 FIELD ORDER (Universal Ordering)
============================================================ */
export const FIELD_ORDER_LAB_RESULT = [
  // 🔹 Primary Hierarchy
  "organization",
  "facility",
  "department",
  "patient",
  "doctor",
  "consultation",
  "registrationLog",

  // 🔹 Linked Entities
  "labRequest",
  "labRequestItem",
  "labTest",

  // 🔹 Core Data
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

  // 🔹 UI Controls
  "actions",
];

/* ============================================================
   👥 ROLE-BASED FIELD VISIBILITY DEFAULTS
   ------------------------------------------------------------
   Each role inherits master visibility logic:
   - Admin / Superadmin → Full
   - OrgOwner / FacilityHead → Operational + Linked
   - Staff → Minimal clinical & visible results only
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
    "registrationLog",
    "labRequest",
    "labRequestItem",
    "labTest",
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
    "registrationLog",
    "labRequest",
    "labRequestItem",
    "labTest",
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
    "labRequest",
    "labRequestItem",
    "labTest",
    "result",
    "notes",
    "result_date",
    "status",
    "actions",
  ],
};
