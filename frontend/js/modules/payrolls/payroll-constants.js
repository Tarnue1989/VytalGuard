// 📦 payroll-constants.js – Enterprise MASTER–ALIGNED (Deposit → Payroll PARITY, FIXED)

export const FIELD_LABELS_PAYROLL = {
  payroll_number: "Payroll #",
  organization: "Organization",
  facility: "Facility",
  employee: "Employee",
  period: "Period",
  currency: "Currency",

  basic_salary: "Basic Salary",
  allowances: "Allowances",
  deductions: "Deductions",
  net_salary: "Net Salary",

  account: "Account",
  category: "Category",
  payment_method: "Payment Method",

  expense: "Expense",

  status: "Status",

  approved_at: "Approved At",
  paid_at: "Paid At",

  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  approvedBy: "Approved By",
  paidBy: "Paid By",
  voidedBy: "Voided By",
  voided_at: "Voided At",

  deletedBy: "Deleted By",
  deleted_at: "Deleted At",

  actions: "Actions",
};

export const FIELD_ORDER_PAYROLL = [
  "payroll_number",

  // org
  "organization",
  "facility",

  // employee
  "employee",
  "period",

  // financials
  "currency",
  "basic_salary",
  "allowances",
  "deductions",
  "net_salary",

  // payment config
  "account",
  "category",
  "payment_method",

  // links
  "expense",

  // lifecycle
  "status",
  "approved_at",
  "paid_at",

  // meta
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",

  // audit
  "approvedBy",
  "paidBy",
  "voidedBy",
  "voided_at",

  // system
  "deletedBy",
  "deleted_at",

  "actions",
];

export const FIELD_DEFAULTS_PAYROLL = {
  superadmin: [
    "payroll_number",
    "organization",
    "facility",
    "employee",
    "period",

    "currency",
    "basic_salary",
    "allowances",
    "deductions",
    "net_salary",

    "account",
    "category",
    "payment_method",

    "expense",

    "status",
    "approved_at",
    "paid_at",

    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",

    "approvedBy",
    "paidBy",
    "voidedBy",
    "voided_at",

    "deletedBy",
    "deleted_at",

    "actions",
  ],

  admin: [
    "payroll_number",
    "organization",
    "facility",
    "employee",
    "period",

    "currency",
    "basic_salary",
    "allowances",
    "deductions",
    "net_salary",

    "account",
    "category",
    "payment_method",

    "expense",

    "status",
    "approved_at",
    "paid_at",

    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",

    "approvedBy",
    "paidBy",
    "voidedBy",
    "voided_at",

    "actions",
  ],

  manager: [
    "payroll_number",
    "facility",
    "employee",
    "period",

    "currency",
    "basic_salary",
    "allowances",
    "deductions",
    "net_salary",

    "account",
    "category",
    "payment_method",

    "status",
    "approved_at",
    "paid_at",

    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",

    "actions",
  ],

  staff: [
    "payroll_number",
    "facility",
    "employee",
    "period",
    "net_salary",
    "currency",
    "status",
    "actions",
  ],
};

export const FIELD_GROUPS_PAYROLL = {
  org_scope: ["organization", "facility"],

  employee_info: ["employee", "period"],

  financials: [
    "currency",
    "basic_salary",
    "allowances",
    "deductions",
    "net_salary",
  ],

  payment_config: ["account", "category", "payment_method"],

  links: ["expense"],

  lifecycle: ["status", "approved_at", "paid_at"],

  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],

  audit: ["approvedBy", "paidBy", "voidedBy", "voided_at"],

  system: ["deletedBy", "deleted_at", "actions"],
};

export const MODULE_KEY_PAYROLL = "payrolls";
export const MODULE_LABEL_PAYROLL = "Payroll";

export default {
  FIELD_LABELS_PAYROLL,
  FIELD_ORDER_PAYROLL,
  FIELD_DEFAULTS_PAYROLL,
  FIELD_GROUPS_PAYROLL,
  MODULE_KEY_PAYROLL,
  MODULE_LABEL_PAYROLL,
};