// =============================================
// Insurance Provider Form Rules (Compact)
// =============================================

export const INSURANCE_PROVIDER_FORM_RULES = [
  { id: "name", message: "Provider Name is required" },

  {
    id: "status",
    message: "Status is required",
    when: () => true,
  },

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
    message: "Facility is required",
    when: () => false,
  },
];