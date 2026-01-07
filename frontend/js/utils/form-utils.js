// 📑 Form & Input Utilities

import { setupFloatingLabels } from './ui-utils.js';

/**
 * Show a form container and hide the appropriate Add button (desktop or mobile).
 * @param {string} formContainerId
 * @param {string} desktopBtnId
 * @param {string} floatBtnId
 */
export function showAdminForm(formContainerId, desktopBtnId, floatBtnId) {
  const form = document.getElementById(formContainerId);
  const desktopBtn = document.getElementById(desktopBtnId);
  const floatBtn = document.getElementById(floatBtnId);

  if (!form) return;
  form.classList.remove("hidden");
  if (window.innerWidth >= 769 && desktopBtn) desktopBtn.style.display = "none";
  if (window.innerWidth < 769 && floatBtn) floatBtn.style.display = "none";
  form.scrollIntoView({ behavior: "smooth" });
}

/**
 * Hide a form container and re-show the appropriate Add button (desktop or mobile).
 */
export function hideAdminForm(formContainerId, desktopBtnId, floatBtnId) {
  const form = document.getElementById(formContainerId);
  const desktopBtn = document.getElementById(desktopBtnId);
  const floatBtn = document.getElementById(floatBtnId);

  if (!form) return;
  form.classList.add("hidden");

  if (window.innerWidth >= 769) {
    if (desktopBtn) desktopBtn.style.display = "inline-block";
    if (floatBtn) floatBtn.style.display = "none";
  } else {
    if (desktopBtn) desktopBtn.style.display = "none";
    if (floatBtn) floatBtn.style.display = "flex";
  }
}

/**
 * Reset a form but preserve specific input field values.
 * @param {HTMLFormElement} form
 * @param {string[]} fieldIds - IDs to preserve
 */
export function resetFormWithPreservedField(form, fieldIds = []) {
  const preserved = {};
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) preserved[id] = el.value;
  });
  form.reset();
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && preserved[id]) el.value = preserved[id];
  });
  setupFloatingLabels(form);
}

/**
 * Trim a string and return null if it's empty.
 * @param {string} value
 * @returns {string|null}
 */
export function normalize(value) {
  return typeof value === "string" ? value.trim() || null : value;
}

/**
 * Sets up a clear search button for a search input.
 * @param {string} inputId
 * @param {string} clearBtnId
 * @param {function} onClearCallback
 */
export function setupSearchClear(inputId, clearBtnId, onClearCallback) {
  const input = document.getElementById(inputId);
  const clearBtn = document.getElementById(clearBtnId);

  if (!input || !clearBtn) return;

  input.addEventListener("input", () => {
    clearBtn.style.display = input.value ? "inline-block" : "none";
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.style.display = "none";
    if (typeof onClearCallback === "function") onClearCallback();
  });
}

/**
 * Show a confirmation modal if required fields are missing.
 * @param {string[]} fields
 * @param {Function} onConfirm
 */
export function confirmMissingFields(fields, onConfirm) {
  if (!Array.isArray(fields) || fields.length === 0) return;

  const fieldList = fields.map(f => `• ${f}`).join('<br>');
  const message = `
    <strong>Some required fields are missing:</strong><br><br>
    ${fieldList}<br><br>
    Do you want to <strong>continue anyway</strong>?
  `;

  import('./toast-utils.js').then(({ showConfirm }) => {
    showConfirm(message, onConfirm);
  });
}
