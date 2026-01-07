const STORAGE_KEY = "vytalguard_table_prefs";

/* ===============================
   Load preferences
================================ */
export function loadTablePrefs(userId, moduleKey) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return all?.[userId]?.[moduleKey] || {};
  } catch {
    return {};
  }
}

/* ===============================
   Save preferences
================================ */
export function saveTablePrefs(userId, moduleKey, prefs) {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  all[userId] = all[userId] || {};
  all[userId][moduleKey] = prefs;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/* ===============================
   Apply column widths
================================ */
export function applyColumnWidths(table, widths = {}) {
  const ths = table.querySelectorAll("th");
  ths.forEach(th => {
    const key = th.dataset.key;
    if (key && widths[key]) {
      th.style.width = widths[key] + "px";
    }
  });
}
