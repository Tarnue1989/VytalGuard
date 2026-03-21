// 📁 autoBillingRule-form-rules.js
// ============================================================================
// 💰 AUTO BILLING RULE FORM RULES (ENTERPRISE MASTER–ALIGNED)
// ----------------------------------------------------------------------------
// 🔹 Based on LAB REQUEST RULE MASTER
// 🔹 Controller-faithful (NO over-validation)
// 🔹 Rule-driven (validateUsingRules)
// 🔹 Role-aware scope enforcement
// 🔹 Supports suggestion + select + checkbox patterns
// ============================================================================

export const AUTO_BILLING_RULE_FORM_RULES = [
  // ================= Identity =================
  {
    id: "featureModuleSelect",
    message: "Feature module is required",
  },

  {
    id: "billableItemSelect",
    message: "Billable item is required",
  },

  // ================= Rule Configuration =================
  {
    id: "chargeMode",
    message: "Charge mode is required",
  },

  {
    id: "defaultPrice",
    message: "Default price must be valid",
    when: () => false, // optional per controller (can be null)
  },

  {
    id: "autoGenerate",
    message: "Auto generate flag is required",
    when: () => false, // optional checkbox (defaults true backend)
  },

  // ================= Derived / Display =================
  {
    id: "triggerModuleInput",
    message: "Trigger module must be resolved",
    when: () => false, // auto-filled, not user-required
  },

  // ================= Scope =================
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

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

  // ================= System / Hidden =================
  {
    id: "status_active",
    message: "Status is required",
    when: () => false, // backend controlled
  },
];