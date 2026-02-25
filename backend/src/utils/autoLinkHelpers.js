// 📁 backend/src/utils/autoLinkHelpers.js
import { Op } from "sequelize";

import {
  Consultation,
  RegistrationLog,
  Invoice,
  Admission,
  TriageRecord,
} from "../models/index.js";

import {
  CONSULTATION_STATUS,
  REGISTRATION_LOG_STATUS,
  INVOICE_STATUS,
  ADMISSION_STATUS,
  TRIAGE_STATUS,
} from "../constants/enums.js";

/* ============================================================
   🔗 Universal Auto-Link Helper — ENTERPRISE MASTER
============================================================ */
export async function resolveClinicalLinks({
  value,
  user,
  orgId,
  facilityId,
  transaction,
}) {
  if (!value || !value.patient_id) return value;

  const resolved = { ...value };

  /* ================= 👤 Staff fallback ================= */
  if ("doctor_id" in resolved && !resolved.doctor_id && user?.employee_id) {
    resolved.doctor_id = user.employee_id;
  }

  if ("nurse_id" in resolved && !resolved.nurse_id && user?.employee_id) {
    resolved.nurse_id = user.employee_id;
  }

  /* ================= 🩺 Consultation ================= */
  if ("consultation_id" in resolved && !resolved.consultation_id) {
    const consult = await Consultation.findOne({
      where: {
        patient_id: resolved.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        status: {
          [Op.in]: [
            CONSULTATION_STATUS[0], // open
            CONSULTATION_STATUS[1], // in_progress
          ],
        },
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (consult) {
      resolved.consultation_id = consult.id;
      if ("doctor_id" in resolved && !resolved.doctor_id) {
        resolved.doctor_id = consult.doctor_id;
      }
    }
  }

  /* ================= 📝 Registration Log ================= */
  if ("registration_log_id" in resolved && !resolved.registration_log_id) {
    const reg = await RegistrationLog.findOne({
      where: {
        patient_id: resolved.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        log_status: {
          [Op.in]: [
            REGISTRATION_LOG_STATUS[1], // pending
            REGISTRATION_LOG_STATUS[2], // active
          ],
        },
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (reg) resolved.registration_log_id = reg.id;
  }

  /* ================= 💳 Invoice ================= */
  if ("invoice_id" in resolved && !resolved.invoice_id) {
    const invoice = await Invoice.findOne({
      where: {
        patient_id: resolved.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        status: {
          [Op.in]: [
            INVOICE_STATUS[1],
            INVOICE_STATUS[2],
            INVOICE_STATUS[3],
          ],
        },
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (invoice) resolved.invoice_id = invoice.id;
  }

  /* ================= 🏥 Admission ================= */
  if ("admission_id" in resolved && !resolved.admission_id) {
    const admission = await Admission.findOne({
      where: {
        patient_id: resolved.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        status: {
          [Op.in]: [
            ADMISSION_STATUS[0],
            ADMISSION_STATUS[1],
          ],
        },
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (admission) resolved.admission_id = admission.id;
  }

  /* ================= 🩸 Triage ================= */
  if ("triage_record_id" in resolved && !resolved.triage_record_id) {
    const triage = await TriageRecord.findOne({
      where: {
        patient_id: resolved.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        triage_status: {
          [Op.in]: [
            TRIAGE_STATUS[0],
            TRIAGE_STATUS[1],
          ],
        },
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (triage) resolved.triage_record_id = triage.id;
  }

  return resolved;
}
