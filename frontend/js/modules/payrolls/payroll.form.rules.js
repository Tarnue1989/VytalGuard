/* =============================================
   Payroll Form Rules (MASTER PARITY – Controller Aligned)
   ✅ Added payment config (REQUIRED by backend)
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

  /* ================= PAYMENT CONFIG (REQUIRED) ================= */
  {
    id: "accountSelect",
    message: "Account is required",
  },

  {
    id: "paymentMethodSelect",
    message: "Payment method is required",
  },

  {
    id: "categorySelect",
    message: "Category is required",
    optional: true, // backend defaults to "salary"
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
      return true;
    },
  },
];