// 📁 employee.form.rules.js
// =============================================
// Employee Form Rules (HTML + Controller aligned)
// =============================================

export const EMPLOYEE_FORM_RULES = [
  /* ================= Identity ================= */
  { id: "first_name", message: "First Name is required" },
  { id: "last_name", message: "Last Name is required" },
  { id: "gender", message: "Gender is required" },
  { id: "dob", message: "Date of Birth is required" },

  /* ================= Employment ================= */
  { id: "employee_no", message: "Employee Number is required" },
  { id: "position", message: "Position is required" },

  /* ================= Department (OPTIONAL) =================
     ✔ Controller allows NULL
     ✔ Frontend does NOT enforce
     ✔ Rule kept for future business enforcement
  ---------------------------------------------------------- */
  {
    id: "departmentSelect",
    message: "Department is required",
    when: () => true, // ✅ OPTIONAL → no frontend enforcement
  },

  /* ================= Organization =================
     User-controlled ONLY (superadmin)
     Backend resolves org for other roles
  -------------------------------------------------- */
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () => {
      const role = (localStorage.getItem("userRole") || "").toLowerCase();
      return role.includes("super");
    },
  },

  /* ================= Facility =================
     OPTIONAL on frontend
     Backend enforces position-based rules
     Frontend must NOT hardcode positions
  -------------------------------------------------- */
  {
    id: "facilitySelect",
    message: "Facility is required for this position",
    when: () => false, // ✅ backend owns this rule
  },
];
