// 📘 triageRecordService.js – Core Triage Access (Enterprise Edition v2)
import db from "../models/index.js";
import { logger } from "../utils/logger.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

export const triageRecordService = {
  /**
   * 🔍 Get all triage records for a patient (Enterprise Role-Aware)
   *
   * Includes doctor, nurse, organization, and facility context.
   * Applies consistent employee name handling (first, middle, last).
   */
  async getByPatient(patientId, user) {
    try {
      await authzService.checkPermission(user, "triage_records:view");

      if (!patientId) return [];

      const records = await db.TriageRecord.findAll({
        where: { patient_id: patientId },
        attributes: [
          "id",
          "triage_status",
          "symptoms",
          "triage_notes",
          "bp",
          "pulse",
          "rr",
          "temp",
          "oxygen",
          "weight",
          "height",
          "rbg",
          "pain_score",
          "recorded_at",
          "created_at",
          "updated_at",
        ],
        include: [
          // ✅ FIXED: real columns, not virtual full_name
          {
            model: db.Employee,
            as: "doctor",
            attributes: ["id", "first_name", "middle_name", "last_name"],
          },
          {
            model: db.Employee,
            as: "nurse",
            attributes: ["id", "first_name", "middle_name", "last_name"],
          },
          { model: db.Organization, as: "organization", attributes: ["id", "name"] },
          { model: db.Facility, as: "facility", attributes: ["id", "name"] },
        ],
        order: [["recorded_at", "DESC"]],
      });

      // ✅ Normalize employee names for frontend use
      const normalized = records.map((r) => {
        const doctorFullName = r.doctor
          ? [r.doctor.first_name, r.doctor.middle_name, r.doctor.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        const nurseFullName = r.nurse
          ? [r.nurse.first_name, r.nurse.middle_name, r.nurse.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        return {
          id: r.id,
          triage_status: r.triage_status,
          symptoms: r.symptoms,
          triage_notes: r.triage_notes,
          bp: r.bp,
          pulse: r.pulse,
          rr: r.rr,
          temp: r.temp,
          oxygen: r.oxygen,
          weight: r.weight,
          height: r.height,
          rbg: r.rbg,
          pain_score: r.pain_score,
          recorded_at: r.recorded_at,
          created_at: r.created_at,
          updated_at: r.updated_at,

          doctor: r.doctor ? { id: r.doctor.id, full_name: doctorFullName } : null,
          nurse: r.nurse ? { id: r.nurse.id, full_name: nurseFullName } : null,

          organization: r.organization
            ? { id: r.organization.id, name: r.organization.name }
            : null,

          facility: r.facility
            ? { id: r.facility.id, name: r.facility.name }
            : null,
        };
      });

      // 🧾 Log audit trail
      await auditService.logAction({
        module: "triage_records",
        action: "view",
        entityId: patientId,
        user,
        details: { count: normalized.length },
      });

      return normalized;
    } catch (err) {
      logger.error("[triageRecordService.getByPatient] Error:", err);
      return [];
    }
  },
};
