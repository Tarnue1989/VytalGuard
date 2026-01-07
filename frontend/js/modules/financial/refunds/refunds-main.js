// 📦 refunds-main.js – Filters + Table/Card (Refunds)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
} from "../../../utils/index.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../../utils/data-loaders.js";

import { renderFieldSelector } from "../../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../../utils/export-utils.js";

import { renderList, renderDynamicTableHead } from "./refunds-render.js";
// ⬅️ FIX: match actual export
import { setupRefundActionHandlers } from "./refunds-actions.js";

import {
  FIELD_ORDER_REFUND,
  FIELD_DEFAULTS_REFUND,
} from "./refunds-constants.js";

import { setupVisibleFields } from "../../../utils/field-visibility.js";

// 🔐 Auth
const token = initPageGuard("refunds");
initLogoutWatcher();

// 📌 Role (normalized)
const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

// ✅ Shared state
const sharedState = { currentEditIdRef: { value: null } };

// 📋 Field visibility
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "refund",
  userRole,
  defaultFields: FIELD_DEFAULTS_REFUND,
  allowedFields: FIELD_ORDER_REFUND,
});

// 🧩 Field selector
renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, userRole, currentPage });
  },
  FIELD_ORDER_REFUND
);

// 🧩 Filter DOM Refs
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterPatient = document.getElementById("filterPatient");
const filterPatientHidden = document.getElementById("filterPatientId");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");
const filterStatus = document.getElementById("filterStatus");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");
const filterSearch = document.getElementById("filterSearch");

// ⬇️ Export buttons
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

// 🌐 View & paging state
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("refundView") || "table";

// 📋 Build filters
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    patient_id: filterPatientHidden?.value || "",
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
    q: filterSearch?.value || "", // 🔎 dynamic search
  };
}

// 📦 Load Refunds
async function loadEntries(page = 1) {
  try {
    const filters = getFilters();
    const q = new URLSearchParams();

    if (filters.created_from) q.append("created_at[gte]", filters.created_from);
    if (filters.created_to) q.append("created_at[lte]", filters.created_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v) return;
      if (k === "created_from" || k === "created_to") return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_REFUND.includes(f)
    );
    if (safeFields.length) {
      q.append("fields", safeFields.join(","));
    }

    const res = await fetch(`/api/refunds?page=${page}&limit=10&${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let result = {};
    try {
      result = await res.json();
    } catch {
      console.warn("⚠️ Response not JSON");
    }

    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || 1;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, userRole, currentPage });

    // ⬅️ FIX: call the correct function
    setupRefundActionHandlers({
      entries,
      token,
      currentPage,
      loadEntries,
      visibleFields,
      sharedState,
    });

    renderPaginationControls(
      document.getElementById("paginationButtons"),
      currentPage,
      totalPages,
      loadEntries
    );

    if (!records.length) {
      showToast("ℹ️ No refunds found for selected filters");
    }
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load refunds");
  }
}

// 🧭 View toggle
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("refundView", "table");
  renderList({ entries, visibleFields, viewMode, userRole, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("refundView", "card");
  renderList({ entries, visibleFields, viewMode, userRole, currentPage });
};

// 🔎 Filter actions
document.getElementById("filterBtn").onclick = async () => {
  try {
    showLoading();
    await loadEntries(1);
  } finally {
    hideLoading();
  }
};

document.getElementById("resetFilterBtn").onclick = () => {
  [
    "filterPatient", "filterStatus",
    "filterCreatedFrom", "filterCreatedTo", "filterSearch"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  if (filterPatientHidden) filterPatientHidden.value = "";

  if (userRole.includes("super")) {
    if (filterOrg) filterOrg.value = "";
    if (filterFacility) filterFacility.value = "";
  } else {
    const scopedOrgId = localStorage.getItem("organizationId");
    const scopedFacId = localStorage.getItem("facilityId");
    if (filterOrg) filterOrg.value = scopedOrgId || "";
    if (filterFacility) filterFacility.value = scopedFacId || "";
  }

  loadEntries(1);
};

// ⬇️ Export
if (exportCSVBtn) {
  exportCSVBtn.onclick = () => {
    exportToExcel(
      entries,
      `refunds_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };
}
if (exportPDFBtn) {
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#refundList";
    exportToPDF("Refund List", target, "portrait", true);
  };
}

// 🚀 Init module
export async function initRefundModule() {
  if (window.__refundInit) return;
  window.__refundInit = true;

  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "refundFilterVisible"
  );

  // ✅ Patient filter
  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    (selected) => {
      filterPatientHidden.value = selected?.id || "";
      if (selected) {
        filterPatient.value =
          selected.label ||
          (selected.pat_no && selected.full_name
            ? `${selected.pat_no} - ${selected.full_name}`
            : selected.full_name || selected.pat_no || "");
      }
    },
    "label"
  );

  // ✅ preload org + facilities
  try {
    const orgs = await loadOrganizationsLite();
    if (userRole.includes("super")) {
      orgs.unshift({ id: "", name: "-- All Organizations --" });
      setupSelectOptions(filterOrg, orgs, "id", "name");

      let facilities = await loadFacilitiesLite();
      facilities.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facilities, "id", "name");

      filterOrg?.addEventListener("change", async () => {
        const selectedOrgId = filterOrg.value;
        let facs = selectedOrgId
          ? await loadFacilitiesLite({ organization_id: selectedOrgId })
          : await loadFacilitiesLite();
        facs.unshift({ id: "", name: "-- All Facilities --" });
        setupSelectOptions(filterFacility, facs, "id", "name");
      });
    } else {
      const scopedOrgId = localStorage.getItem("organizationId");
      const scopedFacId = localStorage.getItem("facilityId");
      if (filterOrg) {
        const scopedOrg = orgs.find((o) => o.id === scopedOrgId);
        setupSelectOptions(filterOrg, scopedOrg ? [scopedOrg] : [], "id", "name");
        filterOrg.disabled = true;
        filterOrg.value = scopedOrgId || "";
      }
      const facilities = scopedOrgId
        ? await loadFacilitiesLite({ organization_id: scopedOrgId })
        : [];
      setupSelectOptions(filterFacility, facilities, "id", "name", "-- All Facilities --");
      if (scopedFacId) filterFacility.value = scopedFacId;
    }
  } catch (err) {
    console.error("❌ preload org/facility failed:", err);
  }

  await loadEntries(1);
}

// ❌ no-op
export function syncRefsToState() {}

// ---- boot ----
function boot() {
  initRefundModule().catch((err) => {
    console.error("initRefundModule failed:", err);
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
