// 📁 backend/src/utils/autoLinkHelpers.js
import { Op } from "sequelize";
import {
  Consultation,
  RegistrationLog,
  Invoice,
  Admission,
  TriageRecord,
} from "../models/index.js";
import { REGISTRATION_LOG_STATUS } from "../constants/enums.js";

/* ============================================================
   🔧 Universal auto-link helper for clinical modules
   - Detects which IDs exist in `value` and resolves only those
   - Safe for: MedicalRecord, Triage, Vital, Consultation, etc.
   ============================================================ */
export async function resolveClinicalLinks(value, orgId, facilityId, t) {
  // 🔹 Doctor fallback
  if ("doctor_id" in value && !value.doctor_id && value._currentUser?.employee_id) {
    value.doctor_id = value._currentUser.employee_id;
  }

  // 🔹 Nurse fallback
  if ("nurse_id" in value && !value.nurse_id && value._currentUser?.employee_id) {
    value.nurse_id = value._currentUser.employee_id;
  }

  // 🔹 Auto-link Consultation
  if ("consultation_id" in value && !value.consultation_id && value.patient_id) {
    const latestConsult = await Consultation.findOne({
      where: {
        patient_id: value.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        status: { [Op.in]: ["open", "in_progress"] },
      },
      order: [["created_at", "DESC"]],
      transaction: t,
    });
    if (latestConsult) {
      value.consultation_id = latestConsult.id;
      if ("doctor_id" in value && !value.doctor_id) {
        value.doctor_id = latestConsult.doctor_id;
      }
    }
  }

  // 🔹 Auto-link RegistrationLog
  if ("registration_log_id" in value && !value.registration_log_id && value.patient_id) {
    const latestReg = await RegistrationLog.findOne({
      where: {
        patient_id: value.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        log_status: { [Op.in]: [REGISTRATION_LOG_STATUS[1], REGISTRATION_LOG_STATUS[2]] }, // pending + active
      },
      order: [["created_at", "DESC"]],
      transaction: t,
    });
    if (latestReg) value.registration_log_id = latestReg.id;
  }

  // 🔹 Auto-link Invoice
  if ("invoice_id" in value && !value.invoice_id && value.patient_id) {
    const latestInvoice = await Invoice.findOne({
      where: {
        patient_id: value.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        status: { [Op.in]: ["open", "unpaid"] },
      },
      order: [["created_at", "DESC"]],
      transaction: t,
    });
    if (latestInvoice) value.invoice_id = latestInvoice.id;
  }

  // 🔹 Auto-link Admission
  if ("admission_id" in value && !value.admission_id && value.patient_id) {
    const latestAdmission = await Admission.findOne({
      where: {
        patient_id: value.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        status: { [Op.in]: ["active", "admitted"] },
      },
      order: [["created_at", "DESC"]],
      transaction: t,
    });
    if (latestAdmission) value.admission_id = latestAdmission.id;
  }

  // 🔹 Auto-link TriageRecord
  if ("triage_record_id" in value && !value.triage_record_id && value.patient_id) {
    const latestTriage = await TriageRecord.findOne({
      where: {
        patient_id: value.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        triage_status: { [Op.in]: ["open", "in_progress"] },
      },
      order: [["created_at", "DESC"]],
      transaction: t,
    });
    if (latestTriage) value.triage_record_id = latestTriage.id;
  }

  return value;
}
