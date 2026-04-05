/* =============================================
   Payment Form Rules (MASTER PARITY)
   Aligned with Payment Controller + UI
   Pattern: Deposit / Refund / EKG
   🔹 FIXED: currency required (matches backend)
============================================= */

export const PAYMENT_FORM_RULES = [
  /* ================= Identity ================= */
  {
    id: "patientInput",
    message: "Patient is required",
  },
  {
    id: "invoiceSelect",
    message: "Invoice is required",
  },
  {
    id: "amount",
    message: "Amount is required",
  },
  {
    id: "currencySelect", // ✅ ADDED
    message: "Currency is required",
  },
  {
    id: "methodSelect",
    message: "Payment method is required",
  },

  /* ================= Transaction ================= */
  {
    id: "transactionRef",
    message: "Transaction reference is required",
    when: () => {
      const method = document.getElementById("methodSelect")?.value;
      return ["card", "bank_transfer", "mobile_money", "cheque"].includes(method);
    },
  },

  /* ================= Edit Only ================= */
  {
    id: "reason",
    message: "Reason is required when updating a payment",
    when: () => {
      const isEdit =
        !!sessionStorage.getItem("paymentEditId") ||
        !!new URLSearchParams(window.location.search).get("id");
      return isEdit;
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