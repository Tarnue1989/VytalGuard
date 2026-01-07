// 📘 medicalRecordService.js – Patient Medical Record Service (Enterprise Edition v2)
import db from "../models/index.js";
import { logger } from "../utils/logger.js";

export const medicalRecordService = {
  /**
   * 🔍 Fetch all medical records for a given patient
   * Includes doctor, consultation, department, facility, organization, and invoice details.
   *
   * @param {String} patientId - Patient UUID
   * @param {Object} user - Authenticated user context
   * @returns {Promise<Array>}
   */
  async getByPatient(patientId, user = {}) {
    try {
      if (!patientId) return [];

      const records = await db.MedicalRecord.findAll({
        where: { patient_id: patientId },
        include: [
          { model: db.Organization, as: "organization", attributes: ["id", "name"] },
          { model: db.Facility, as: "facility", attributes: ["id", "name"] },

          // ✅ FIXED: use real name columns instead of virtual full_name
          {
            model: db.Employee,
            as: "doctor",
            attributes: ["id", "first_name", "middle_name", "last_name"],
          },

          {
            model: db.Consultation,
            as: "consultation",
            attributes: ["id", "consultation_date", "diagnosis"],
          },
          {
            model: db.RegistrationLog,
            as: "registrationLog",
            attributes: ["id", "registration_time", "visit_reason"],
          },
          {
            model: db.Invoice,
            as: "invoice",
            attributes: ["id", "invoice_number", "invoice_date", "status"],
          },
        ],
        order: [["recorded_at", "ASC"]],
      });

      // ✅ Normalize output for frontend/UI consumption
      return records.map((r) => {
        const doctorFullName = r.doctor
          ? [r.doctor.first_name, r.doctor.middle_name, r.doctor.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        return {
          id: r.id,
          recorded_at: r.recorded_at,
          status: r.status,
          is_emergency: r.is_emergency,
          cc: r.cc,
          hpi: r.hpi,
          pmh: r.pmh,
          fh_sh: r.fh_sh,
          pe: r.pe,
          dx: r.dx,
          ddx: r.ddx,
          tx_mx: r.tx_mx,
          summary_pg: r.summary_pg,
          report_path: r.report_path,

          doctor: r.doctor ? { id: r.doctor.id, full_name: doctorFullName } : null,

          consultation: r.consultation
            ? {
                id: r.consultation.id,
                consultation_date: r.consultation.consultation_date,
                diagnosis: r.consultation.diagnosis,
              }
            : null,

          registrationLog: r.registrationLog
            ? {
                id: r.registrationLog.id,
                registration_time: r.registrationLog.registration_time,
                visit_reason: r.registrationLog.visit_reason,
              }
            : null,

          organization: r.organization
            ? { id: r.organization.id, name: r.organization.name }
            : null,

          facility: r.facility
            ? { id: r.facility.id, name: r.facility.name }
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
      logger.error("[medicalRecordService.getByPatient] Error:", error);
      return [];
    }
  },
};
