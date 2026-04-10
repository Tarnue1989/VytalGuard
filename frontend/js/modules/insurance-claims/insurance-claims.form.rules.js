/* =============================================
   Insurance Claim Form Rules (MASTER PARITY)
   Aligned with Insurance Claim Controller + UI
   Pattern: Payment / Deposit / Refund
============================================= */

export const INSURANCE_CLAIM_FORM_RULES = [
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
    id: "invoiceSelect",
    message: "Invoice is required",
  },
  {
    id: "claimNumber",
    message: "Claim number is required",
  },
  {
    id: "amountClaimed",
    message: "Amount claimed is required",
  },
  {
    id: "currencySelect",
    message: "Currency is required",
  },

  /* ================= Optional Financial ================= */
  {
    id: "amountApproved",
    message: "Approved amount cannot exceed claimed amount",
    when: () => {
      const claimed = Number(document.getElementById("amountClaimed")?.value || 0);
      const approved = Number(document.getElementById("amountApproved")?.value || 0);
      return approved > claimed;
    },
  },
  {
    id: "amountPaid",
    message: "Paid amount cannot exceed approved amount",
    when: () => {
      const approved = Number(document.getElementById("amountApproved")?.value || 0);
      const paid = Number(document.getElementById("amountPaid")?.value || 0);
      return approved && paid > approved;
    },
  },

  /* ================= Conditional ================= */
  {
    id: "paymentReference",
    message: "Payment reference is required when payment is entered",
    when: () => {
      const paid = document.getElementById("amountPaid")?.value;
      return !!paid;
    },
  },

  /* ================= Status-based ================= */
  {
    id: "rejectionReason",
    message: "Rejection reason is required when claim is rejected",
    when: () => {
      const status = document.getElementById("statusSelect")?.value;
      return status === "rejected";
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