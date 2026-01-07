// ----------------------------- dev toggle & auth helpers -----------------------------
// Global dev bypass toggle. Set to `true` only on your local/dev machine.
export const DEV_BYPASS_PAGE_GUARD = true;

// Return an auth token to use while bypass is active.
// - If a token exists in localStorage, return it
// - If no token, redirect to login to obtain one (preserves redirect target)
export function getAuthTokenForBypass() {
  const t = localStorage.getItem("authToken");
  if (t && typeof t === "string" && t.trim()) return t;

  // No token — redirect to login to acquire it, preserving current URL
  const redirect = encodeURIComponent(window.location.href);
  // adjust path if your login route differs
  window.location.href = `/login.html?redirect=${redirect}`;
  // throw to stop execution in current module (guarding modules should catch)
  throw new Error("Redirecting to login to obtain authToken for bypass.");
}





// ============================================================
// 🌐 UI Utilities
// ============================================================
export * from './ui-utils.js';

// ============================================================
// 🧾 Form Utilities
// ============================================================
export * from './form-utils.js';

// ============================================================
// 🔐 Auth & Session Utilities
// ============================================================
export {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
  getStoredItem,
  loadPaginatedWithCache,
  clearPaginatedCache,
} from './api-utils.js';

// ============================================================
// 📡 API Utilities (legacy or helper)
export * from './api-utils.js';

// ============================================================
// 🔍 Autocomplete (both static and dynamic loaders)
export {
  setupSuggestionInput,
  setupSuggestionInputDynamic,
} from './data-loaders.js';

// ============================================================
// 🎚️ Filter Helpers
export * from './filter-utils.js';

// ============================================================
// 🧱 Renderers & Export Helpers
export * from './render-utils.js';

// ============================================================
// 🔔 Toasts & Loaders
export * from './toast-utils.js';

// ============================================================
// 📋 Data Loaders
export * from './data-loaders.js';

// ============================================================
// ⚙️ Constants
export * from './constants.js';

// ============================================================
// 🧩 Miscellaneous
export * from './misc-utils.js';

