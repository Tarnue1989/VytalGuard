// 📁 backend/src/routes/liteRoutes.js
// ============================================================================
// 🔹 LITE ROUTES – High-Performance Autocomplete / Dropdown APIs
// 🔹 Small payloads, filtered, tenant-scoped
// 🔹 Used across forms for suggestion inputs & selects
// ============================================================================

import { Router } from "express";
import { verifyAuth } from "../middleware/verifyAuth.js";


// ============================================================================
// 📌 IMPORT CONTROLLERS — GROUPED BY DOMAIN
// ============================================================================

// -------------------------------
// 🔹 Feature Modules
// -------------------------------
import {
  getLiteFeatureModules,
  getLiteFeatureModuleCategories,
  getLiteParentModules,
} from "../controllers/featureController.js";

// -------------------------------
// 🔹 Core Entities
// -------------------------------
import { getAllRolesLite } from "../controllers/roleController.js";
import { getAllOrganizationsLite } from "../controllers/organizationController.js";
import { getAllUsersLite } from "../controllers/userController.js";
import { getAllFacilitiesLite } from "../controllers/facilityController.js";
import { getAllDepartmentsLite } from "../controllers/departmentController.js";
import { getUserFacilitiesLite } from "../controllers/userFacilityController.js";
import { getLitePermissions } from "../controllers/permissionController.js";
import { getLiteRolePermissions } from "../controllers/rolePermissionController.js";
import { EMPLOYEE_POSITIONS } from "../constants/enums.js";

// -------------------------------
// 🔹 Employees
// -------------------------------
import {
  getAllEmployeesLite,
  getAllEmployeesLiteWithEmail,
} from "../controllers/employeeController.js";

// -------------------------------
// 🔹 Items & Stock
// -------------------------------
import { getAllCategoriesLite } from "../controllers/masterItemCategoryController.js";
import { getAllItemsLite } from "../controllers/masterItemController.js";
import { getAllSuppliersLite } from "../controllers/supplierController.js";
import { getAllStocksLite } from "../controllers/centralStockController.js";
import { getAllDepartmentStocksLite } from "../controllers/departmentStockController.js";
import {
  getAllRequestsLite,
  getItemAvailabilityLite,
} from "../controllers/stockRequestController.js";
import { getAllBillableItemsLite } from "../controllers/billableItemController.js";

import { getAllPayrollsLite } from "../controllers/payrollController.js";

// -------------------------------
// 🔹 Patients & Registration
// -------------------------------
import {
  getAllPatientsLite,
  getAllPatientsLiteWithContact,
} from "../controllers/patientController.js";
import { getAllRegistrationLogsLite } from "../controllers/registrationLogController.js";

// -------------------------------
// 🔹 Billing & Finance
// -------------------------------
import { getAllInvoicesLite, getInvoiceItemsLite } from "../controllers/invoiceController.js";
import { getAllPaymentsLite } from "../controllers/paymentController.js";
import { getAllDepositsLite } from "../controllers/depositController.js";
import { getAllRefundsLite } from "../controllers/refundController.js";
import { getAllRefundDepositsLite } from "../controllers/refundDepositController.js";  // ✅ NEW
import { getAllPoliciesLite } from "../controllers/discountPolicyController.js";
import { getAllWaiversLite } from "../controllers/discountWaiverController.js";
import { getAllDiscountsLite } from "../controllers/discountController.js";
import { getAllAutoBillingRulesLite } from "../controllers/autoBillingRuleController.js";
import { getAllBillingTriggersLite } from "../controllers/billingTriggerController.js";
import { getAllInsuranceProvidersLite } from "../controllers/insuranceProviderController.js";
import { getAllInsuranceClaimsLite } from "../controllers/insuranceClaimController.js";
import { getAllPatientInsurancesLite } from "../controllers/patientInsuranceController.js";

import { getAllAccountsLite } from "../controllers/accountController.js";
import { getAllExpensesLite } from "../controllers/expenseController.js";

import {
  getAllOrdersLite,
  getAllOrderItemsLite,
} from "../controllers/orderController.js";
// -------------------------------
// 🔹 Consultations & Appointments
// -------------------------------
import { getAllConsultationsLite } from "../controllers/consultationController.js";
import { getAllAppointmentsLite } from "../controllers/appointmentController.js";
import { getAllRecommendationsLite } from "../controllers/recommendationController.js";
import { getAllTriageRecordsLite } from "../controllers/triageRecordController.js";
import { getAllVitalsLite } from "../controllers/vitalController.js";

// -------------------------------
// 🔹 Labs
// -------------------------------
import {
  getAllLabRequestsLite,
  getAllLabRequestItemsLite,
} from "../controllers/labRequestController.js";
import { getAllLabResultsLite } from "../controllers/labResultController.js";

// -------------------------------
// 🔹 Maternity / Delivery / Medical Records
// -------------------------------
import { getAllMaternityVisitsLite } from "../controllers/maternityVisitController.js";
import { getAllDeliveryRecordsLite } from "../controllers/deliveryRecordController.js";
import { getAllNewbornRecordsLite } from "../controllers/newbornRecordController.js";
import { getAllMedicalRecordsLite } from "../controllers/medicalRecordController.js";

// -------------------------------
// 🔹 Prescriptions & Pharmacy
// -------------------------------
import { getAllPrescriptionsLite, getAllPrescriptionItemsLite } from "../controllers/prescriptionController.js";
import {
  getAllPharmacyTransactionsLite,
  getAllPharmacyTransactionItemsLite,
} from "../controllers/pharmacyTransactionController.js";

// -------------------------------
// 🔹 Diagnostics
// -------------------------------
import { getAllUltrasoundsLite } from "../controllers/ultrasoundRecordController.js";
import { getAllEKGRecordsLite } from "../controllers/ekgRecordController.js";

// -------------------------------
// 🔹 Surgeries
// -------------------------------
import { getAllSurgeriesLite } from "../controllers/surgeryController.js";

const router = Router();

// ============================================================================
// 📌 LITE ROUTES — AUTOCOMPLETE / DROPDOWNS
// ============================================================================

// -------------------------------
// 🔹 Feature Modules
// -------------------------------
router.get("/feature-modules", verifyAuth, getLiteFeatureModules);
router.get("/feature-module-categories", verifyAuth, getLiteFeatureModuleCategories);
router.get("/feature-module-parents", verifyAuth, getLiteParentModules);

// -------------------------------
// 🔹 Core
// -------------------------------
router.get("/roles", verifyAuth, getAllRolesLite);
router.get("/organizations", verifyAuth, getAllOrganizationsLite);
router.get("/users", verifyAuth,  getAllUsersLite);
router.get("/facilities", verifyAuth, getAllFacilitiesLite);
router.get("/departments", verifyAuth, getAllDepartmentsLite);
router.get("/user-facilities", verifyAuth, getUserFacilitiesLite);
router.get("/permissions", verifyAuth, getLitePermissions);
router.get("/role-permissions", verifyAuth, getLiteRolePermissions);

// -------------------------------
// 🔹 Employees
// -------------------------------
router.get("/employees", verifyAuth, getAllEmployeesLite);
router.get("/employees/email", verifyAuth, getAllEmployeesLiteWithEmail);
router.get("/employee-positions", verifyAuth, (req, res) =>
  res.json({
    success: true,
    data: EMPLOYEE_POSITIONS.map((p) => ({ id: p, name: p })),
  })
);

// -------------------------------
// 🔹 Items / Stock
// -------------------------------
router.get("/master-item-categories", verifyAuth, getAllCategoriesLite);
router.get("/master-items", verifyAuth, getAllItemsLite);
router.get("/suppliers", verifyAuth, getAllSuppliersLite);
router.get("/central-stocks", verifyAuth, getAllStocksLite);
router.get("/department-stocks", verifyAuth,  getAllDepartmentStocksLite);
router.get("/stock-requests", verifyAuth, getAllRequestsLite);
router.get("/item-availability", verifyAuth, getItemAvailabilityLite);
router.get("/billable-items", verifyAuth, getAllBillableItemsLite);

// -------------------------------
// 🔹 Patients & Registration
// -------------------------------
router.get("/patients", verifyAuth, getAllPatientsLite);
router.get("/patients/contact", verifyAuth, getAllPatientsLiteWithContact);
router.get("/registration-logs", verifyAuth, getAllRegistrationLogsLite);

// -------------------------------
// 🔹 Billing & Finance
// -------------------------------
router.get("/invoices", verifyAuth, getAllInvoicesLite);
router.get("/invoices/:id/items", verifyAuth, getInvoiceItemsLite);
router.get("/payments", verifyAuth, getAllPaymentsLite);
router.get("/deposits", verifyAuth, getAllDepositsLite);
router.get("/refunds", verifyAuth, getAllRefundsLite);
router.get("/refund-deposits", verifyAuth, getAllRefundDepositsLite);
router.get("/discount-policies", verifyAuth, getAllPoliciesLite);
router.get("/discount-waivers", verifyAuth, getAllWaiversLite);
router.get("/discounts", verifyAuth, getAllDiscountsLite);
router.get("/auto-billing-rules", verifyAuth, getAllAutoBillingRulesLite);
router.get("/billing-triggers", verifyAuth, getAllBillingTriggersLite); // ✅ ADD
router.get("/insurance-claims", verifyAuth, getAllInsuranceClaimsLite);
router.get("/patient-insurances", verifyAuth, getAllPatientInsurancesLite);
router.get("/orders", verifyAuth, getAllOrdersLite);
router.get("/order-items", verifyAuth, getAllOrderItemsLite);


router.get("/accounts", verifyAuth, getAllAccountsLite);
router.get("/expenses", verifyAuth, getAllExpensesLite);
router.get("/payrolls", verifyAuth, getAllPayrollsLite);
// -------------------------------
// 🔹 Consultations & Appointments
// -------------------------------
router.get("/consultations", verifyAuth, getAllConsultationsLite);
router.get("/appointments", verifyAuth, getAllAppointmentsLite);
router.get("/recommendations", verifyAuth, getAllRecommendationsLite);
router.get("/triage-records", verifyAuth, getAllTriageRecordsLite);
router.get("/vitals", verifyAuth, getAllVitalsLite);

// -------------------------------
// 🔹 Labs
// -------------------------------
router.get("/lab-requests", verifyAuth, getAllLabRequestsLite);
router.get("/lab-request-items", verifyAuth, getAllLabRequestItemsLite);
router.get("/lab-results", verifyAuth, getAllLabResultsLite);

// -------------------------------
// 🔹 Maternity / Medical Records
// -------------------------------
router.get("/maternity-visits", verifyAuth, getAllMaternityVisitsLite);
router.get("/delivery-records", verifyAuth, getAllDeliveryRecordsLite);
router.get("/newborn-records", verifyAuth, getAllNewbornRecordsLite);
router.get("/medical-records", verifyAuth, getAllMedicalRecordsLite);

// -------------------------------
// 🔹 Prescriptions & Pharmacy
// -------------------------------
router.get("/prescriptions", verifyAuth, getAllPrescriptionsLite);
router.get("/prescription-items", verifyAuth, getAllPrescriptionItemsLite);
router.get("/pharmacy-transactions", verifyAuth, getAllPharmacyTransactionsLite);
router.get("/pharmacy-transaction-items", verifyAuth, getAllPharmacyTransactionItemsLite);
router.get("/insurance-providers", verifyAuth, getAllInsuranceProvidersLite);


// -------------------------------
// 🔹 Diagnostics
// -------------------------------
router.get("/ultrasound-records", verifyAuth, getAllUltrasoundsLite);
router.get("/ekg-records", verifyAuth, getAllEKGRecordsLite);

// -------------------------------
// 🔹 Surgeries
// -------------------------------
router.get("/surgeries", verifyAuth, getAllSurgeriesLite);

export default router;
