// =============================================
// Patient Form Rules (HTML + Controller aligned)
// =============================================

export const PATIENT_FORM_RULES = [
  /* ===== Identity ===== */
  { id: "first_name", message: "First Name is required" },
  { id: "last_name", message: "Last Name is required" },

  { id: "pat_no", message: "Patient Number is required", when: () => false },
  { id: "gender", message: "Gender is required", when: () => true },
  { id: "date_of_birth", message: "Date of Birth is required", when: () => true },

  /* ===== Contact ===== */
  { id: "phone_number", message: "Phone number is required", when: () => false },
  { id: "email_address", message: "Email is required", when: () => false },
  { id: "home_address", message: "Address is required", when: () => false },

  /* ===== Social & Identifiers ===== */
  { id: "marital_status", message: "Marital status is required", when: () => false },
  { id: "religion", message: "Religion is required", when: () => false },
  { id: "profession", message: "Profession is required", when: () => false },
  { id: "national_id", message: "National ID is required", when: () => false },
  { id: "insurance_number", message: "Insurance number is required", when: () => false },
  { id: "passport_number", message: "Passport number is required", when: () => false },

  /* ===== Emergency ===== */
  { id: "emergency_contact_name", message: "Emergency contact name is required", when: () => false },
  { id: "emergency_contact_phone", message: "Emergency contact phone is required", when: () => false },

  /* ===== Notes ===== */
  { id: "notes", message: "Notes are required", when: () => false },

  /* ===== Organization (superadmin only) ===== */
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () => (localStorage.getItem("userRole") || "").toLowerCase().includes("super"),
  },

  /* ===== Facility ===== */
  { id: "facilitySelect", message: "Facility is required", when: () => false },

  /* ===== Uploads ===== */
  { id: "photoInput", message: "Profile photo is required", when: () => false },
];
