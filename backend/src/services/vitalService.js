// 📘 vitalService.js – Core Vital Record Access (Enterprise Edition v2)
import db from "../models/index.js";
import { logger } from "../utils/logger.js";

export const vitalService = {
  /**
   * 🔍 Fetch all vital records for a given patient
   * Includes nurse, consultation, facility, and organization.
   */
  async getByPatient(patientId, user) {
    try {
      if (!patientId) return [];

      const records = await db.Vital.findAll({
        where: { patient_id: patientId },
        attributes: [
          "id",
          "bp",
          "pulse",
          "rr",
          "temp",
          "oxygen",
          "weight",
          "height",
          "bmi",
          "recorded_at",
          "status",
          "created_at",
          "updated_at",
        ],
        include: [
          // ✅ FIXED: real columns, not virtual full_name
          {
            model: db.Employee,
            as: "nurse",
            attributes: ["id", "first_name", "middle_name", "last_name"],
          },
          { model: db.Organization, as: "organization", attributes: ["id", "name"] },
          { model: db.Facility, as: "facility", attributes: ["id", "name"] },
          {
            model: db.Consultation,
            as: "consultation",
            attributes: ["id", "consultation_date"],
          },
        ],
        order: [["recorded_at", "DESC"]],
      });

      // ✅ Normalize for frontend consumption
      return records.map((r) => {
        const nurseFullName = r.nurse
          ? [r.nurse.first_name, r.nurse.middle_name, r.nurse.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        return {
          id: r.id,
          bp: r.bp,
          pulse: r.pulse,
          rr: r.rr,
          temp: r.temp,
          oxygen: r.oxygen,
          weight: r.weight,
          height: r.height,
          bmi: r.bmi,
          recorded_at: r.recorded_at,
          status: r.status,
          created_at: r.created_at,
          updated_at: r.updated_at,

          nurse: r.nurse ? { id: r.nurse.id, full_name: nurseFullName } : null,

          consultation: r.consultation
            ? {
                id: r.consultation.id,
                consultation_date: r.consultation.consultation_date,
              }
            : null,

          facility: r.facility
            ? { id: r.facility.id, name: r.facility.name }
            : null,

          organization: r.organization
            ? { id: r.organization.id, name: r.organization.name }
            : null,
        };
      });
    } catch (err) {
      logger.error("[vitalService.getByPatient] Error:", err);
      return [];
    }
  },
};
