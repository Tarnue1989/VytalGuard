// 📋 backend/src/controllers/patientChartController.js – Enterprise Unified Chart Controller
import {
  patientChartService,
  patientChartCacheService,
  patientChartNoteService,
  patientChartViewLogService,
} from "../services/patientChart/index.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { logger } from "../utils/logger.js";
import db from "../models/index.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { buildQueryOptions } from "../utils/queryHelper.js";

/* ============================================================
   🏥 PATIENT CHART CONTROLLER
============================================================ */
export const patientChartController = {
  async listCachedCharts(req, res) {
    try {
      const user = req.user;
      await authzService.checkPermission(user, "patient_charts:view");
      const { page, limit, where, attributes, order } = buildQueryOptions(req);
      const result = await patientChartCacheService.listAll({
        where,
        attributes,
        order,
        page,
        limit,
        user,
      });
      await auditService.logAction({
        module: "patient_chart",
        action: "list_cache",
        user,
        details: { filters: req.query },
      });
      return res.status(200).json({
        success: true,
        message: "Patient chart cache list retrieved successfully",
        data: { records: result.records, pagination: result.pagination },
      });
    } catch (e) {
      logger.error("[patientChartController.listCachedCharts]", e);
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Failed to list cached patient charts.",
      });
    }
  },

  async listAllNotes(req, res, next) {
    try {
      const { page = 1, limit = 25, ...filters } = req.query;
      const result = await patientChartNoteService.listAllNotes({
        page,
        limit,
        filters,
        user: req.user,
      });
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  },

  /* ============================================================
     🧩 Get Full Patient Chart (with optional date range)
  ============================================================ */
  async getPatientChart(req, res) {
    try {
      const user = req.user;
      const { patient_id } = req.params;
      const { includeSections, from, to } = req.query;
      await authzService.checkPermission(user, "patient_charts:view");

      const sections = includeSections
        ? Array.isArray(includeSections)
          ? includeSections
          : includeSections.split(",")
        : [];

      const cache = await patientChartCacheService.getOrRevalidate(patient_id, user);
      const chart =
        cache?.chart_snapshot ??
        (await patientChartService.getFullChart(patient_id, user, {
          includeSections: sections,
          from,
          to,
        }));

      const patient = await db.Patient.findByPk(patient_id, {
        include: [
          { model: db.Organization, as: "organization", attributes: ["id", "name", "code"] },
          {
            model: db.Facility,
            as: "facility",
            attributes: ["id", "name", "code", "address", "phone", "email"],
          },
        ],
      });

      let attending_physician = null;
      if (chart.consultations?.length) {
        const latest = chart.consultations[0];
        if (latest?.doctor_id) {
          attending_physician = await db.Employee.findByPk(latest.doctor_id, {
            attributes: ["id", "full_name", "position", "specialty", "license_no", "department_id"],
          });
        }
      }

      const enrichedChart = {
        ...chart,
        filters_applied: { from: from || null, to: to || null },
        patient: {
          id: patient?.id,
          full_name: patient?.full_name,
          gender: patient?.gender,
          date_of_birth: patient?.date_of_birth,
          age: patient?.age,
          pat_no: patient?.pat_no,
          insurance_number: patient?.insurance_number,
          phone_number: patient?.phone_number,
          home_address: patient?.home_address,
          profession: patient?.profession,
          religion: patient?.religion,
        },
        organization: patient?.organization
          ? {
              id: patient.organization.id,
              name: patient.organization.name,
              code: patient.organization.code,
            }
          : null,
        facility: patient?.facility
          ? {
              id: patient.facility.id,
              name: patient.facility.name,
              code: patient.facility.code,
              address: patient.facility.address,
              phone: patient.facility.phone,
              email: patient.facility.email,
            }
          : null,
        attending_physician,
        printed_by: {
          id: user.id,
          full_name: user.full_name,
          role: user.role,
          email: user.email,
        },
        printed_at: new Date(),
      };

      await patientChartViewLogService.logView({
        patient_id,
        user,
        action: "view",
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      await auditService.logAction({
        module: "patient_chart",
        action: "view",
        entityId: patient_id,
        user,
        details: { sections, from, to },
      });

      return res.status(200).json({
        success: true,
        message: "Patient chart retrieved successfully",
        data: enrichedChart,
      });
    } catch (e) {
      logger.error("[patientChartController.getPatientChart]", e);
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Failed to retrieve patient chart.",
      });
    }
  },

  /* ============================================================
     🔹 Fetch a single section (e.g. labs, vitals, meds)
  ============================================================ */
  async getPatientSection(req, res) {
    try {
      const user = req.user;
      const { patient_id, section_key } = req.params;
      const { from, to } = req.query;
      await authzService.checkPermission(user, "patient_charts:view");
      const chart = await patientChartService.getFullChart(patient_id, user, {
        includeSections: [section_key],
        from,
        to,
      });
      return res.status(200).json({
        success: true,
        message: `Section '${section_key}' retrieved successfully`,
        data: chart[section_key] || [],
      });
    } catch (e) {
      logger.error("[patientChartController.getPatientSection]", e);
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Failed to retrieve patient section.",
      });
    }
  },

  /* ============================================================
     🩺 Patient Summary
  ============================================================ */
  async getPatientSummary(req, res) {
    try {
      const user = req.user;
      const { patient_id } = req.params;
      const { from, to } = req.query;

      await authzService.checkPermission(user, "patient_charts:summary");
      const chart = await patientChartService.getFullChart(patient_id, user, {
        includeSections: ["patient", "consultations", "vitals"],
        from,
        to,
      });

      const summary = {
        patient: chart.patient,
        lastConsultation: chart.consultations?.[0] ?? null,
        lastVitals: chart.vitals?.[0] ?? null,
        filters_applied: { from: from || null, to: to || null },
      };

      await auditService.logAction({
        module: "patient_chart",
        action: "view_summary",
        entityId: patient_id,
        user,
      });

      return res.status(200).json({
        success: true,
        message: "Patient chart summary retrieved successfully",
        data: summary,
      });
    } catch (e) {
      logger.error("[patientChartController.getPatientSummary]", e);
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Failed to load patient summary.",
      });
    }
  },

  /* ============================================================
     🕒 Timeline + Cache + Logs
  ============================================================ */
  async getPatientTimeline(req, res) {
    try {
      const user = req.user;
      const { patient_id } = req.params;
      const { from, to } = req.query;
      await authzService.checkPermission(user, "patient_charts:view");

      const chart = await patientChartService.getFullChart(patient_id, user, { from, to });
      const timeline = chart.timeline ?? [];

      await patientChartViewLogService.logView({
        patient_id,
        user,
        action: "view_timeline",
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      await auditService.logAction({
        module: "patient_chart",
        action: "view_timeline",
        entityId: patient_id,
        user,
        details: { from, to },
      });

      return res.status(200).json({
        success: true,
        message: "Patient chart timeline generated successfully",
        data: timeline,
      });
    } catch (e) {
      logger.error("[patientChartController.getPatientTimeline]", e);
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Failed to build timeline.",
      });
    }
  },

  async invalidateCache(req, res) {
    try {
      const user = req.user;
      const { patient_id } = req.params;
      await authzService.checkPermission(user, "patient_charts:invalidate_cache");
      const result = await patientChartCacheService.invalidate(patient_id, user);
      if (!result)
        return res
          .status(404)
          .json({ success: false, message: "No cache entry found for this patient." });
      return res
        .status(200)
        .json({ success: true, message: "Patient chart cache invalidated successfully", data: result });
    } catch (e) {
      logger.error("[patientChartController.invalidateCache]", e);
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Failed to invalidate cache.",
      });
    }
  },

  async getViewLogs(req, res) {
    try {
      const user = req.user;
      const { patient_id } = req.params;
      await authzService.checkPermission(user, "patient_chart_logs:view");
      const { limit, page, offset } = validatePaginationStrict(req);
      const { where, order } = buildQueryOptions(req, "viewed_at", "DESC");
      where.patient_id = patient_id;
      const { count, rows } = await db.PatientChartViewLog.findAndCountAll({
        where,
        order,
        limit,
        offset,
        include: [{ model: db.User, as: "viewer", attributes: ["id", "first_name", "last_name", "email"] }],
      });
      const processed = rows.map((r) => {
        const v = r.viewer
          ? { ...r.viewer.toJSON(), full_name: `${r.viewer.first_name || ""} ${r.viewer.last_name || ""}`.trim() }
          : null;
        return { ...r.toJSON(), viewer: v };
      });
      await auditService.logAction({
        module: "patient_chart",
        action: "list_view_logs",
        entityId: patient_id,
        user,
        details: { filters: req.query, page, limit, total: count },
      });
      return res.status(200).json({
        success: true,
        message: "Chart view logs retrieved successfully",
        data: {
          records: processed,
          pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
        },
      });
    } catch (e) {
      logger.error("[patientChartController.getViewLogs]", e);
      return res.status(e.status || 500).json({
        success: false,
        message: e.message || "Failed to fetch logs.",
      });
    }
  },
};

/* ============================================================
   🗒️ PATIENT CHART NOTES MANAGEMENT
============================================================ */
Object.assign(patientChartController, {
  async listNotes(req, res) {
    try {
      const user = req.user;
      const { patient_id } = req.params;
      await authzService.checkPermission(user, "patient_chart_notes:view");
      const notes = await patientChartNoteService.listByPatient(patient_id, user);
      return res
        .status(200)
        .json({ success: true, message: "Patient chart notes retrieved successfully", data: notes });
    } catch (e) {
      logger.error("[patientChartController.listNotes]", e);
      return res
        .status(e.status || 500)
        .json({ success: false, message: e.message || "Failed to fetch patient chart notes." });
    }
  },

  async createNote(req, res) {
    try {
      const user = req.user;
      const { patient_id } = req.params;
      const data = req.body;
      await authzService.checkPermission(user, "patient_chart_notes:create");
      const note = await patientChartNoteService.create(patient_id, data, user);
      await patientChartCacheService.invalidate(patient_id, user);
      return res
        .status(201)
        .json({ success: true, message: "Patient chart note created successfully", data: note });
    } catch (e) {
      logger.error("[patientChartController.createNote]", e);
      return res
        .status(e.status || 500)
        .json({ success: false, message: e.message || "Failed to create patient chart note." });
    }
  },

  async updateNote(req, res) {
    try {
      const user = req.user;
      const { note_id } = req.params;
      const data = req.body;
      await authzService.checkPermission(user, "patient_chart_notes:edit");
      const note = await patientChartNoteService.update(note_id, data, user);
      if (!note)
        return res.status(404).json({ success: false, message: "Patient chart note not found." });
      await patientChartCacheService.invalidate(note.patient_id, user);
      return res
        .status(200)
        .json({ success: true, message: "Patient chart note updated successfully", data: note });
    } catch (e) {
      logger.error("[patientChartController.updateNote]", e);
      return res
        .status(e.status || 500)
        .json({ success: false, message: e.message || "Failed to update patient chart note." });
    }
  },

  async deleteNote(req, res) {
    try {
      const user = req.user;
      const { note_id } = req.params;
      await authzService.checkPermission(user, "patient_chart_notes:delete");
      const note = await patientChartNoteService.delete(note_id, user);
      if (!note)
        return res.status(404).json({ success: false, message: "Patient chart note not found." });
      await patientChartCacheService.invalidate(note.patient_id, user);
      return res
        .status(200)
        .json({ success: true, message: "Patient chart note deleted successfully", data: note });
    } catch (e) {
      logger.error("[patientChartController.deleteNote]", e);
      return res
        .status(e.status || 500)
        .json({ success: false, message: e.message || "Failed to delete patient chart note." });
    }
  },

  async verifyOrReviewNote(req, res) {
    try {
      const user = req.user;
      const { note_id } = req.params;
      const { mode } = req.query;
      const permissionKey =
        mode === "review" ? "patient_chart_notes:review" : "patient_chart_notes:verify";
      await authzService.checkPermission(user, permissionKey);
      const note = await patientChartNoteService.verify(note_id, user, mode === "review");
      if (!note)
        return res.status(404).json({ success: false, message: "Patient chart note not found." });
      await patientChartCacheService.invalidate(note.patient_id, user);
      return res.status(200).json({
        success: true,
        message: `Patient chart note ${
          mode === "review" ? "reviewed" : "verified"
        } successfully`,
        data: note,
      });
    } catch (e) {
      logger.error("[patientChartController.verifyOrReviewNote]", e);
      return res
        .status(e.status || 500)
        .json({ success: false, message: e.message || "Failed to review/verify note." });
    }
  },
});
