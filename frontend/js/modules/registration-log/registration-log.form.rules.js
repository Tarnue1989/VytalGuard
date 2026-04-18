// =============================================
// Registration Log Form Rules (Enterprise MASTER – FINAL FIXED)
// ✔ Controller-aligned (org/fac NOT validated)
// ✔ Hidden ID validation (patientId, registrarId)
// ✔ Billing-safe (registration type + payer)
// ✔ Clean conditional logic (no ghost errors)
// =============================================

export const REGISTRATION_LOG_FORM_RULES = [
  /* ============================================================
     🧍 Patient / Registrar
  ============================================================ */

  // ✅ MUST validate hidden ID (not text input)
  {
    id: "patientId",
    message: "Please select a patient from the list",
    when: () => true,
  },

  // Optional (auto-linked or manual)
  {
    id: "registrarId",
    message: "Registrar is required",
    when: () => false,
  },

  /* ============================================================
     📋 Registration Details (CORE REQUIRED)
  ============================================================ */

  {
    id: "registrationTypeSelect",
    message: "Registration type is required",
    when: () => true, // 🔥 REQUIRED FOR BILLING
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

  /* ============================================================
     📝 OPTIONAL FIELDS
  ============================================================ */

  {
    id: "visitReason",
    message: "Visit reason is required",
    when: () => false,
  },

  {
    id: "registrationSource",
    message: "Registration source is required",
    when: () => false,
  },

  {
    id: "isEmergency",
    message: "Emergency status is required",
    when: () => false,
  },

  {
    id: "notes",
    message: "Notes are required",
    when: () => false,
  },

  /* ============================================================
     💳 PAYER TYPE (REQUIRED)
  ============================================================ */

  {
    id: "payerType",
    message: "Payer type is required",
    when: () => true,
  },

  /* ============================================================
     🛡️ INSURANCE (STRICT CONDITIONAL)
  ============================================================ */

  {
    id: "patientInsuranceSelect",
    message: "Insurance is required when payer type is Insurance",
    when: () => {
      const payer = document.getElementById("payerType")?.value;
      const patientId = document.getElementById("patientId")?.value;

      // ✅ Only require if insurance AND patient selected
      return payer === "insurance" && !!patientId;
    },
  },

  /* ============================================================
     🏢 ORGANIZATION (REMOVED FROM VALIDATION)
     🏥 FACILITY (REMOVED FROM VALIDATION)
     ------------------------------------------------------------
     ❌ Backend forbids these fields (resolveOrgFacility)
     ❌ Never validate them on frontend
  ============================================================ */
];