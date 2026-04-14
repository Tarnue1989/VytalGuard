// 📦 accounts-filter-main.js – Enterprise Filter + Table/Card (FIXED)

// ============================================================
// 🔥 FIX: removed broken getPagination() usage
// ============================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./accounts-render.js";

import { setupActionHandlers } from "./accounts-actions.js";

import {
  FIELD_ORDER_ACCOUNT,
  FIELD_DEFAULTS_ACCOUNT,
  FIELD_LABELS_ACCOUNT,
} from "./accounts-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { setupAutoSearch, setupAutoFilters } from "../../utils/search-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";
import { syncViewToggleUI } from "../../utils/view-toggle.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

/* ============================================================
   🔐 AUTH
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
const permissions = (() => {
  try {
    return (JSON.parse(localStorage.getItem("permissions")) || []).map((p) =>
      String(p.key || p).toLowerCase()
    );
  } catch {
    return [];
  }
})();
const user = { role: userRole, permissions };

/* ============================================================
   🧠 STATE
============================================================ */
let entries = [];
let currentPage = 1;
let viewMode = localStorage.getItem("accountView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "accounts",
  userRole,
  defaultFields: FIELD_DEFAULTS_ACCOUNT,
  allowedFields: FIELD_ORDER_ACCOUNT,
});

/* ============================================================
   🧩 FIELD SELECTOR
============================================================ */
import { renderFieldSelector } from "../../utils/ui-utils.js";

renderFieldSelector(
  {},
  visibleFields,
  (fields) => {
    visibleFields = fields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_ACCOUNT
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch = qs("globalSearch");
const filterType = qs("filterType");
const filterStatus = qs("filterStatus");

/* ============================================================
   🔃 SORT
============================================================ */
window.setAccountSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadAccountPage = (p = 1) => loadEntries(p);

/* ============================================================
   🔎 AUTO SEARCH / FILTERS
============================================================ */
setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [filterType, filterStatus],
  onChange: loadEntries,
});

/* ============================================================
   📋 FILTER BUILDER
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim(),
    type: filterType?.value,
    is_active: filterStatus?.value,
  };
}

/* ============================================================
   📦 LOAD (FIXED)
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();

    const q = new URLSearchParams();

    // ✅ FIXED pagination
    const safePage = page;
    const limit = Number(localStorage.getItem("accountPageLimit") || 25);

    q.set("page", safePage);
    q.set("limit", limit);

    if (sortBy) {
      q.set("sort_by", sortBy);
      q.set("sort_order", sortDir);
    }

    const f = getFilters();

    Object.entries(f).forEach(([k, v]) => {
      if (v && String(v).trim() !== "" && v !== "null") {
        q.set(k, v);
      }
    });

    const res = await authFetch(`/api/accounts?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.message);

    const data = json.data || {};
    entries = data.records || [];
    currentPage = data.pagination?.page || safePage;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    syncViewToggleUI({ mode: viewMode });

    setupActionHandlers({
      entries,
      token,
      currentPage,
      loadEntries,
      visibleFields,
      sharedState,
      user,
    });

    renderPaginationControls(
      qs("paginationButtons"),
      currentPage,
      data.pagination?.pageCount || 1,
      loadEntries
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load accounts");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("accountView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("accountView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET FILTERS
============================================================ */
qs("resetFilterBtn").onclick = () => {
  [globalSearch, filterType, filterStatus].forEach(
    (el) => el && (el.value = "")
  );
  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");
  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_ACCOUNT),
    `accounts_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Accounts List",
    viewMode === "table" ? ".table-container" : "#accountList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initAccountModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "accountFilterVisible"
  );

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initAccountModule)
  : initAccountModule();