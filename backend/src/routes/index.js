// 📁 backend/src/routes/index.js
import { Router } from "express";
import { ping, ready } from "../controllers/healthController.js";

/* ============================================================
   📌 Core Feature Routers
============================================================ */
import authRoutes from "./authRoutes.js";
import featureRoutes from "./featureRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";

/* ============================================================
   📌 Entity Management (ORG → USERS → ACCESS CONTROL)
============================================================ */
import organizationRoutes from "./organizationRoutes.js";
import facilityRoutes from "./facilityRoutes.js";
import departmentRoutes from "./departmentRoutes.js";

import employeeRoutes from "./employeeRoutes.js";
import userRoutes from "./userRoutes.js";
import userFacilityRoutes from "./userFacilityRoutes.js";
import patientRoutes from "./patientRoutes.js";

import roleRoutes from "./roleRoutes.js";
import permissionRoutes from "./permissionRoutes.js";
import rolePermissionRoutes from "./rolePermissionRoutes.js";

import organizationBrandingRoutes from "./organizationBrandingRoutes.js";

import fxRoutes from "./fxRoutes.js";

/* ============================================================
   📦 Inventory & Items
============================================================ */
import masterItemCategoryRoutes from "./masterItemCategoryRoutes.js";
import masterItemRoutes from "./masterItemRoutes.js";
import supplierRoutes from "./supplierRoutes.js";
import centralStockRoutes from "./centralStockRoutes.js";
import departmentStockRoutes from "./departmentStockRoutes.js";
import stockRequestRoutes from "./stockRequestRoutes.js";
import billableItemRoutes from "./billableItemRoutes.js";

/* ============================================================
   🏥 Clinical Records
============================================================ */
import registrationLogRoutes from "./registrationLogRoutes.js";
import consultationRoutes from "./consultationRoutes.js";
import appointmentRoutes from "./appointmentRoutes.js";
import recommendationRoutes from "./recommendationRoutes.js";
import triageRecordRoutes from "./triageRecordRoutes.js";
import vitalRoutes from "./vitalRoutes.js";
import currencyRateRoutes from "./currencyRateRoutes.js";

import labRequestRoutes from "./labRequestRoutes.js";
import labResultRoutes from "./labResultRoutes.js";

import maternityVisitRoutes from "./maternityVisitRoutes.js";
import deliveryRecordRoutes from "./deliveryRecordRoutes.js";
import newbornRecordRoutes from "./newbornRecordRoutes.js";

import medicalRecordRoutes from "./medicalRecordRoutes.js";
import prescriptionRoutes from "./prescriptionRoutes.js";
import pharmacyTransactionRoutes from "./pharmacyTransactionRoutes.js";

import ultrasoundRecordRoutes from "./ultrasoundRecordRoutes.js";
import ekgRecordRoutes from "./ekgRecordRoutes.js";
import surgeryRoutes from "./surgeryRoutes.js";

import patientChartRoutes from "./patientChartRoutes.js";

/* ============================================================
   💰 Billing & Finance
============================================================ */
import invoiceRoutes from "./invoiceRoutes.js";
import paymentRoutes from "./paymentRoutes.js";
import depositRoutes from "./depositRoutes.js";

import refundRoutes from "./refundRoutes.js";
import refundDepositRoutes from "./refundDepositRoutes.js";

import discountPolicyRoutes from "./discountPolicyRoutes.js";
import discountWaiverRoutes from "./discountWaiverRoutes.js";
import discountRoutes from "./discountRoutes.js";

import autoBillingRuleRoutes from "./autoBillingRuleRoutes.js";
import billingTriggerRoutes from "./billingTriggerRoutes.js";

import orderRoutes from "./orderRoutes.js";
import insuranceProviderRoutes from "./insuranceProviderRoutes.js";
import insuranceClaimRoutes from "./insuranceClaimRoutes.js";
import patientInsuranceRoutes from "./patientInsuranceRoutes.js";

import accountRoutes from "./accountRoutes.js";
import expenseRoutes from "./expenseRoutes.js";
import cashLedgerRoutes from "./cashLedgerRoutes.js";
import cashClosingRoutes from "./cashClosingRoutes.js";
import payrollRoutes from "./payrollRoutes.js";

/* ============================================================
   ⚡ Lite Routes (Autocomplete / Dropdown APIs)
============================================================ */
import liteRoutes from "./liteRoutes.js";

/* ============================================================
   📊 Reports & Analytics
============================================================ */
import reportRoutes from "./reportRoutes.js";

/* ============================================================
   🛠 Debug
============================================================ */
import debugRoutes from "./debugRoutes.js";

const router = Router();

/* ============================================================
   📌 Health Checks
============================================================ */
router.get("/health", ping);
router.get("/ready", ready);

/* ============================================================
   📌 Core Routes
============================================================ */
router.use("/auth", authRoutes);
router.use("/features", featureRoutes);
router.use("/dashboard", dashboardRoutes);

/* ============================================================
   📌 Entity Management
============================================================ */
router.use("/organizations", organizationRoutes);
router.use("/facilities", facilityRoutes);
router.use("/departments", departmentRoutes);

router.use("/employees", employeeRoutes);
router.use("/users", userRoutes);
router.use("/user-facilities", userFacilityRoutes);
router.use("/patients", patientRoutes);

router.use("/roles", roleRoutes);
router.use("/permissions", permissionRoutes);
router.use("/role-permissions", rolePermissionRoutes);

router.use("/organization-branding", organizationBrandingRoutes);

/* ============================================================
   📦 Inventory & Items
============================================================ */
router.use("/master-item-categories", masterItemCategoryRoutes);
router.use("/master-items", masterItemRoutes);
router.use("/suppliers", supplierRoutes);
router.use("/central-stocks", centralStockRoutes);
router.use("/department-stocks", departmentStockRoutes);
router.use("/stock-requests", stockRequestRoutes);
router.use("/billable-items", billableItemRoutes);

/* ============================================================
   🏥 Clinical Records
============================================================ */
router.use("/registration-logs", registrationLogRoutes);
router.use("/consultations", consultationRoutes);
router.use("/appointments", appointmentRoutes);
router.use("/recommendations", recommendationRoutes);
router.use("/triage-records", triageRecordRoutes);
router.use("/vitals", vitalRoutes);

router.use("/lab-requests", labRequestRoutes);
router.use("/lab-results", labResultRoutes);

router.use("/maternity-visits", maternityVisitRoutes);
router.use("/delivery-records", deliveryRecordRoutes);
router.use("/newborn-records", newbornRecordRoutes);

router.use("/medical-records", medicalRecordRoutes);
router.use("/prescriptions", prescriptionRoutes);
router.use("/pharmacy-transactions", pharmacyTransactionRoutes);

router.use("/ultrasound-records", ultrasoundRecordRoutes);
router.use("/ekg-records", ekgRecordRoutes);
router.use("/surgeries", surgeryRoutes);

router.use("/patient-chart", patientChartRoutes);

/* ============================================================
   💰 Billing & Finance
============================================================ */
router.use("/invoices", invoiceRoutes);
router.use("/payments", paymentRoutes);
router.use("/deposits", depositRoutes);

router.use("/refunds", refundRoutes);
router.use("/refund-deposits", refundDepositRoutes);

router.use("/discount-policies", discountPolicyRoutes);
router.use("/discount-waivers", discountWaiverRoutes);
router.use("/discounts", discountRoutes);

router.use("/auto-billing-rules", autoBillingRuleRoutes);
router.use("/billing-triggers", billingTriggerRoutes);

router.use("/orders", orderRoutes);
router.use("/insurance-providers", insuranceProviderRoutes);
router.use("/insurance-claims", insuranceClaimRoutes);
router.use("/patient-insurances", patientInsuranceRoutes);

router.use("/accounts", accountRoutes);
router.use("/expenses", expenseRoutes);
router.use("/cash-ledger", cashLedgerRoutes);
router.use("/cash-closings", cashClosingRoutes);
router.use("/payrolls", payrollRoutes);
router.use("/currency-rates", currencyRateRoutes);
router.use("/fx", fxRoutes);

/* ============================================================
   ⚡ Lite Routes
============================================================ */
router.use("/lite", liteRoutes);

/* ============================================================
   📊 Reports
============================================================ */
router.use("/reports", reportRoutes);

/* ============================================================
   🛠 Debug
============================================================ */
router.use("/debug", debugRoutes);

export default router;