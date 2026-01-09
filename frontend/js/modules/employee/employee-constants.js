// 📁 employee-constants.js – Enterprise Master Pattern (Upgraded)
// ============================================================================
// 🧭 Matches Delivery Record Master Pattern
// 🔹 Full field alignment, audit consistency, and role-based visibility
// 🔹 IDs and field keys preserved 100% for existing links
// ============================================================================

export const FIELD_LABELS_EMPLOYEE = {
  // 🏢 Organizational Scope
  organization: "Organization",
  facility: "Facility",
  department: "Department",

  // 👤 Personal Info
  user: "Linked User",
  full_name: "Full Name",
  first_name: "First Name",
  middle_name: "Middle Name",
  last_name: "Last Name",
  gender: "Gender",
  dob: "Date of Birth",
  phone: "Phone",
  email: "Email",
  address: "Address",

  // 💼 Employment Details
  employee_no: "Employee No",
  position: "Position",
  license_no: "License No",
  specialty: "Specialty",
  certifications: "Certifications",
  hire_date: "Hire Date",
  termination_date: "Termination Date",
  status: "Status",

  // ☎️ Emergency Contact
  emergency_contact_name: "Emergency Contact Name",
  emergency_contact_phone: "Emergency Contact Phone",

  // 📎 Attachments
  photo_path: "Profile Photo",
  resume_url: "Resume (CV)",
  document_url: "Supporting Document",

  // 🧾 Audit
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  // ⚙️ System
  actions: "Actions",
};

// ============================================================================
// 📋 Field Display Order
// ============================================================================
export const FIELD_ORDER_EMPLOYEE = [
  "organization",
  "facility",
  "department",
  "user",
  "full_name",
  "first_name",
  "middle_name",
  "last_name",
  "gender",
  "dob",
  "phone",
  "email",
  "address",
  "employee_no",
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

// ============================================================================
// 👥 Role-Based Default Field Sets
// ============================================================================
export const FIELD_DEFAULTS_EMPLOYEE = {
  admin: [
    "organization",
    "facility",
    "department",
    "user",
    "full_name",
    "first_name",
    "middle_name",
    "last_name",
    "gender",
    "dob",
    "phone",
    "email",
    "address",
    "employee_no",
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
  ],

  manager: [
    "organization",
    "facility",
    "department",
    "full_name",
    "first_name",
    "last_name",
    "gender",
    "phone",
    "email",
    "position",
    "employee_no",
    "status",
    "photo_path",
    "resume_url",
    "document_url",
    "actions",
  ],

  staff: [
    "organization",
    "facility",
    "department",
    "full_name",
    "first_name",
    "last_name",
    "gender",
    "employee_no",
    "status",
    "photo_path",
    "actions",
  ],
};
