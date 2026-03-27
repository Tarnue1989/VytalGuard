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
  {
    id: "featureModuleSelect",
    message: "Feature module is required",
  },

  {
    id: "billablePillsContainer",
    message: "At least one billable item is required",
  },

  {
    id: "chargeMode",
    message: "Charge mode is required",
  },

  {
    id: "defaultPrice",
    message: "Default price must be valid",
    when: () => false,
  },

  {
    id: "autoGenerate",
    message: "Auto generate flag is required",
    when: () => false,
  },

  {
    id: "triggerModuleInput",
    message: "Trigger module must be resolved",
    when: () => false,
  },

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

  {
    id: "status_active",
    message: "Status is required",
    when: () => false,
  },
];