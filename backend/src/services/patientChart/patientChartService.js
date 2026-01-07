// 📦 backend/src/services/patientChart/patientChartService.js
// Enterprise unified patient chart aggregator (registration, vitals, pharmacy, imaging, etc.)

import { Op } from "sequelize";
import { authzService } from "../authzService.js";
import { auditService } from "../auditService.js";
import { logger } from "../../utils/logger.js";
import { hasElevatedAccess } from "../../utils/role-utils.js";

// --- Core & Linked Domain Services
import { patientService } from "../patientService.js";
import { registrationLogService } from "../registrationLogService.js";
import { consultationService } from "../consultationService.js";
import { triageRecordService } from "../triageRecordService.js";
import { vitalService } from "../vitalService.js";
import { recommendationService } from "../recommendationService.js";
import { ultrasoundRecordService } from "../ultrasoundRecordService.js";
import { deliveryRecordService } from "../deliveryRecordService.js";
import { labRequestService } from "../labRequestService.js";
import { ekgRecordService } from "../ekgRecordService.js";
import { medicationService } from "../medicationService.js";
import { billingService } from "../billingService.js";
import { patientChartNoteService } from "./patientChartNoteService.js";

export const patientChartService = {
  /* ============================================================
     🧠 Fetch Full Patient Chart (All Sections)
  ============================================================ */
  async getFullChart(patientId, user, options = {}) {
    await authzService.checkPermission(user, "patient_charts:view");

    const { includeSections = [], from, to } = options;
    const sections = includeSections.length
      ? includeSections
      : [
          "patient",
          "registration_logs",
          "triage_records",
          "consultations",
          "recommendations",
          "vitals",
          "labs",
          "ultrasounds",
          "ekgs",
          "deliveries",
          "medications",
          "notes",
          "billing",
        ];

    logger.info(
      `[patientChartService] ▶ Fetching chart for patient=${patientId} with filters from=${from || "—"} to=${to || "—"}`
    );

    const results = {};
    const tasks = [];

    // Date filter helper
    const inDateRange = (arr, field = "created_at") => {
      if (!from && !to) return arr;
      return arr?.filter((item) => {
        const date = new Date(item[field] || item.recorded_at || item.requested_at);
        if (from && date < new Date(from)) return false;
        if (to && date > new Date(to)) return false;
        return true;
      });
    };

    // Wrapper for async service calls with filter post-processing
    const add = (key, svc, fn = "getByPatient", dateField = "created_at") => {
      if (sections.includes(key)) {
        tasks.push(
          svc[fn](patientId, user)
            .then((data) => (results[key] = inDateRange(data, dateField)))
            .catch((err) => {
              logger.warn(`[patientChartService] ⚠ ${key} fetch failed: ${err.message}`);
              results[key] = [];
            })
        );
      }
    };

    // --- Patient core info (always direct await)
    if (sections.includes("patient")) {
      results.patient = await patientService.getBasic(patientId, user);
    }

    // --- Linked data calls (parallel, all filtered)
    add("registration_logs", registrationLogService, "getByPatient", "registration_time");
    add("triage_records", triageRecordService, "getByPatient", "triage_time");
    add("consultations", consultationService, "getByPatient", "consultation_date");
    add("recommendations", recommendationService);
    add("vitals", vitalService, "getByPatient", "recorded_at");
    add("labs", labRequestService, "getByPatient", "requested_at");
    add("ultrasounds", ultrasoundRecordService, "getByPatient", "scan_date");
    add("ekgs", ekgRecordService, "getByPatient", "recorded_at");
    add("deliveries", deliveryRecordService, "getByPatient", "delivery_date");
    add("medications", medicationService, "getByPatient", "date");
    add("notes", patientChartNoteService, "listByPatient", "created_at");
    add("billing", billingService, "getInvoicesByPatient", "invoice_date");

    await Promise.allSettled(tasks);

    // --- Derived Data
    results.timeline = this._buildTimeline(results, from, to);
    results.visits = this._buildVisits(results);

    // --- Audit Record
    await auditService.logAction({
      module: "patient_chart",
      action: "view",
      entityId: patientId,
      user,
      details: {
        sections,
        from: from || null,
        to: to || null,
        elevated: hasElevatedAccess(user),
      },
    });

    return results;
  },

  /* ============================================================
     🕒 Build Chronological Timeline
  ============================================================ */
  _buildTimeline(results, from, to) {
    const all = [];

    const push = (type, arr = [], dateField = "created_at") => {
      if (!Array.isArray(arr)) return;
      arr.forEach((r) =>
        all.push({
          type,
          date: r[dateField] || r.updated_at || r.timestamp,
          summary:
            r.summary ||
            r.note ||
            r.description ||
            r.visit_reason ||
            r.reason ||
            "",
          sourceId: r.id,
        })
      );
    };

    push("Registration", results.registration_logs, "registration_time");
    push("Triage", results.triage_records, "triage_time");
    push("Consultation", results.consultations, "consultation_date");
    push("Recommendation", results.recommendations);
    push("Vital", results.vitals, "recorded_at");
    push("Lab", results.labs, "requested_at");
    push("Ultrasound", results.ultrasounds, "scan_date");
    push("EKG", results.ekgs, "recorded_at");
    push("Delivery", results.deliveries, "delivery_date");
    push("Medication", results.medications, "date");
    push("Billing", results.billing, "invoice_date");
    push("Note", results.notes, "created_at");

    let timeline = all.filter((r) => !!r.date);

    // Optional date filtering (for timeline only)
    if (from || to) {
      const fromD = from ? new Date(from) : null;
      const toD = to ? new Date(to) : null;
      timeline = timeline.filter((r) => {
        const d = new Date(r.date);
        if (fromD && d < fromD) return false;
        if (toD && d > toD) return false;
        return true;
      });
    }

    return timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
  },

  /* ============================================================
     📋 Build Visit Summaries (Safe Version)
  ============================================================ */
  _buildVisits(results) {
    try {
      const {
        consultations = [],
        vitals = [],
        labs = [],
        notes = [],
        registration_logs = [],
        medications = [],
      } = results;

      const visits = [];
      const normalizeDate = (val) => {
        if (!val) return null;
        if (typeof val === "string") return val.slice(0, 10);
        if (val instanceof Date) return val.toISOString().slice(0, 10);
        return null;
      };

      // --- Build from consultations (primary)
      consultations.forEach((c) => {
        const d = normalizeDate(c.consultation_date || c.created_at);
        visits.push({
          date: d,
          doctor: c.doctor_name || c.doctor || null,
          diagnosis: c.diagnosis || c.assessment || "",
          treatment: c.treatment || "",
          registration:
            registration_logs.find(
              (r) => normalizeDate(r.registration_time) === d
            ) || null,
          vitals: vitals.filter((v) => normalizeDate(v.created_at) === d),
          labs: labs.filter((l) => normalizeDate(l.created_at) === d),
          medications: medications.filter((m) => normalizeDate(m.created_at) === d),
          notes: notes.filter((n) => normalizeDate(n.created_at) === d),
        });
      });

      // --- Fill in isolated vitals
      vitals
        .filter(
          (v) =>
            !consultations.some(
              (c) =>
                normalizeDate(c.consultation_date || c.created_at) ===
                normalizeDate(v.created_at)
            )
        )
        .forEach((v) => {
          const d = normalizeDate(v.created_at);
          visits.push({
            date: d,
            doctor: null,
            diagnosis: "",
            treatment: "",
            registration:
              registration_logs.find(
                (r) => normalizeDate(r.registration_time) === d
              ) || null,
            vitals: [v],
            labs: labs.filter((l) => normalizeDate(l.created_at) === d),
            medications: medications.filter((m) => normalizeDate(m.created_at) === d),
            notes: notes.filter((n) => normalizeDate(n.created_at) === d),
          });
        });

      // --- Fill in standalone registration logs
      registration_logs
        .filter(
          (r) => !visits.some((v) => v.date === normalizeDate(r.registration_time))
        )
        .forEach((r) => {
          const d = normalizeDate(r.registration_time);
          visits.push({
            date: d,
            doctor: null,
            diagnosis: "",
            treatment: "",
            registration: r,
            vitals: [],
            labs: [],
            medications: [],
            notes: [],
          });
        });

      return visits.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
      logger.warn("[patientChartService._buildVisits] Failed", e);
      return [];
    }
  },
};
