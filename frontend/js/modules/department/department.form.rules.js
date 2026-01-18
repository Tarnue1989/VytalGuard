// =============================================
// Department Form Rules (Controller-aligned)
// =============================================

export const DEPARTMENT_FORM_RULES = [
  // Identity
  { id: "name", message: "Department name is required" },
  { id: "code", message: "Department code is required", when: () => false },
  { id: "description", message: "Description is required", when: () => false },
  { id: "headId", message: "Head of Department is required", when: () => false },

  // Status
  { id: "status_active", message: "Department status is required", when: () => true },

  // Organization (superadmin only)
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  // Facility (facility-scoped users only)
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
