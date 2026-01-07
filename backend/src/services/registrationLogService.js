// 📘 registrationLogService.js – Patient Registration Log Service (Enterprise Edition v2)
import db from "../models/index.js";
import { logger } from "../utils/logger.js";

export const registrationLogService = {
  /**
   * 🔍 Fetch all registration logs for a given patient.
   * Includes registrar, facility, organization, and registration type.
   *
   * @param {String} patientId - Patient UUID
   * @param {Object} user - Authenticated user context
   * @returns {Promise<Array>}
   */
  async getByPatient(patientId, user = {}) {
    try {
      if (!patientId) return [];

      const records = await db.RegistrationLog.findAll({
        where: { patient_id: patientId },
        include: [
          { model: db.Organization, as: "organization", attributes: ["id", "name"] },
          { model: db.Facility, as: "facility", attributes: ["id", "name"] },

          // ✅ FIXED: use real name columns instead of virtual full_name
          {
            model: db.Employee,
            as: "registrar",
            attributes: ["id", "first_name", "middle_name", "last_name"],
          },

          { model: db.BillableItem, as: "registrationType", attributes: ["id", "name"] },
        ],
        order: [["registration_time", "ASC"]],
      });

      // ✅ Normalize output for frontend and patient chart integration
      return records.map((r) => {
        const registrarFullName = r.registrar
          ? [r.registrar.first_name, r.registrar.middle_name, r.registrar.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        return {
          id: r.id,
          organization_id: r.organization_id,
          facility_id: r.facility_id,
          patient_id: r.patient_id,
          registrar_id: r.registrar_id,
          registration_time: r.registration_time,
          registration_method: r.registration_method,
          patient_category: r.patient_category,
          visit_reason: r.visit_reason,
          registration_source: r.registration_source,
          is_emergency: r.is_emergency,
          log_status: r.log_status,

          facility: r.facility
            ? { id: r.facility.id, name: r.facility.name }
            : null,
          organization: r.organization
            ? { id: r.organization.id, name: r.organization.name }
            : null,

          registrar: r.registrar
            ? { id: r.registrar.id, full_name: registrarFullName }
            : null,

          registrationType: r.registrationType
            ? { id: r.registrationType.id, name: r.registrationType.name }
            : null,

          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });
    } catch (error) {
      logger.error("[registrationLogService.getByPatient] Error:", error);
      return [];
    }
  },
};
