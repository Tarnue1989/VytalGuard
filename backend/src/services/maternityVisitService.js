// 📘 maternityVisitService.js – Patient Maternity Visit Service (Enterprise Edition v2)
import db from "../models/index.js";
import { logger } from "../utils/logger.js";

export const maternityVisitService = {
  /**
   * 🔍 Fetch all maternity visits for a given patient
   * Includes doctor, midwife, department, facility, organization, and invoice details.
   *
   * @param {String} patientId - Patient UUID
   * @param {Object} user - Authenticated user context
   * @returns {Promise<Array>}
   */
  async getByPatient(patientId, user = {}) {
    try {
      if (!patientId) return [];

      const visits = await db.MaternityVisit.findAll({
        where: { patient_id: patientId },
        include: [
          { model: db.Organization, as: "organization", attributes: ["id", "name"] },
          { model: db.Facility, as: "facility", attributes: ["id", "name"] },

          // ✅ FIXED: Use real name fields instead of virtual full_name
          {
            model: db.Employee,
            as: "doctor",
            attributes: ["id", "first_name", "middle_name", "last_name"],
          },
          {
            model: db.Employee,
            as: "midwife",
            attributes: ["id", "first_name", "middle_name", "last_name"],
          },

          { model: db.Department, as: "department", attributes: ["id", "name"] },
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
          {
            model: db.BillableItem,
            as: "billableItem",
            attributes: ["id", "name"],
          },
        ],
        order: [["visit_date", "ASC"]],
      });

      // ✅ Normalize and clean up structure
      return visits.map((v) => {
        const doctorFullName = v.doctor
          ? [v.doctor.first_name, v.doctor.middle_name, v.doctor.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        const midwifeFullName = v.midwife
          ? [v.midwife.first_name, v.midwife.middle_name, v.midwife.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        return {
          id: v.id,
          visit_date: v.visit_date,
          visit_type: v.visit_type,
          gravida: v.gravida,
          para: v.para,
          abortion: v.abortion,
          living: v.living,
          lnmp: v.lnmp,
          expected_due_date: v.expected_due_date,
          estimated_gestational_age: v.estimated_gestational_age,
          fundus_height: v.fundus_height,
          fetal_heart_rate: v.fetal_heart_rate,
          presentation: v.presentation,
          position: v.position,
          complaint: v.complaint,
          visit_notes: v.visit_notes,
          blood_pressure: v.blood_pressure,
          weight: v.weight,
          height: v.height,
          temperature: v.temperature,
          pulse_rate: v.pulse_rate,
          is_emergency: v.is_emergency,
          status: v.status,

          doctor: v.doctor ? { id: v.doctor.id, full_name: doctorFullName } : null,
          midwife: v.midwife ? { id: v.midwife.id, full_name: midwifeFullName } : null,

          department: v.department
            ? { id: v.department.id, name: v.department.name }
            : null,
          organization: v.organization
            ? { id: v.organization.id, name: v.organization.name }
            : null,
          facility: v.facility
            ? { id: v.facility.id, name: v.facility.name }
            : null,

          registrationLog: v.registrationLog
            ? {
                id: v.registrationLog.id,
                registration_time: v.registrationLog.registration_time,
                visit_reason: v.registrationLog.visit_reason,
              }
            : null,

          invoice: v.invoice
            ? {
                id: v.invoice.id,
                invoice_number: v.invoice.invoice_number,
                invoice_date: v.invoice.invoice_date,
                status: v.invoice.status,
              }
            : null,

          billable_item: v.billableItem
            ? { id: v.billableItem.id, name: v.billableItem.name }
            : null,

          created_at: v.created_at,
          updated_at: v.updated_at,
        };
      });
    } catch (error) {
      logger.error("[maternityVisitService.getByPatient] Error:", error);
      return [];
    }
  },
};
