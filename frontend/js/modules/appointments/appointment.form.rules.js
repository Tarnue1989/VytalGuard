// =============================================
// Appointment Form Rules (HTML + Controller aligned)
// =============================================
// 🧭 Aligned to MASTER form-rules pattern
// 🔹 Conditional validation via when()
// 🔹 Preserves existing DOM IDs exactly
// 🔹 Safe for add & edit appointment forms
// =============================================

export const APPOINTMENT_FORM_RULES = [
  /* ============================================================
     👤 Participants
  ============================================================ */

  {
    id: "patientInput",
    message: "Patient is required",
    when: () => true,
  },
  {
    id: "patientId",
    message: "Patient selection is required",
    when: () => true,
  },
  {
    id: "doctorInput",
    message: "Doctor is required",
    when: () => true,
  },
  {
    id: "doctorId",
    message: "Doctor selection is required",
    when: () => true,
  },

  {
    id: "departmentSelect",
    message: "Department selection is invalid",
    when: () => false,
  },

  /* ============================================================
     🗓️ Schedule
  ============================================================ */

  {
    id: "dateTime",
    message: "Appointment date and time is required",
    when: () => true,
  },

  /* ============================================================
     📝 Notes (optional)
  ============================================================ */

  {
    id: "notes",
    message: "Notes value is invalid",
    when: () => false,
  },

  /* ============================================================
     🏢 Organization Scope
  ============================================================ */

  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  {
    id: "facilitySelect",
    message: "Facility selection is invalid",
    when: () => false,
  },
];
