// ============================================================================
// 📁 backend/src/config/appConfig.js
// 🧠 Central App Configuration (Single Source of Truth)
// ============================================================================

export const APP_CONFIG = {
  DEBUG: process.env.APP_DEBUG === "true",
  NODE_ENV: process.env.NODE_ENV || "development",
};
