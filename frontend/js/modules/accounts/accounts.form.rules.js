/* =============================================
   Account Form Rules (LIGHT MASTER)
   Aligned with Account Controller + UI
============================================= */

export const ACCOUNT_FORM_RULES = [
  /* ================= Core ================= */

  {
    id: "account_number",
    message: "Account number is required",
  },

  {
    id: "name",
    message: "Account name is required",
  },

  {
    id: "type",
    message: "Account type is required",
  },

  {
    id: "currency",
    message: "Currency is required",
  },

  /* ================= Optional ================= */

  {
    id: "is_active",
    message: "Status is required",
  },

  /* ================= Scope ================= */

  // Organization → Superadmin only
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  // Facility → required for non-super users
  {
    id: "facilitySelect",
    message: "Facility is required",
    when: () => {
      const role = (localStorage.getItem("userRole") || "").toLowerCase();
      if (role.includes("super")) return false;
      return true;
    },
  },
];