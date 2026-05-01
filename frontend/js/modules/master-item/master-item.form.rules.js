// =============================================
// Master Item Form Rules (Controller-aligned)
// =============================================

export const MASTER_ITEM_FORM_RULES = [
  /* =========================
     Identity
  ========================= */
  { id: "name", message: "Item name is required" },

  { id: "code", message: "Item code is required", when: () => false },

  {
    id: "itemType",
    message: "Item type is required",
    when: () => false, // 🔒 controlled by system, not user
  },

  {
    id: "categorySelect",
    message: "Category is required", // optional: set when false if matching backend
  },

  {
    id: "featureModuleSelect", // ✅ FIXED ID
    message: "Feature module is required",
    when: () => true, // ✅ backend allows null
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