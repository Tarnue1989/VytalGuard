/* =============================================
   Consultation Form Rules (Controller-aligned)
============================================= */

export const CONSULTATION_FORM_RULES = [
  /* ===============================
     Identity
  =============================== */
  { id: "patientInput", message: "Patient is required" },

  /* ===============================
     Status
  =============================== */
  {
    id: "status_open",
    message: "Consultation status is required",
    when: () => true,
  },

  /* ===============================
     Organization (superadmin only)
  =============================== */
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  /* ===============================
     Facility (facility-scoped users only)
  =============================== */
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
