// 📘 deliveryRecordService.js – Patient Delivery Record Service (Enterprise Edition)
import db from "../models/index.js";
import { logger } from "../utils/logger.js";

export const deliveryRecordService = {
  /**
   * 🔍 Fetch all delivery records for a given patient.
   * Includes doctor, midwife, department, facility, organization, and billing context.
   *
   * @param {String} patientId - Patient UUID
   * @param {Object} user - Authenticated user
   * @returns {Promise<Array>}
   */
  async getByPatient(patientId, user = {}) {
    try {
      if (!patientId) return [];

      const records = await db.DeliveryRecord.findAll({
        where: { patient_id: patientId },
        include: [
          { model: db.Organization, as: "organization", attributes: ["id", "name"] },
          { model: db.Facility, as: "facility", attributes: ["id", "name"] },
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
        order: [["delivery_date", "ASC"]],
      });

      // ✅ Normalize output for chart integration
      return records.map((r) => {
        const doctorFullName = r.doctor
          ? [r.doctor.first_name, r.doctor.middle_name, r.doctor.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        const midwifeFullName = r.midwife
          ? [r.midwife.first_name, r.midwife.middle_name, r.midwife.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        return {
          id: r.id,
          delivery_date: r.delivery_date,
          delivery_type: r.delivery_type,
          delivery_mode: r.delivery_mode,
          baby_count: r.baby_count,
          birth_weight: r.birth_weight,
          newborn_gender: r.newborn_gender,
          apgar_score: r.apgar_score,
          complications: r.complications,
          notes: r.notes,
          is_emergency: r.is_emergency,
          status: r.status,
          department: r.department
            ? { id: r.department.id, name: r.department.name }
            : null,
          doctor: r.doctor ? { id: r.doctor.id, full_name: doctorFullName } : null,
          midwife: r.midwife ? { id: r.midwife.id, full_name: midwifeFullName } : null,
          facility: r.facility
            ? { id: r.facility.id, name: r.facility.name }
            : null,
          organization: r.organization
            ? { id: r.organization.id, name: r.organization.name }
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
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });
    } catch (error) {
      logger.error("[deliveryRecordService.getByPatient] Error:", error);
      return [];
    }
  },
};
