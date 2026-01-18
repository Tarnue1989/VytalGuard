// =============================================
// Organization Form Rules (Enterprise-Aligned)
// =============================================
// 🔹 Pattern Source: ROLE_FORM_RULES (Master)
// 🔹 Purpose: Client-side form validation contract
// 🔹 Scope: Add / Edit Organization
// 🔹 IDs strictly match Organization HTML
// 🔹 Conditional logic preserved (role-aware)
// =============================================

export const ORGANIZATION_FORM_RULES = [
  {
    id: "name",
    message: "Organization Name is required",
  },

  {
    id: "code",
    message: "Organization Code is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  {
    id: "status",
    message: "Status is required",
    when: () => true,
  },
];
