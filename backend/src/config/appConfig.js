// ============================================================================
// 📁 backend/src/config/appConfig.js
// 🧠 Global Application Configuration
// Centralized control for debug, environment, and feature flags
// ============================================================================

export const APP_CONFIG = {
  APP_NAME: "VytalGuard HMS",
  VERSION: "1.0.0",

  // 🌐 Environment flags
  ENV: process.env.NODE_ENV || "development",

  // 🧩 Master Debug Toggle
  DEBUG: process.env.APP_DEBUG === "true" || process.env.NODE_ENV !== "production",

  // 🧱 Feature-specific toggles (extend freely)
  FEATURES: {
    ENABLE_AUDIT_LOGS: true,
    ENABLE_REPORT_DEBUG: true,
    ENABLE_API_TRACE: false,
  },
};
