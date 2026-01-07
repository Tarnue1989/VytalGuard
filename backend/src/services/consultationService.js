// 📘 consultationService.js – Patient Consultation Service (Enterprise Edition)
import db from "../models/index.js";
import { logger } from "../utils/logger.js";

export const consultationService = {
  /**
   * 🔍 Fetch all consultations for a given patient.
   * Includes doctor, department, facility, organization, and registration context.
   *
   * @param {String} patientId - Patient UUID
   * @param {Object} user - Authenticated user context
   * @returns {Promise<Array>}
   */
  async getByPatient(patientId, user = {}) {
    try {
      if (!patientId) return [];

      const records = await db.Consultation.findAll({
        where: { patient_id: patientId },
        include: [
          { model: db.Organization, as: "organization", attributes: ["id", "name"] },
          { model: db.Facility, as: "facility", attributes: ["id", "name"] },

          // ✅ FIXED: no virtuals, use real name fields
          {
            model: db.Employee,
            as: "doctor",
            attributes: ["id", "first_name", "middle_name", "last_name"],
          },

          { model: db.Department, as: "department", attributes: ["id", "name"] },
          {
            model: db.RegistrationLog,
            as: "registrationLog",
            attributes: ["id", "registration_time", "visit_reason", "patient_category"],
          },
          {
            model: db.BillableItem,
            as: "consultationType",
            attributes: ["id", "name"],
          },
          {
            model: db.Invoice,
            as: "invoice",
            attributes: ["id", "invoice_number", "invoice_date", "status"],
          },
        ],
        order: [["consultation_date", "ASC"]],
      });

      // ✅ Normalize and return clean structure
      return records.map((r) => {
        const doctorFullName = r.doctor
          ? [r.doctor.first_name, r.doctor.middle_name, r.doctor.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        return {
          id: r.id,
          consultation_date: r.consultation_date,
          diagnosis: r.diagnosis,
          notes: r.consultation_notes,
          status: r.status,
          cancel_reason: r.cancel_reason,
          void_reason: r.void_reason,
          consultation_type: r.consultationType
            ? { id: r.consultationType.id, name: r.consultationType.name }
            : null,
          department: r.department
            ? { id: r.department.id, name: r.department.name }
            : null,
          doctor: r.doctor ? { id: r.doctor.id, full_name: doctorFullName } : null,
          facility: r.facility
            ? { id: r.facility.id, name: r.facility.name }
            : null,
          organization: r.organization
            ? { id: r.organization.id, name: r.organization.name }
            : null,
          registrationLog: r.registrationLog
            ? {
                id: r.registrationLog.id,
                registration_time: r.registrationLog.registration_time,
                visit_reason: r.registrationLog.visit_reason,
                patient_category: r.registrationLog.patient_category,
              }
            : null,
          invoice: r.invoice
            ? {
                id: r.invoice.id,
                invoice_number: r.invoice.invoice_number,
                invoice_date: r.invoice.invoice_date,
                status: r.invoice.status,
              }
            : null,
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });
    } catch (error) {
      logger.error("[consultationService.getByPatient] Error:", error);
      return [];
    }
  },
};
