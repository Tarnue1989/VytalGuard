// 📁 frontend/src/js/modules/reports/report.js
// ============================================================================
// 🧭 Report Module Entrypoint (Enterprise Master Pattern)
// Loads constants, actions, main logic, and renderer in correct order
// ============================================================================

// Shared constants and configs
import "./report-constants.js";

// UI and user interactions (filter toggles, pagination, etc.)
import "./report-actions.js";

// ✅ Correct main logic (should load filters, dropdowns, and data)
import "./report-filter-main.js";   // ← use this instead of report-main.js

// Renderer (chart + summary cards + table builder)
import "./report-render.js";

console.log("✅ Report module initialized (Enterprise Pattern)");
