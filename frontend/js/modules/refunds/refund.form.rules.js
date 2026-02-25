/* =============================================
   Refund Form Rules (Controller-aligned)
   MASTER PARITY (Payment / Deposit Refund)
============================================= */

export const REFUND_FORM_RULES = [
  // ================= Identity =================
  {
    id: "patientInput",
    message: "Patient is required",
  },
  {
    id: "paymentSelect",
    message: "Payment is required",
  },
  {
    id: "amount",
    message: "Refund amount is required",
  },
  {
    id: "methodSelect",
    message: "Refund method is required",
  },
  {
    id: "reason",
    message: "Reason is required",
  },

  // ================= Derived / Hidden =================
  {
    id: "invoiceId",
    message: "Invoice is required",
    when: () => {
      // Invoice is auto-derived from selected payment
      return true;
    },
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
];
