// 📁 backend/src/services/accessViolationService.js
import { AccessViolationLog } from "../models/index.js";
import { logger } from "../utils/logger.js";
import { auditService } from "./auditService.js";

/**
 * accessViolationService – logs unauthorized access attempts
 * Stores into access_violation_logs table for compliance + security
 * Also forwards into system_audit_logs for unified audit trail
 */
export const accessViolationService = {
  /**
   * Record an access violation
   * @param {Object} params
   * @param {string} params.module - Module name (e.g. "invoice")
   * @param {string} params.action - Action attempted (e.g. "delete", "update")
   * @param {Object} params.user - req.user (if available)
   * @param {string} [params.reason] - Optional reason
   * @param {Object} [params.transaction] - Sequelize transaction
   */
  async logViolation({ module, action, user, reason, transaction }) {
    try {
      // 1️⃣ Write to access_violation_logs table
      const log = await AccessViolationLog.create(
        {
          module,
          action,
          reason: reason || "Unauthorized",
          user_id: user?.id || null,
          organization_id: user?.organization_id || null,
          facility_id: user?.facility_id || null,
        },
        { transaction }
      );

      // 2️⃣ Forward into SystemAuditLog for unified audit history
      await auditService.logError({
        module,
        error: new Error(reason || "Unauthorized"),
        user: user || {},
        transaction,
        severity: "violation",
      });

      logger.warn(
        `[accessViolationService] Violation logged: user=${user?.id || "anonymous"} tried ${action} on ${module}`
      );

      return log;
    } catch (err) {
      logger.error("[accessViolationService] Failed to log violation", err);
      return null;
    }
  },
};
