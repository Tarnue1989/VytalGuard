// =============================================
// Billable Item Form Rules (Controller-aligned)
// =============================================

export const BILLABLE_ITEM_FORM_RULES = [
  // Identity
  { id: "masterItemSearch", message: "Master Item is required" },
  { id: "master_item_id", message: "Master Item selection is required" },
  { id: "name", message: "Billable item name is required", when: () => false },
  { id: "code", message: "Billable item code is required", when: () => false },
  { id: "description", message: "Description is required", when: () => false },

  // Category (autofill)
  { id: "category_id", message: "Category is required", when: () => false },

  // Pricing
  { id: "price", message: "Price is required" },
  { id: "currency", message: "Currency is required", when: () => false },

  // Flags
  { id: "taxable", message: "Taxable flag is required", when: () => false },
  { id: "discountable", message: "Discountable flag is required", when: () => false },
  { id: "overrideAllowed", message: "Override permission is required", when: () => false },

  // Status
  {
  id: "status",
    message: "Billable item status is required",
    when: () => true,
  },

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
      if (role.includes("super")) return true;
      if (role.includes("org")) return true;
      return true;
    },
  },
];
