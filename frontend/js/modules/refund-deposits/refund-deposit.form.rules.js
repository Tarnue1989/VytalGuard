/* =============================================
   Deposit Refund Form Rules (Controller-aligned)
   MASTER PARITY (Deposit / Central Stock Pattern)
============================================= */

export const REFUND_DEPOSIT_FORM_RULES = [
  // ================= Identity =================
  {
    id: "patientInput",
    message: "Patient is required",
  },
  {
    id: "depositInput",
    message: "Deposit is required",
  },
  {
    id: "refund_amount",
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
