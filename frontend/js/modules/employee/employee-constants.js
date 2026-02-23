// 📁 employee-constants.js – Enterprise MASTER–ALIGNED (Patient Parity)
// ============================================================================
// 🔹 Pattern Source: patient-constants.js (Enterprise MASTER)
// 🔹 Guarantees org / facility filter correctness
// 🔹 Supports table, card, field selector, export, RBAC
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
============================================================ */
export const FIELD_LABELS_EMPLOYEE = {
  organization: "Organization",
  facility: "Facility",
  department: "Department",

  employee_no: "Employee No",
  full_name: "Full Name",
  first_name: "First Name",
  middle_name: "Middle Name",
  last_name: "Last Name",
  gender: "Gender",
  dob: "Date of Birth",

  phone: "Phone",
  email: "Email",
  address: "Address",

  position: "Position",
  license_no: "License No",
  specialty: "Specialty",
  certifications: "Certifications",

  hire_date: "Hire Date",
  termination_date: "Termination Date",
  status: "Status",

  emergency_contact_name: "Emergency Contact Name",
  emergency_contact_phone: "Emergency Contact Phone",

  photo_path: "Profile Photo",
  resume_url: "Resume",
  document_url: "Document",

  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",

  actions: "Actions",
};

/* ============================================================
   📋 FIELD ORDER
============================================================ */
export const FIELD_ORDER_EMPLOYEE = [
  "organization",
  "facility",
  "department",

  "employee_no",
  "full_name",
  "first_name",
  "middle_name",
  "last_name",
  "gender",
  "dob",

  "phone",
  "email",
  "address",

  "position",
  "license_no",
  "specialty",
  "certifications",

  "hire_date",
  "termination_date",
  "status",

  "emergency_contact_name",
  "emergency_contact_phone",

  "photo_path",
  "resume_url",
  "document_url",

  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",

  "actions",
];

/* ============================================================
   👥 ROLE-BASED DEFAULTS (PATIENT PARITY)
============================================================ */
export const FIELD_DEFAULTS_EMPLOYEE = {
  superadmin: FIELD_ORDER_EMPLOYEE,

  admin: FIELD_ORDER_EMPLOYEE,

  facility_head: [
    "facility",
    "department",
    "employee_no",
    "full_name",
    "gender",
    "phone",
    "position",
    "status",
    "created_at",
    "actions",
  ],

  manager: [
    "facility",
    "department",
    "employee_no",
    "full_name",
    "position",
    "status",
    "actions",
  ],

  staff: [
    "employee_no",
    "full_name",
    "position",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (OPTIONAL BUT RECOMMENDED)
============================================================ */
export const FIELD_GROUPS_EMPLOYEE = {
  org_scope: ["organization", "facility", "department"],

  identity: [
    "employee_no",
    "full_name",
    "first_name",
    "middle_name",
    "last_name",
    "gender",
    "dob",
  ],

  contact: [
    "phone",
    "email",
    "address",
    "emergency_contact_name",
    "emergency_contact_phone",
  ],

  employment: [
    "position",
    "license_no",
    "specialty",
    "certifications",
    "hire_date",
    "termination_date",
    "status",
  ],

  media: [
    "photo_path",
    "resume_url",
    "document_url",
  ],

  audit: [
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
  ],

  system: ["actions"],
};

/* ============================================================
   ⚙️ MODULE METADATA
============================================================ */
export const MODULE_KEY_EMPLOYEE = "employee";
export const MODULE_LABEL_EMPLOYEE = "Employee";
