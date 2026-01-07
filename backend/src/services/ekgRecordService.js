// 📘 ekgRecordService.js – Patient EKG Record Service (Enterprise Edition)
import db from "../models/index.js";
import { logger } from "../utils/logger.js";

export const ekgRecordService = {
  /**
   * 🔍 Fetch all EKG records for a given patient.
   * Includes technician, organization, facility, invoice, and registration context.
   *
   * @param {String} patientId - Patient UUID
   * @param {Object} user - Authenticated user context
   * @returns {Promise<Array>}
   */
  async getByPatient(patientId, user = {}) {
    try {
      if (!patientId) return [];

      const records = await db.EKGRecord.findAll({
        where: { patient_id: patientId },
        include: [
          { model: db.Organization, as: "organization", attributes: ["id", "name"] },
          { model: db.Facility, as: "facility", attributes: ["id", "name"] },

          // ✅ FIXED: use real columns, not virtual full_name
          {
            model: db.Employee,
            as: "technician",
            attributes: ["id", "first_name", "middle_name", "last_name"],
          },

          {
            model: db.Consultation,
            as: "consultation",
            attributes: ["id", "consultation_date", "diagnosis", "status"],
          },
          {
            model: db.RegistrationLog,
            as: "registrationLog",
            attributes: ["id", "registration_time", "visit_reason"],
          },
          {
            model: db.BillableItem,
            as: "billableItem",
            attributes: ["id", "name"],
          },
          {
            model: db.Invoice,
            as: "invoice",
            attributes: ["id", "invoice_number", "invoice_date", "status"],
          },
        ],
        order: [["recorded_date", "ASC"]],
      });

      // ✅ Normalize structure for safe UI consumption
      return records.map((r) => {
        const technicianFullName = r.technician
          ? [r.technician.first_name, r.technician.middle_name, r.technician.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        return {
          id: r.id,
          recorded_date: r.recorded_date,
          heart_rate: r.heart_rate,
          pr_interval: r.pr_interval,
          qrs_duration: r.qrs_duration,
          qt_interval: r.qt_interval,
          axis: r.axis,
          rhythm: r.rhythm,
          interpretation: r.interpretation,
          recommendation: r.recommendation,
          note: r.note,
          file_path: r.file_path,
          source: r.source,
          is_emergency: r.is_emergency,
          status: r.status,

          technician: r.technician
            ? { id: r.technician.id, full_name: technicianFullName }
            : null,

          consultation: r.consultation
            ? {
                id: r.consultation.id,
                consultation_date: r.consultation.consultation_date,
                diagnosis: r.consultation.diagnosis,
                status: r.consultation.status,
              }
            : null,

          registrationLog: r.registrationLog
            ? {
                id: r.registrationLog.id,
                registration_time: r.registrationLog.registration_time,
                visit_reason: r.registrationLog.visit_reason,
              }
            : null,

          billable_item: r.billableItem
            ? { id: r.billableItem.id, name: r.billableItem.name }
            : null,

          invoice: r.invoice
            ? {
                id: r.invoice.id,
                invoice_number: r.invoice.invoice_number,
                invoice_date: r.invoice.invoice_date,
                status: r.invoice.status,
              }
            : null,

          facility: r.facility
            ? { id: r.facility.id, name: r.facility.name }
            : null,

          organization: r.organization
            ? { id: r.organization.id, name: r.organization.name }
            : null,

          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });
    } catch (error) {
      logger.error("[ekgRecordService.getByPatient] Error:", error);
      return [];
    }
  },
};
