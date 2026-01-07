// ⚙️ Miscellaneous Utilities

import { showToast } from './toast-utils.js';
import { VYTALGUARD_DEFAULTS  } from './constants.js';

/**
 * Autofill quantity field based on available and required stock.
 */
export function autofillQuantity(available, required, quantityInput) {
  if (!quantityInput) return;

  if (available <= 0) {
    quantityInput.value = 0;
    showToast("❌ No stock available");
  } else if (available < required) {
    quantityInput.value = available;
    showToast(`⚠️ Only ${available} units available. Adjusted.`);
  } else {
    quantityInput.value = required;
  }
}

/**
 * Format date string as "YYYY-MM-DD" for input[type="date"]
 */
export function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split("T")[0];
}

/**
 * Format date string as "YYYY-MM-DDTHH:MM" for datetime-local inputs.
 */
export function formatDateTimeForInput(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/**
 * Load footer info dynamically from backend or fallback defaults.
 */
export async function loadFooterInfo() {
  const footer = document.getElementById('footerInfo');
  if (!footer) return;

  try {
    const res = await fetch('/api/home-content/settings');
    const data = await res.ok ? await res.json() : {};
    footer.innerHTML = `
      ${data.hospital_name || GOLDLTE_DEFAULTS.hospital_name} Admin Portal © ${new Date().getFullYear()}<br>
      ${data.address || GOLDLTE_DEFAULTS.address} |
      ${data.contact_email || GOLDLTE_DEFAULTS.contact_email} |
      ${data.contact_phone || GOLDLTE_DEFAULTS.contact_phone}
    `;
  } catch (err) {
    const d = GOLDLTE_DEFAULTS;
    footer.innerHTML = `${d.hospital_name} Admin Portal © ${new Date().getFullYear()}<br>${d.address} | ${d.contact_email} | ${d.contact_phone}`;
  }
}

/**
 * Selection order tracker for dynamic checkboxes (used in reports).
 */
export const fieldSelectionTracker = {
  selectedFields: [],

  setupTracking(wrapperId) {
    const container = document.getElementById(wrapperId);
    if (!container) return;

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const value = cb.value;
        if (cb.checked) {
          if (!this.selectedFields.includes(value)) {
            this.selectedFields.push(value);
          }
        } else {
          this.selectedFields = this.selectedFields.filter(f => f !== value);
        }
      });
    });
  },

  reset(wrapperId) {
    this.selectedFields = [];
    const checkboxes = document.querySelectorAll(`#${wrapperId} input[type="checkbox"]:checked`);
    checkboxes.forEach(cb => this.selectedFields.push(cb.value));
  },

  getOrdered() {
    return [...this.selectedFields];
  }
};

/**
 * Cache report response data in sessionStorage.
 */
export function cacheReportData(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("📦 Failed to cache report data", e);
  }
}

/**
 * Retrieve cached report data from sessionStorage.
 */
export function getCachedReportData(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("❌ Failed to read cached report data", e);
    return null;
  }
}

/**
 * Clear all cached paginated data for a module.
 */
export function clearPaginatedCache(cacheKeyPrefix) {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(`${cacheKeyPrefix}_page_`)) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Load paginated data from cache or run the fetch function.
 */
export async function loadPaginatedWithCache(cacheKeyPrefix, page, fetchFunc) {
  const key = `${cacheKeyPrefix}_page_${page}`;
  const cached = localStorage.getItem(key);

  if (cached) {
    console.log(`✅ [CACHE HIT] ${cacheKeyPrefix} page ${page}`);
    return JSON.parse(cached);
  }

  const result = await fetchFunc(page);
  if (result?.data) {
    localStorage.setItem(key, JSON.stringify(result));
  }
  return result;
}
/**
 * 👤 Load and render the current user's profile info in the dashboard header.
 * Assumes HTML elements: #profilePic, #profileName, #profileMeta
 */
export function loadUserDashboardProfile(user) {
  const name = user?.employee?.full_name || "Unknown";
  const role = user?.role?.name || user?.role || "Role";
  const dept = user?.department?.name || "Department";
  let photoPath = user?.employee?.profile_picture;
  const fallback = "/images/default-profile.png";

  if (photoPath?.startsWith("/")) {
    // already fine
  } else if (photoPath?.includes("uploads/employees/")) {
    photoPath = `/${photoPath}`;
  } else if (photoPath) {
    photoPath = `/uploads/employees/${photoPath}`;
  }

  const nameEl = document.getElementById("profileName");
  const metaEl = document.getElementById("profileMeta");
  const imgEl = document.getElementById("profilePic");

  if (nameEl) nameEl.textContent = name;
  if (metaEl) metaEl.textContent = `${role} – ${dept}`;
  if (imgEl) {
    imgEl.src = photoPath || fallback;
    imgEl.onerror = () => { imgEl.src = fallback; };
  }
}
