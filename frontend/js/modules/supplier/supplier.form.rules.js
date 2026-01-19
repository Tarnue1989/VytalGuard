// =============================================
// Supplier Form Rules (Controller-aligned)
// =============================================

export const SUPPLIER_FORM_RULES = [
  // Supplier Info
  { id: "name", message: "Supplier name is required" },

  { id: "contact_name", message: "Contact person is required", when: () => false },
  { id: "contact_email", message: "Valid contact email is required", when: () => false },
  { id: "contact_phone", message: "Contact phone is required", when: () => false },
  { id: "address", message: "Address is required", when: () => false },
  { id: "notes", message: "Notes are required", when: () => false },

  // Status (defaulted but validated)
  { id: "status_active", message: "Supplier status is required", when: () => true },

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
