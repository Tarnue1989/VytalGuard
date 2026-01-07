// 📦 appointment-constants.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors consultation-constants.js for unified structure + RBAC defaults
// 🔹 Keeps all original field IDs intact for HTML + JS link consistency
// 🔹 Supports dynamic table rendering, tooltips, exports, and role visibility
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
============================================================ */
export const FIELD_LABELS_APPOINTMENT = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  doctor: "Doctor",
  department: "Department",
  appointment_code: "Appointment Code",
  date_time: "Date & Time",
  status: "Status",
  invoice: "Invoice",
  notes: "Notes",
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",
  actions: "Actions",
};

/* ============================================================
   🧩 FIELD ORDER
============================================================ */
export const FIELD_ORDER_APPOINTMENT = [
  "organization",
  "facility",
  "patient",
  "doctor",
  "department",
  "appointment_code",
  "date_time",
  "status",
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
   👥 ROLE-BASED FIELD DEFAULTS
   Matches enterprise master structure (admin → manager → staff)
============================================================ */
export const FIELD_DEFAULTS_APPOINTMENT = {
  // 🧑‍💼 Super Admin / Admin: full visibility
  admin: [
    "organization",
    "facility",
    "patient",
    "doctor",
    "department",
    "appointment_code",
    "date_time",
    "status",
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

  // 👔 Manager: scoped visibility (no organization)
  manager: [
    "facility",
    "patient",
    "doctor",
    "department",
    "appointment_code",
    "date_time",
    "status",
    "invoice",
    "notes",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  // 👷 Staff / General Employee: restricted operational view
  staff: [
    "facility",
    "patient",
    "doctor",
    "date_time",
    "status",
    "notes",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Optional Extension)
   Enables dynamic section toggling & report grouping
============================================================ */
export const FIELD_GROUPS_APPOINTMENT = {
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  identifiers: ["appointment_code", "status", "invoice"],
  patient_info: ["patient", "doctor", "department"],
  org_scope: ["organization", "facility"],
  notes: ["notes"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ EXPORT (for external import)
============================================================ */
export default {
  FIELD_LABELS_APPOINTMENT,
  FIELD_ORDER_APPOINTMENT,
  FIELD_DEFAULTS_APPOINTMENT,
  FIELD_GROUPS_APPOINTMENT,
};
