/* =============================================
   Deposit Form Rules (MASTER PARITY)
   Aligned with Deposit Controller + UI
============================================= */

export const DEPOSIT_FORM_RULES = [
  /* ================= Identity ================= */
  {
    id: "patientInput",
    message: "Patient is required",
  },

  {
    id: "amount",
    message: "Amount is required",
  },

  {
    id: "currencySelect",
    message: "Currency is required",
  },

  {
    id: "methodSelect",
    message: "Payment method is required",
  },

  {
    id: "transactionRef",
    message: "Transaction reference is required",
  },

  /* ================= Optional / Conditional ================= */

  // Reason → REQUIRED only in EDIT mode
  {
    id: "reason",
    message: "Reason is required when editing a deposit",
    when: () => {
      const isEdit =
        !!sessionStorage.getItem("depositEditId") ||
        !!new URLSearchParams(window.location.search).get("id");
      return isEdit;
    },
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

  // Facility → required for everyone except super without org context
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