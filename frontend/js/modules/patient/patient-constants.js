// 📁 patient-constants.js – Enterprise MASTER–ALIGNED (Consultation Parity)
// ============================================================================
// 🔹 Pattern Source: consultation-constants.js (Enterprise MASTER)
// 🔹 Structural Consistency: labels, order, RBAC visibility, metadata
// 🔹 100% ID retention (safe for existing HTML + JS modules)
// 🔹 Supports dynamic tables, cards, field selector, exports, summaries
// 🔹 Backend-safe: aligned with patientController search, status, audit logic
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (Enterprise Standard)
============================================================ */
export const FIELD_LABELS_PATIENT = {
  // 🏢 Organizational Scope
  organization: "Organization",
  facility: "Facility",

  // 👤 Core Identity
  pat_no: "Patient No",
  full_name: "Full Name",
  first_name: "First Name",
  middle_name: "Middle Name",
  last_name: "Last Name",
  gender: "Gender",
  date_of_birth: "Date of Birth",
  date_of_birth_precision: "Date Precision",

  // 📞 Contact Information
  phone_number: "Phone",
  email_address: "Email",
  home_address: "Address",

  // 💍 Demographics
  marital_status: "Marital Status",
  religion: "Religion",
  profession: "Profession",

  // 🆔 Identification
  national_id: "National ID",
  insurance_number: "Insurance No",
  passport_number: "Passport No",

  // ☎️ Emergency (JSONB)
  emergency_contacts: "Emergency Contacts",

  // 🩺 Registration
  registration_status: "Registration Status",
  source_of_registration: "Source of Registration",

  // 🗒️ Notes & Attachments
  notes: "Notes",
  photo_path: "Profile Photo",
  qr_code_path: "QR Code",

  // 🧾 Audit Trail
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",

  // ⚙️ System
  actions: "Actions",
};

/* ============================================================
   📋 FIELD ORDER (Enterprise-Consistent)
============================================================ */
export const FIELD_ORDER_PATIENT = [
  "organization",
  "facility",

  "pat_no",
  "full_name",
  "first_name",
  "middle_name",
  "last_name",
  "gender",
  "date_of_birth",
  "date_of_birth_precision",

  "phone_number",
  "email_address",
  "home_address",

  "marital_status",
  "religion",
  "profession",

  "national_id",
  "insurance_number",
  "passport_number",

  "emergency_contacts",

  "registration_status",
  "source_of_registration",

  "notes",
  "photo_path",
  "qr_code_path",

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
// 🧩 Superadmin/Admin: full demographic + audit visibility
// 🧩 Facility Head / Manager: scoped operational visibility
// 🧩 Staff: essential operational fields only
export const FIELD_DEFAULTS_PATIENT = {
  superadmin: [
    "organization",
    "facility",

    "pat_no",
    "full_name",
    "gender",
    "date_of_birth",
    "date_of_birth_precision",

    "phone_number",
    "email_address",
    "home_address",

    "marital_status",
    "religion",
    "profession",

    "national_id",
    "insurance_number",
    "passport_number",

    "emergency_contacts",

    "registration_status",
    "source_of_registration",

    "notes",
    "photo_path",
    "qr_code_path",

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

    "pat_no",
    "full_name",
    "gender",
    "date_of_birth",

    "phone_number",
    "email_address",
    "home_address",

    "emergency_contacts",

    "registration_status",
    "source_of_registration",

    "notes",
    "photo_path",
    "qr_code_path",

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

    "pat_no",
    "full_name",
    "gender",
    "date_of_birth",

    "phone_number",
    "email_address",

    "registration_status",

    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",

    "actions",
  ],

  manager: [
    "facility",

    "pat_no",
    "full_name",
    "gender",

    "phone_number",

    "registration_status",

    "createdBy",
    "created_at",

    "actions",
  ],

  staff: [
    "pat_no",
    "full_name",
    "gender",
    "registration_status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Enterprise Optional Extension)
============================================================ */
export const FIELD_GROUPS_PATIENT = {
  org_scope: ["organization", "facility"],

  identity: [
    "pat_no",
    "full_name",
    "first_name",
    "middle_name",
    "last_name",
    "gender",
    "date_of_birth",
    "date_of_birth_precision",
  ],

  contact: [
    "phone_number",
    "email_address",
    "home_address",
    "emergency_contacts",
  ],

  demographics: [
    "marital_status",
    "religion",
    "profession",
  ],

  identification: [
    "national_id",
    "insurance_number",
    "passport_number",
  ],

  registration: [
    "registration_status",
    "source_of_registration",
  ],

  media: [
    "photo_path",
    "qr_code_path",
  ],

  meta: [
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
export const MODULE_KEY_PATIENT = "patient";
export const MODULE_LABEL_PATIENT = "Patient";

/* ============================================================
   📦 EXPORT (Unified)
============================================================ */
export default {
  FIELD_LABELS_PATIENT,
  FIELD_ORDER_PATIENT,
  FIELD_DEFAULTS_PATIENT,
  FIELD_GROUPS_PATIENT,
  MODULE_KEY_PATIENT,
  MODULE_LABEL_PATIENT,
};
