// 📘 ultrasoundRecordService.js – Diagnostic Ultrasound Access (Enterprise Edition v2)
import db from "../models/index.js";
import { logger } from "../utils/logger.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

export const ultrasoundRecordService = {
  /**
   * 🔍 Get all ultrasound records for a patient (Role-Aware)
   * Includes technician, department, facility, and organization.
   */
  async getByPatient(patientId, user) {
    try {
      await authzService.checkPermission(user, "ultrasound_records:view");

      if (!patientId) return [];

      const records = await db.UltrasoundRecord.findAll({
        where: { patient_id: patientId },
        attributes: [
          "id",
          "scan_type",
          "scan_date",
          "scan_location",
          "ultra_findings",
          "status",
          "fetal_heart_rate",
          "number_of_fetus",
          "gender",
          "amniotic_volume",
          "presentation",
          "lie",
          "position",
          "is_emergency",
          "verified_at",
          "finalized_at",
          "created_at",
          "updated_at",
        ],
        include: [
          // ✅ FIXED: use real name fields (no virtual full_name)
          {
            model: db.Employee,
            as: "technician",
            attributes: ["id", "first_name", "middle_name", "last_name"],
          },
          { model: db.Organization, as: "organization", attributes: ["id", "name"] },
          { model: db.Facility, as: "facility", attributes: ["id", "name"] },
          { model: db.Department, as: "department", attributes: ["id", "name"] },
        ],
        order: [["scan_date", "DESC"]],
      });

      // ✅ Normalize structure for frontend or report consumption
      const normalized = records.map((r) => {
        const technicianFullName = r.technician
          ? [r.technician.first_name, r.technician.middle_name, r.technician.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        return {
          id: r.id,
          scan_type: r.scan_type,
          scan_date: r.scan_date,
          scan_location: r.scan_location,
          ultra_findings: r.ultra_findings,
          status: r.status,
          fetal_heart_rate: r.fetal_heart_rate,
          number_of_fetus: r.number_of_fetus,
          gender: r.gender,
          amniotic_volume: r.amniotic_volume,
          presentation: r.presentation,
          lie: r.lie,
          position: r.position,
          is_emergency: r.is_emergency,
          verified_at: r.verified_at,
          finalized_at: r.finalized_at,
          created_at: r.created_at,
          updated_at: r.updated_at,

          technician: r.technician
            ? { id: r.technician.id, full_name: technicianFullName }
            : null,

          department: r.department
            ? { id: r.department.id, name: r.department.name }
            : null,

          facility: r.facility
            ? { id: r.facility.id, name: r.facility.name }
            : null,

          organization: r.organization
            ? { id: r.organization.id, name: r.organization.name }
            : null,
        };
      });

      // 🧾 Enterprise audit logging
      await auditService.logAction({
        module: "ultrasound_records",
        action: "view",
        entityId: patientId,
        user,
        details: { count: normalized.length },
      });

      return normalized;
    } catch (err) {
      logger.error("[ultrasoundRecordService.getByPatient] Error:", err);
      return [];
    }
  },
};
