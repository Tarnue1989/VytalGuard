// 📦 patient-insurance-form-rules.js – Enterprise MASTER–ALIGNED (Patient Insurance)
// ============================================================================
// 🔹 Converted from: insurance-claim-form-rules.js
// 🔹 Aligned with patientInsuranceController
// 🔹 Pattern: Payment / Deposit / Claim → adapted for Policy logic
// ============================================================================

export const PATIENT_INSURANCE_FORM_RULES = [
  /* ================= Identity ================= */
  {
    id: "patientInput",
    message: "Patient is required",
  },
  {
    id: "providerInput",
    message: "Insurance provider is required",
  },
  {
    id: "policyNumber",
    message: "Policy number is required",
  },

  /* ================= Policy Info ================= */
  {
    id: "planName",
    message: "Plan name is required",
    when: () => {
      const val = document.getElementById("planName")?.value;
      return val !== undefined && val.trim() === "";
    },
  },

  /* ================= Coverage ================= */
  {
    id: "coverageLimit",
    message: "Coverage limit cannot be negative",
    when: () => {
      const v = Number(document.getElementById("coverageLimit")?.value || 0);
      return v < 0;
    },
  },
  {
    id: "currencySelect",
    message: "Currency is required",
  },

  /* ================= Validity ================= */
  {
    id: "validFrom",
    message: "Valid From date is required",
  },
  {
    id: "validTo",
    message: "Valid To date must be after Valid From",
    when: () => {
      const from = document.getElementById("validFrom")?.value;
      const to = document.getElementById("validTo")?.value;
      if (!from || !to) return false;
      return new Date(to) < new Date(from);
    },
  },

  /* ================= Conditional ================= */
  {
    id: "notes",
    message: "Notes required when coverage limit is very high",
    when: () => {
      const limit = Number(document.getElementById("coverageLimit")?.value || 0);
      return limit > 100000;
    },
  },

  /* ================= Scope ================= */
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
];