// =============================================
// Billing Trigger Form Rules (HTML + Controller aligned)
// =============================================

export const BILLING_TRIGGER_FORM_RULES = [
  /* ===== Trigger Definition ===== */
  { id: "module_key", message: "Module Key is required" },
  { id: "trigger_status", message: "Trigger Status is required" },

  /* ===== Status ===== */
  { id: "is_active", message: "Active status is required", when: () => false },

  /* ===== Organization (superadmin only) ===== */
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  /* ===== Facility ===== */
  {
    id: "facilitySelect",
    message: "Facility is required",
    when: () => false,
  },
];
