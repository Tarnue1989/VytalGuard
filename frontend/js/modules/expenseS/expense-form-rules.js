/* =============================================
   Expense Form Rules (FINAL – AUTO GEN SAFE)
   ✔ expense_number removed (backend generated)
   ✔ Controller-aligned
   ✔ Lifecycle-safe
============================================= */

export const EXPENSE_FORM_RULES = [
  /* ================= Identity ================= */

  {
    id: "date",
    message: "Date is required",
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
    id: "categorySelect",
    message: "Category is required",
  },

  {
    id: "paymentMethodSelect",
    message: "Payment method is required",
  },

  {
    id: "accountSelect",
    message: "Account is required",
  },

  /* ================= Optional ================= */

  {
    id: "description",
    message: "Description is recommended",
    optional: true,
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
      return !role.includes("super");
    },
  },

  /* ================= Lifecycle Safety ================= */

  {
    id: "formGuard",
    message: "Posted or voided expenses cannot be edited",
    when: () => {
      const payload = JSON.parse(
        sessionStorage.getItem("expenseEditPayload") || "{}"
      );
      const status = (payload?.status || "").toLowerCase();
      return ["posted", "voided"].includes(status);
    },
    block: true,
  },
];