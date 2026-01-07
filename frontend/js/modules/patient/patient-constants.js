// 📁 patient-constants.js – Enterprise Master Pattern (Corrected)
// ============================================================================
// 🧭 Matches Employee & Delivery Record Constants Pattern
// 🔹 Fully aligned with Patient model + API payload
// 🔹 NO phantom fields (JSONB handled correctly)
// 🔹 Safe for list, export, and detail views
// ============================================================================

/* ============================================================
   📋 Field Labels (Enterprise Aligned)
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
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  // ⚙️ System
  actions: "Actions",
};

/* ============================================================
   📋 Field Display Order (Table / Export / Detail)
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
  "emergency_contacts", // ✅ JSONB (formatted in renderer)
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
   👥 Role-Based Default Field Sets
============================================================ */
export const FIELD_DEFAULTS_PATIENT = {
  admin: [
    "organization",
    "facility",
    "pat_no",
    "full_name",
    "first_name",
    "last_name",
    "gender",
    "date_of_birth",
    "phone_number",
    "email_address",
    "marital_status",
    "religion",
    "profession",
    "emergency_contacts",
    "registration_status",
    "source_of_registration",
    "photo_path",
    "qr_code_path",
    "actions",
  ],

  manager: [
    "organization",
    "facility",
    "pat_no",
    "full_name",
    "first_name",
    "last_name",
    "gender",
    "phone_number",
    "email_address",
    "emergency_contacts",
    "registration_status",
    "photo_path",
    "qr_code_path",
    "actions",
  ],

  staff: [
    "organization",
    "facility",
    "pat_no",
    "full_name",
    "first_name",
    "last_name",
    "gender",
    "photo_path",
    "qr_code_path",
    "actions",
  ],
};
