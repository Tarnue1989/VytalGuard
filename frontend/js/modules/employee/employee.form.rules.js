// 📁 employee.form.rules.js
// ===================================================
// Employee Form Rules — FULL FIELD COVERAGE (MASTER)
// Controller-aligned • No over-enforcement
// ===================================================

export const EMPLOYEE_FORM_RULES = [
  /* ================= IDENTITY ================= */
  { id: "first_name", message: "First Name is required" },
  { id: "middle_name", message: "Middle Name is required", when: () => false },
  { id: "last_name", message: "Last Name is required" },
  { id: "gender", message: "Gender is required" },
  { id: "dob", message: "Date of Birth is required", when: () => false },

  /* ================= CONTACT ================= */
  { id: "phone", message: "Phone is required", when: () => false },
  { id: "email", message: "Email is required", when: () => false },
  { id: "address", message: "Address is required", when: () => false },

  /* ================= EMPLOYMENT ================= */
  { id: "employee_no", message: "Employee Number is required" },
  { id: "position", message: "Position is required" },
  { id: "status", message: "Employee status is required", when: () => true },


  /* ================= DEPARTMENT =================
     ✔ Controller allows NULL
     ✔ Frontend does NOT enforce
  ------------------------------------------------ */
  {
    id: "departmentSelect",
    message: "Department is required",
    when: () => false,
  },

  /* ================= DATES ================= */
  { id: "hire_date", message: "Hire date is required", when: () => false },
  { id: "termination_date", message: "Termination date is required", when: () => false },

  /* ================= CREDENTIALS ================= */
  { id: "license_no", message: "License number is required", when: () => false },
  { id: "specialty", message: "Specialty is required", when: () => false },
  { id: "certifications", message: "Certifications are required", when: () => false },

  /* ================= EMERGENCY ================= */
  {
    id: "emergency_contact_name",
    message: "Emergency contact name is required",
    when: () => false,
  },
  {
    id: "emergency_contact_phone",
    message: "Emergency contact phone is required",
    when: () => false,
  },

  /* ================= SYSTEM / RELATION ================= */
  {
    id: "userSelect",
    message: "Linked user is required",
    when: () => false,
  },

  /* ================= ORGANIZATION =================
     ✔ Required ONLY for superadmin
     ✔ Backend resolves for others
  -------------------------------------------------- */
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  /* ================= FACILITY =================
     ✔ Facility Head → required
     ✔ Superadmin / Org Admin → optional
     ✔ Position-based enforcement is BACKEND ONLY
  -------------------------------------------------- */
  {
    id: "facilitySelect",
    message: "Facility is required",
    when: () => {
      const role = (localStorage.getItem("userRole") || "").toLowerCase();
      if (role.includes("super")) return false;
      if (role.includes("org")) return false;
      return true;
    },
  },

  /* ================= FILE FLAGS ================= */
  { id: "employee_photo", message: "Photo is required", when: () => false },
  { id: "resume_url", message: "Resume is required", when: () => false },
  { id: "document_url", message: "Document is required", when: () => false },
];
