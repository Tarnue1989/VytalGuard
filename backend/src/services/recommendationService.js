// 📘 recommendationService.js – Doctor-to-Doctor Recommendations (Enterprise Edition v2)
import db from "../models/index.js";
import { logger } from "../utils/logger.js";

export const recommendationService = {
  /**
   * 🔍 Fetch all recommendations for a given patient
   * Includes doctor, department, facility, organization, and consultation context.
   *
   * @param {String} patientId - Patient UUID
   * @param {Object} user - Authenticated user
   * @returns {Promise<Array>}
   */
  async getByPatient(patientId, user = {}) {
    try {
      if (!patientId) return [];

      const recs = await db.Recommendation.findAll({
        where: { patient_id: patientId },
        attributes: ["id", "recommendation_date", "reason", "status", "created_at", "updated_at"],
        include: [
          // ✅ FIXED: use real columns instead of full_name virtual
          {
            model: db.Employee,
            as: "doctor",
            attributes: ["id", "first_name", "middle_name", "last_name"],
          },
          { model: db.Department, as: "department", attributes: ["id", "name"] },
          {
            model: db.Consultation,
            as: "consultation",
            attributes: ["id", "consultation_date", "diagnosis", "status"],
          },
          { model: db.Organization, as: "organization", attributes: ["id", "name"] },
          { model: db.Facility, as: "facility", attributes: ["id", "name"] },
        ],
        order: [["recommendation_date", "DESC"]],
      });

      // ✅ Normalize output for frontend use
      return recs.map((r) => {
        const doctorFullName = r.doctor
          ? [r.doctor.first_name, r.doctor.middle_name, r.doctor.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        return {
          id: r.id,
          recommendation_date: r.recommendation_date,
          reason: r.reason,
          status: r.status,
          created_at: r.created_at,
          updated_at: r.updated_at,

          doctor: r.doctor ? { id: r.doctor.id, full_name: doctorFullName } : null,
          department: r.department
            ? { id: r.department.id, name: r.department.name }
            : null,
          consultation: r.consultation
            ? {
                id: r.consultation.id,
                consultation_date: r.consultation.consultation_date,
                diagnosis: r.consultation.diagnosis,
                status: r.consultation.status,
              }
            : null,
          organization: r.organization
            ? { id: r.organization.id, name: r.organization.name }
            : null,
          facility: r.facility
            ? { id: r.facility.id, name: r.facility.name }
            : null,
        };
      });
    } catch (err) {
      logger.error("[recommendationService.getByPatient] Error:", err);
      return [];
    }
  },
};
