// =============================================
// Master Item Category Form Rules (Controller-Aligned)
// =============================================
// 🔹 Includes order_type (NEW REQUIRED FIELD)
// 🔹 Matches backend validation exactly
// 🔹 Role-aware (superadmin / org-level / facility-level)
// =============================================

export const MASTER_ITEM_CATEGORY_FORM_RULES = [
  /* ===============================
     Identity
  =============================== */
  {
    id: "name",
    message: "Category name is required",
  },

  {
    id: "code",
    message: "Category code is required",
    when: () => false, // auto-generated / optional
  },

  {
    id: "description",
    message: "Description is required",
    when: () => false,
  },

  /* ===============================
     🔥 Order Type (REQUIRED)
  =============================== */
  {
    id: "orderType",
    message: "Order type is required",
    when: () => true,
  },

  /* ===============================
     Status
  =============================== */
  {
    id: "status_active",
    message: "Category status is required",
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
     Facility (facility-scoped users)
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