// =============================================
// Master Item Form Rules (Controller-aligned)
// =============================================

export const MASTER_ITEM_FORM_RULES = [
  /* =========================
     Identity
  ========================= */
  { id: "name", message: "Item name is required" },

  // Code is auto-generated on backend
  { id: "code", message: "Item code is required", when: () => false },

  { id: "itemType", message: "Item type is required" },

  {
    id: "categorySelect",
    message: "Category is required",
  },

  {
    id: "featureModuleId",
    message: "Feature module is required",
  },

  /* =========================
     Status
  ========================= */
  {
    id: "status_active",
    message: "Item status is required",
    when: () => true,
  },

  /* =========================
     Organization (superadmin only)
  ========================= */
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  /* =========================
     Facility (facility-scoped users only)
  ========================= */
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
