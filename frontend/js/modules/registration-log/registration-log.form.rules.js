// =============================================
// Registration Log Form Rules (Enterprise Master Pattern)
// Controller-aligned • Role-aware • Rule-driven
// =============================================

export const REGISTRATION_LOG_FORM_RULES = [
  /* ============================================================
     🧍 Patient / Registrar
  ============================================================ */
  { id: "patientInput", message: "Patient is required" },

  // Optional for now (future-ready)
  { id: "registrarInput", message: "Registrar is required", when: () => false },

  /* ============================================================
     📋 Registration Details
  ============================================================ */
  {
    id: "registrationTypeSelect",
    message: "Registration type is required",
    when: () => true,
  },

  {
    id: "registrationMethod",
    message: "Registration method is required",
    when: () => true,
  },

  {
    id: "patientCategory",
    message: "Patient category is required",
    when: () => true,
  },

  // Optional / conditional business fields
  { id: "visitReason", message: "Visit reason is required", when: () => false },
  {
    id: "registrationSource",
    message: "Registration source is required",
    when: () => false,
  },
  { id: "isEmergency", message: "Emergency status is required", when: () => false },
  { id: "notes", message: "Notes are required", when: () => false },

  /* ============================================================
     🏢 Organization (Superadmin-only)
  ============================================================ */
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  /* ============================================================
     🏥 Facility (Facility-scoped users only)
     – Superadmin ❌
     – Org-level ❌
     – Facility-scoped ✅
  ============================================================ */
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
];
