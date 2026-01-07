// =============================================
// Registration Log Form Rules (Compact)
// =============================================

export const REGISTRATION_LOG_FORM_RULES = [
  { id: "patientInput", message: "Patient is required" },

  { id: "registrarInput", message: "Registrar is required", when: () => false },

  { id: "registrationTypeSelect", message: "Registration type is required", when: () => true },

  { id: "registrationMethod", message: "Registration method is required", when: () => true },

  { id: "patientCategory", message: "Patient category is required", when: () => true },

  { id: "visitReason", message: "Visit reason is required", when: () => false },

  { id: "registrationSource", message: "Registration source is required", when: () => false },

  { id: "isEmergency", message: "Emergency status is required", when: () => false },

  { id: "notes", message: "Notes are required", when: () => false },

  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "").toLowerCase().includes("super"),
  },

  { id: "facilitySelect", message: "Facility is required", when: () => false },
];
