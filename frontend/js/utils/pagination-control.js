// 📘 pagination-control.js – Universal frontend records-per-page manager
import { getSafePaginationParams } from "./pagination-utils.js";

/**
 * Initialize the "Show X records" selector.
 *
 * @param {string} moduleKey   Unique module name (e.g., "patients", "appointments")
 * @param {Function} reloadFn  Callback to reload data (e.g., loadEntries)
 * @param {number} defaultLimit Optional default (e.g., 25)
 */
export function initPaginationControl(moduleKey, reloadFn, defaultLimit = 25) {
  const select = document.getElementById("recordsPerPage");

  const storageKey = `${moduleKey}PerPage`;

  // Restore previous value
  const saved = localStorage.getItem(storageKey);
  if (saved && select) select.value = saved;

  // Handle user change
  if (select) {
    select.addEventListener("change", async (e) => {
      const newLimit = parseInt(e.target.value, 10);
      localStorage.setItem(storageKey, newLimit);
      if (typeof reloadFn === "function") await reloadFn(1);
    });
  }

  // ✅ ALWAYS return function (critical)
  return (page = 1) => {
    const perPage = parseInt(
      localStorage.getItem(storageKey) || `${defaultLimit}`,
      10
    );

    return getSafePaginationParams(page, perPage);
  };
}