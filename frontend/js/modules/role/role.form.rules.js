// =============================================
// Role Form Rules (Compact)
// =============================================

export const ROLE_FORM_RULES = [
  { id: "name", message: "Role Name is required" },
  { id: "code", message: "Role Code is required" },

  { id: "is_system", message: "Role Type is required", when: () => true },
  { id: "status", message: "Status is required", when: () => true },

  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  { id: "facilitySelect", message: "Facility is required", when: () => false },
];
