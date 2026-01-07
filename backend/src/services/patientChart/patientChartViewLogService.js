// 📘 patientChartViewLogService.js – Patient Chart Access Logging (Enterprise Compliant)
import db from "../../models/index.js";
import { auditService } from "../auditService.js";
import { logger } from "../../utils/logger.js";

export const patientChartViewLogService = {
  /**
   * 🧾 Log any chart access (view/export/print)
   * @param {Object} params - { patient_id, user, action, ip, userAgent }
   */
  async logView({ patient_id, user, action = "view", ip = null, userAgent = null }) {
    try {
      await db.PatientChartViewLog.create({
        patient_id,
        user_id: user.id,
        organization_id: user.organization_id,
        facility_id: user.facility_id,
        action,
        ip_address: ip,
        user_agent: userAgent,
        created_by_id: user.id,
      });

      await auditService.logAction({
        module: "patient_chart",
        action: `viewlog_${action}`,
        entityId: patient_id,
        user,
        details: { ip, userAgent },
      });
    } catch (error) {
      logger.error("[patientChartViewLogService.logView]", error);
    }
  },

  /**
   * 📜 Fetch all view logs for a patient
   */
  async listByPatient(patient_id) {
    try {
      return await db.PatientChartViewLog.findAll({
        where: { patient_id },
        order: [["viewed_at", "DESC"]],
        include: [
          {
            model: db.User,
            as: "viewer",
            attributes: ["id", "full_name", "email"],
          },
        ],
      });
    } catch (error) {
      logger.error("[patientChartViewLogService.listByPatient]", error);
      throw error;
    }
  },
};
