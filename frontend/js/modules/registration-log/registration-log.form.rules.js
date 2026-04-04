// =============================================
// Registration Log Form Rules (Enterprise MASTER – FINAL SAFE)
// ✔ Payer type restricted
// ✔ Insurance enforced correctly
// ✔ Controller-aligned (no mismatch)
// =============================================

export const REGISTRATION_LOG_FORM_RULES = [
  /* ============================================================
     🧍 Patient / Registrar
  ============================================================ */
  { id: "patientInput", message: "Patient is required" },

  // Optional (auto-linked from user)
  { id: "registrarInput", message: "Registrar is required", when: () => false },

  /* ============================================================
     📋 Registration Details
  ============================================================ */
  {
    id: "registrationTypeSelect",
    message: "Registration type is required",
    when: () => true, // 🔥 REQUIRED (billing depends on it)
  },

  {
    id: "registrationMethod",
    message: "Registration method is required",
    when: () => true,
  },

  {
    id: "patientCategory",
    message: "Patient category is required",
    when: () => true,
  },

  // Optional business fields
  { id: "visitReason", message: "Visit reason is required", when: () => false },
  { id: "registrationSource", message: "Registration source is required", when: () => false },
  { id: "isEmergency", message: "Emergency status is required", when: () => false },
  { id: "notes", message: "Notes are required", when: () => false },

  /* ============================================================
     💳 PAYER TYPE (STRICT CONTROL)
     ✔ Dropdown only (no typing)
     ✔ Required to prevent mistakes
  ============================================================ */
  {
    id: "payerType",
    message: "Payer type is required",
    when: () => true,
  },

  /* ============================================================
     🛡️ INSURANCE (CONDITIONAL – STRICT)
     ✔ Required ONLY when payer = insurance
     ✔ Prevents backend validation failure
  ============================================================ */
  {
    id: "patientInsuranceSelect",
    message: "Insurance is required when payer type is Insurance",
    when: () => {
      const payer = document.getElementById("payerType")?.value;
      return payer === "insurance";
    },
  },

  /* ============================================================
     🏢 Organization (Superadmin only)
  ============================================================ */
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  /* ============================================================
     🏥 Facility (Facility-scoped users only)
  ============================================================ */
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