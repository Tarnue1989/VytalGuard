// 📦 backend/src/services/patientChart/index.js
// ============================================================
// 🏥 Enterprise-safe aggregation for all Patient Chart domain services
// Prevents circular ESM load timing issues by lazy importing modules
// ============================================================

// 📘 Core Patient Chart Domain
import * as chartServiceModule from "./patientChartService.js";
import * as cacheServiceModule from "./patientChartCacheService.js";
import * as noteServiceModule from "./patientChartNoteService.js";
import * as viewLogServiceModule from "./patientChartViewLogService.js";

// 📘 Core Entities
import * as patientServiceModule from "../patientService.js";
import * as consultationServiceModule from "../consultationService.js";
import * as labRequestServiceModule from "../labRequestService.js";
import * as ekgRecordServiceModule from "../ekgRecordService.js";
import * as vitalServiceModule from "../vitalService.js";
import * as deliveryRecordServiceModule from "../deliveryRecordService.js";
import * as billingServiceModule from "../billingService.js";

// 📘 Extended Clinical Modules
import * as triageRecordServiceModule from "../triageRecordService.js";
import * as ultrasoundRecordServiceModule from "../ultrasoundRecordService.js";
import * as recommendationServiceModule from "../recommendationService.js";
import * as medicationServiceModule from "../medicationService.js";

// 📘 Registration / Admissions
import * as registrationLogServiceModule from "../registrationLogService.js";

// ============================================================
// ✅ Explicit re-exports (safe even during circular loads)
// ============================================================

// --- Patient Chart Core
export const patientChartService = chartServiceModule.patientChartService;
export const patientChartCacheService = cacheServiceModule.patientChartCacheService;
export const patientChartNoteService = noteServiceModule.patientChartNoteService;
export const patientChartViewLogService = viewLogServiceModule.patientChartViewLogService;

// --- Core Entities
export const patientService = patientServiceModule.patientService;
export const consultationService = consultationServiceModule.consultationService;
export const labRequestService = labRequestServiceModule.labRequestService;
export const ekgRecordService = ekgRecordServiceModule.ekgRecordService;
export const vitalService = vitalServiceModule.vitalService;
export const deliveryRecordService = deliveryRecordServiceModule.deliveryRecordService;
export const billingService = billingServiceModule.billingService;

// --- Extended Clinical Modules
export const triageRecordService = triageRecordServiceModule.triageRecordService;
export const ultrasoundRecordService = ultrasoundRecordServiceModule.ultrasoundRecordService;
export const recommendationService = recommendationServiceModule.recommendationService;
export const medicationService = medicationServiceModule.medicationService;

// --- Registration / Admission
export const registrationLogService = registrationLogServiceModule.registrationLogService;

// ============================================================
// 🧠 Optional: export everything grouped for external imports
// ============================================================

export const patientChartModules = {
  patientChartService,
  patientChartCacheService,
  patientChartNoteService,
  patientChartViewLogService,

  patientService,
  consultationService,
  labRequestService,
  ekgRecordService,
  vitalService,
  deliveryRecordService,
  billingService,

  triageRecordService,
  ultrasoundRecordService,
  recommendationService,
  medicationService,

  registrationLogService,
};

// 📘 Example usage elsewhere:
// import { patientChartModules } from "../services/patientChart/index.js";
// const { patientChartService, vitalService } = patientChartModules;

