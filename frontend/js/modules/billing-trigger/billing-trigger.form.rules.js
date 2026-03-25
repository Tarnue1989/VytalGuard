// =============================================
// Billing Trigger Form Rules (ENTERPRISE FINAL)
// =============================================
// 🔹 HTML + Controller aligned
// 🔹 Selective parity with Billable Item form rules
// 🔹 NO phantom fields
// 🔹 Role-aware, minimal, future-safe
// =============================================

export const BILLING_TRIGGER_FORM_RULES = [
  /* ================= Trigger Definition ================= */
  {
    id: "module_key",
    message: "Module Key is required",
  },
  {
    id: "trigger_status",
    message: "Trigger Status is required",
  },

  /* ================= Organization (Superadmin only) ================= */
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  /* ================= Facility ================= */
  {
    id: "facilitySelect",
    message: "Facility is required",
    when: () => false, // not required by controller
  },
];
