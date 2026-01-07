// 📁 backend/src/services/auditService.js
import { SystemAuditLog } from "../models/index.js";
import { logger } from "../utils/logger.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (THIS FILE ONLY)
   true  = debug ON for audit service
   false = debug OFF for audit service
============================================================ */
const DEBUG_OVERRIDE = false; // 👈 usually OFF for audit
const debug = makeModuleLogger("audit", DEBUG_OVERRIDE);

// fallback UUID (all zeros) when org/facility is missing
const DEFAULT_UUID = "00000000-0000-0000-0000-000000000000";

export const auditService = {
  /**
   * Log a user action to system_audit_logs
   */
  async logAction({
    module,
    action,
    entityId,
    user,
    details = {},
    entity = {},
    transaction,
  }) {
    try {
      if (!user?.id) {
        // 🚨 AUDIT WARNING — ALWAYS LOG
        logger.warn(
          `[auditService] Missing user context for module=${module}, action=${action}`
        );
        return null;
      }

      const orgId =
        entity?.organization_id ||
        user?.organization_id ||
        DEFAULT_UUID;

      const facilityId =
        entity?.facility_id ||
        user?.facility_id ||
        DEFAULT_UUID;

      debug.log("AUDIT LOG ACTION → resolved scope", {
        module,
        action,
        entityId,
        orgId,
        facilityId,
      });

      const log = await SystemAuditLog.create(
        {
          table_name: module,
          record_id: entityId,
          action,
          organization_id: orgId,
          facility_id: facilityId,
          changes: details || {},
          created_by_id: user.id,
        },
        { transaction }
      );

      // ✅ AUDIT SUCCESS — ALWAYS LOG
      logger.info(
        `[auditService] Logged action=${action} on module=${module} by user=${user.id}`
      );

      return log;
    } catch (err) {
      // 🚨 AUDIT FAILURE — ALWAYS LOG
      logger.error("[auditService] Failed to log action", err);
      return null;
    }
  },

  /**
   * Log a system error (non-user action)
   * Severity: validation | error | critical | violation
   */
  async logError({
    module = "system",
    error,
    user = {},
    entity = {},
    transaction,
    severity = "error",
  }) {
    try {
      const orgId =
        entity?.organization_id ||
        user?.organization_id ||
        DEFAULT_UUID;

      const facilityId =
        entity?.facility_id ||
        user?.facility_id ||
        DEFAULT_UUID;

      debug.log("AUDIT LOG ERROR → resolved scope", {
        module,
        severity,
        orgId,
        facilityId,
        userId: user?.id || null,
      });

      const log = await SystemAuditLog.create(
        {
          table_name: module,
          record_id: null,
          action: severity,
          organization_id: orgId,
          facility_id: facilityId,
          changes: {
            message: error?.message || "Unknown error",
            stack: error?.stack || null,
          },
          created_by_id: user?.id || null,
        },
        { transaction }
      );

      // 🚨 AUDIT ERROR — ALWAYS LOG
      logger.error(
        `[auditService] Logged ${severity} in module=${module}`,
        error
      );

      return log;
    } catch (err2) {
      // 🚨 AUDIT FAILURE — ALWAYS LOG
      logger.error(
        "[auditService] Failed to log error to SystemAuditLog",
        err2
      );
      return null;
    }
  },

  /**
   * Retrieve logs with filters
   */
  async getLogs(query = {}) {
    debug.log("AUDIT GET LOGS", { query });

    return SystemAuditLog.findAll({
      where: query,
      order: [["created_at", "DESC"]],
      limit: 100,
    });
  },
};
