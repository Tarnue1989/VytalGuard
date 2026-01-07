// ============================================================================
// 📁 backend/src/utils/debugLogger.js
// 🧠 Centralized Debug Logger (Enterprise Pattern)
// GLOBAL + PER-FILE OVERRIDE SUPPORT
// MANUAL ON / OFF (edit file → restart server)
// ============================================================================

// 🔴 GLOBAL MANUAL CONTROL HERE
// ------------------------------------------------------------
// 🔥 true  = DEBUG ALLOWED
// 🔕 false = DEBUG DISABLED (OVERRIDES EVERYTHING)
// ------------------------------------------------------------
let DEBUG_ENABLED = true; // ⬅️ CHANGE THIS WHEN NEEDED

// 🔘 (Optional) Runtime toggle — kept for future use
export const setDebug = (value) => {
  DEBUG_ENABLED = Boolean(value);
  console.log(`🛠 DEBUG MODE: ${DEBUG_ENABLED ? "ON" : "OFF"}`);
};

// 🔍 Global status checker
export const isDebugEnabled = () => DEBUG_ENABLED;

/* ============================================================
   🔑 FINAL DEBUG DECISION
   Global flag + file-level override
============================================================ */
export const shouldDebug = (localOverride) => {
  if (!DEBUG_ENABLED) return false;            // 🔒 Global always wins
  if (typeof localOverride === "boolean") {
    return localOverride;                     // 📁 File decides
  }
  return false;                               // 🚫 Default OFF
};

/* ============================================================
   🎯 SIMPLE GLOBAL HELPERS (NO FILE OVERRIDE)
============================================================ */
export const debugLog = (...args) => {
  if (DEBUG_ENABLED) console.log(...args);
};

export const debugWarn = (...args) => {
  if (DEBUG_ENABLED) console.warn(...args);
};

export const debugError = (...args) => {
  if (DEBUG_ENABLED) console.error(...args);
};

/* ============================================================
   🎯 MODULE / FILE-SCOPED LOGGER (WITH OVERRIDE)
============================================================ */
export const makeModuleLogger = (
  moduleName,
  localOverride = false
) => ({
  log: (...args) =>
    shouldDebug(localOverride) &&
    console.log(`🧭 [${moduleName}]`, ...args),

  warn: (...args) =>
    shouldDebug(localOverride) &&
    console.warn(`⚠️ [${moduleName}]`, ...args),

  error: (...args) =>
    shouldDebug(localOverride) &&
    console.error(`💥 [${moduleName}]`, ...args),
});
