// 📁 backend/src/services/jobService.js
import { logger } from "../utils/logger.js";

/**
 * jobService – background/scheduled job handler
 * Use with BullMQ, Agenda, or node-cron.
 *
 * Examples: nightly invoice auto-close, reminders, cleanup.
 */
export const jobService = {
  async runNightlyTasks() {
    try {
      logger.info("[jobService] Running nightly tasks...");

      // Example: close unpaid invoices older than 30 days
      // await Invoice.update({ status: "expired" }, { where: {...} });

      // Example: send reminders
      // await notificationService.sendEmail(...);

      logger.info("[jobService] Nightly tasks completed.");
    } catch (err) {
      logger.error("[jobService] Nightly tasks failed", err);
    }
  },

  async runAdhoc(taskName, payload) {
    try {
      logger.info(`[jobService] Running adhoc job: ${taskName}`, payload);
      // implement logic per taskName
      return true;
    } catch (err) {
      logger.error(`[jobService] Adhoc job failed: ${taskName}`, err);
      return false;
    }
  },
};
