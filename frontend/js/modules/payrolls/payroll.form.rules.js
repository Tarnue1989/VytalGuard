/* =============================================
   Payroll Form Rules (MASTER PARITY – FINAL)
   ✅ Controller aligned
   ✅ Currency-aware accounts
   ✅ Superadmin-only tenant fields
============================================= */

export const PAYROLL_FORM_RULES = [
  /* ================= Identity ================= */
  {
    id: "employeeInput",
    message: "Employee is required",
  },

  {
    id: "period",
    message: "Payroll period is required",
  },

  {
    id: "payrollNumber",
    message: "Payroll number is required",
  },

  /* ================= Financial ================= */
  {
    id: "basicSalary",
    message: "Basic salary is required",
  },

  {
    id: "currencySelect",
    message: "Currency is required",
  },

  /* ================= PAYMENT CONFIG ================= */
  {
    id: "accountSelect",
    message: "Account is required",
  },

  {
    id: "paymentMethodSelect",
    message: "Payment method is required",
  },

  /* ==================================================
     Optional because backend defaults to "salary"
  ================================================== */
  {
    id: "categorySelect",
    message: "Category is required",
    optional: true,
  },

  /* ================= Optional ================= */
  {
    id: "allowances",
    message: "Allowances must be valid",
    optional: true,
  },

  {
    id: "deductions",
    message: "Deductions must be valid",
    optional: true,
  },

  {
    id: "description",
    message: "Description is required when editing payroll",
    when: () => {
      const isEdit =
        !!sessionStorage.getItem("payrollEditId") ||
        !!new URLSearchParams(window.location.search).get("id");

      return isEdit;
    },
  },

  /* ================= SUPERADMIN ONLY ================= */
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  /* ==================================================
     Facility OPTIONAL even for superadmin
     Backend allows null facility_id
  ================================================== */
];