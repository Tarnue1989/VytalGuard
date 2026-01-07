// 📘 labRequestService.js – Patient Lab Request & Results Service (Enterprise Edition v3)
import db from "../models/index.js";
import { logger } from "../utils/logger.js";

export const labRequestService = {
  /**
   * 🔍 Fetch all lab requests and results for a given patient.
   * Reflects live sync between LabRequest → Items → Results.
   * Adds progress summary + computed parent status safeguard.
   *
   * @param {String} patientId - Patient UUID
   * @param {Object} user - Authenticated user
   * @returns {Promise<Array>}
   */
  async getByPatient(patientId, user = {}) {
    try {
      if (!patientId) return [];

      const requests = await db.LabRequest.findAll({
        where: { patient_id: patientId },
        include: [
          // ─────────── CORE RELATIONS ───────────
          { model: db.Organization, as: "organization", attributes: ["id", "name", "code"] },
          { model: db.Facility, as: "facility", attributes: ["id", "name", "code"] },
          {
            model: db.Employee,
            as: "doctor",
            attributes: ["id", "first_name", "middle_name", "last_name"],
          },
          { model: db.Department, as: "department", attributes: ["id", "name"] },
          {
            model: db.RegistrationLog,
            as: "registrationLog",
            attributes: ["id", "registration_time", "visit_reason"],
          },
          {
            model: db.Consultation,
            as: "consultation",
            attributes: ["id", "consultation_date", "diagnosis", "status"],
          },
          {
            model: db.Invoice,
            as: "invoice",
            attributes: ["id", "invoice_number", "invoice_date", "status", "total"],
          },

          // ─────────── NESTED ITEMS + RESULTS ───────────
          {
            model: db.LabRequestItem,
            as: "items",
            attributes: ["id", "lab_test_id", "status", "notes"], // ✅ removed specimen_type (not in your model)
            include: [
              {
                model: db.BillableItem,
                as: "labTest",
                attributes: ["id", "name", "code", "description"],
              },
              {
                model: db.LabResult,
                as: "result",
                attributes: [
                  "id",
                  "result",
                  "notes",
                  "doctor_notes",
                  "result_date",
                  "status",
                  "attachment_url",
                  "reviewed_by_id",
                  "verified_by_id",
                  "created_at",
                  "updated_at",
                ],
                include: [
                  {
                    model: db.Employee,
                    as: "doctor",
                    attributes: ["id", "first_name", "middle_name", "last_name"],
                  },
                  { model: db.Department, as: "department", attributes: ["id", "name"] },
                  { model: db.Facility, as: "facility", attributes: ["id", "name"] },
                  { model: db.Organization, as: "organization", attributes: ["id", "name"] },
                ],
              },
            ],
          },
        ],
        order: [
          ["request_date", "DESC"],
          [{ model: db.LabRequestItem, as: "items" }, "id", "ASC"],
        ],
      });

      // ✅ Normalize results into clean client structure
      return requests.map((r) => {
        const items = r.items || [];
        const total = items.length;

        // 🔢 Compute progress summary
        const completed = items.filter((i) =>
          ["completed", "verified"].includes(i.status?.toLowerCase())
        ).length;
        const verified = items.filter((i) =>
          ["verified"].includes(i.status?.toLowerCase())
        ).length;
        const inProgress = items.some((i) => i.status?.toLowerCase() === "in_progress");
        const pending = items.every((i) => i.status?.toLowerCase() === "pending");
        const cancelled = items.every((i) => i.status?.toLowerCase() === "cancelled");
        const voided = items.every((i) => i.status?.toLowerCase() === "voided");

        // 🧩 Compute parentStatus safeguard
        let parentStatus = r.status;
        if (verified === total && total > 0) parentStatus = "verified";
        else if (completed === total && total > 0) parentStatus = "completed";
        else if (inProgress) parentStatus = "in_progress";
        else if (pending) parentStatus = "pending";
        else if (cancelled) parentStatus = "cancelled";
        else if (voided) parentStatus = "voided";
        else parentStatus = "in_progress";

        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        // 🧩 Doctor full name normalization
        const doctorFullName = r.doctor
          ? [r.doctor.first_name, r.doctor.middle_name, r.doctor.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        return {
          id: r.id,
          request_date: r.request_date,
          status: parentStatus,
          notes: r.notes,
          is_emergency: r.is_emergency,
          billed: r.billed,

          progress_summary: {
            total_items: total,
            completed_items: completed,
            verified_items: verified,
            percent: progress,
            derived_status: parentStatus,
          },

          doctor: r.doctor ? { id: r.doctor.id, full_name: doctorFullName } : null,

          department: r.department ? { id: r.department.id, name: r.department.name } : null,
          organization: r.organization ? { id: r.organization.id, name: r.organization.name } : null,
          facility: r.facility ? { id: r.facility.id, name: r.facility.name } : null,
          registrationLog: r.registrationLog
            ? {
                id: r.registrationLog.id,
                registration_time: r.registrationLog.registration_time,
                visit_reason: r.registrationLog.visit_reason,
              }
            : null,
          consultation: r.consultation
            ? {
                id: r.consultation.id,
                consultation_date: r.consultation.consultation_date,
                diagnosis: r.consultation.diagnosis,
                status: r.consultation.status,
              }
            : null,
          invoice: r.invoice
            ? {
                id: r.invoice.id,
                invoice_number: r.invoice.invoice_number,
                invoice_date: r.invoice.invoice_date,
                status: r.invoice.status,
                amount_total: r.invoice.amount_total,
              }
            : null,

          // ─────────── ITEMS & RESULTS ───────────
          items: items.map((i) => {
            const resultDoctorFullName = i.result?.doctor
              ? [
                  i.result.doctor.first_name,
                  i.result.doctor.middle_name,
                  i.result.doctor.last_name,
                ]
                  .filter(Boolean)
                  .join(" ")
              : null;

            return {
              id: i.id,
              status: i.status,
              notes: i.notes,
              lab_test: i.labTest
                ? { id: i.labTest.id, name: i.labTest.name, code: i.labTest.code }
                : null,
              result: i.result
                ? {
                    id: i.result.id,
                    result: i.result.result,
                    notes: i.result.notes,
                    doctor_notes: i.result.doctor_notes,
                    result_date: i.result.result_date,
                    status: i.result.status,
                    attachment_url: i.result.attachment_url,
                    reviewed_by_id: i.result.reviewed_by_id,
                    verified_by_id: i.result.verified_by_id,
                    doctor: i.result.doctor
                      ? { id: i.result.doctor.id, full_name: resultDoctorFullName }
                      : null,
                    department: i.result.department
                      ? { id: i.result.department.id, name: i.result.department.name }
                      : null,
                    facility: i.result.facility
                      ? { id: i.result.facility.id, name: i.result.facility.name }
                      : null,
                    organization: i.result.organization
                      ? { id: i.result.organization.id, name: i.result.organization.name }
                      : null,
                  }
                : null,
            };
          }),

          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });
    } catch (error) {
      logger.error("[labRequestService.getByPatient] Error:", error);
      return [];
    }
  },
};
