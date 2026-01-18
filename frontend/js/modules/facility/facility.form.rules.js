// =============================================
// Facility Form Rules (Compact)
// =============================================

export const FACILITY_FORM_RULES = [
  { id: "name", message: "Facility Name is required" },

  {
    id: "code",
    message: "Facility Code is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  { id: "status", message: "Status is required", when: () => true },

  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },
];
