// 📦 newborn-record-filter-main.js – Filters + Table/Card (no form)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupSuggestionInputDynamic } from "../../utils/data-loaders.js";
import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./newborn-record-render.js";
import { setupActionHandlers } from "./newborn-record-actions.js";

import {
  FIELD_ORDER_NEWBORN_RECORD,
  FIELD_DEFAULTS_NEWBORN_RECORD,
} from "./newborn-record-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";

// 🔐 Auth
const token = initPageGuard("newborn-records");
initLogoutWatcher();

// 📌 Role (normalized)
const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

// ✅ Shared state
const sharedState = { currentEditIdRef: { value: null } };

// 🛟 No-form stubs
window.showForm = () => {};
window.resetForm = () => {};

// 📋 Field visibility
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "newborn_record",
  userRole,
  defaultFields: FIELD_DEFAULTS_NEWBORN_RECORD,
  allowedFields: FIELD_ORDER_NEWBORN_RECORD,
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
  FIELD_ORDER_NEWBORN_RECORD
);

// 🧩 Filter DOM Refs
const filterSearch = document.getElementById("filterSearch");
const filterSearchSuggestions = document.getElementById("filterSearchSuggestions");

const filterOrganization = document.getElementById("filterOrganization");
const filterOrganizationSuggestions = document.getElementById("filterOrganizationSuggestions");

const filterFacility = document.getElementById("filterFacility");
const filterFacilitySuggestions = document.getElementById("filterFacilitySuggestions");

const filterStatus = document.getElementById("filterStatus");
const filterMother = document.getElementById("filterMother");
const filterDelivery = document.getElementById("filterDelivery");

const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

// ⬇️ Export buttons
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

// 🌐 View & paging state
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("newbornRecordView") || "table";

// 📋 Build filters
function getFilters() {
  return {
    global: filterSearch?.dataset.value || "",
    organization_id: filterOrganization?.dataset.value || "",
    facility_id: filterFacility?.dataset.value || "",
    mother_id: filterMother?.dataset.value || "",
    delivery_record_id: filterDelivery?.dataset.value || "",
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

// ✅ Allowed DB fields only
const SAFE_DB_FIELDS = [
  "id",
  "organization", "organization_id",
  "facility", "facility_id",
  "mother", "mother_id",
  "deliveryRecord", "delivery_record_id",
  "gender",
  "birth_weight", "birth_length", "head_circumference",
  "apgar_score_1min", "apgar_score_5min",
  "measurement_notes", "complications", "notes", "status",
  "death_reason", "death_time",
  "transfer_reason", "transferFacility", "transfer_facility_id", "transfer_time",
  "void_reason", "voidedBy", "voided_by_id", "voided_at",
  "createdBy", "created_by_id",
  "updatedBy", "updated_by_id",
  "deletedBy", "deleted_by_id",
  "created_at", "updated_at", "deleted_at",
  "actions"
];


// 📦 Load Newborn Records
async function loadEntries(page = 1) {
  try {
    const filters = getFilters();
    const q = new URLSearchParams();

    // 🔑 Date range
    if (filters.created_from) {
      q.append("created_at[gte]", filters.created_from);
    }
    if (filters.created_to) {
      q.append("created_at[lte]", filters.created_to);
    }

    Object.entries(filters).forEach(([k, v]) => {
      if (!v) return;
      if (k === "created_from" || k === "created_to") return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) => SAFE_DB_FIELDS.includes(f));
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await fetch(`/api/newborn-records?page=${page}&limit=10&${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json();
    if (!res.ok) {
      showToast(result?.message || "❌ Failed to load newborn records");
      throw new Error(result?.error || "Failed to load newborn records");
    }

    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || 1;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, userRole, currentPage });

    setupActionHandlers({
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
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load newborn records");
  }
}

// 🧭 View toggle
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("newbornRecordView", "table");
  renderList({ entries, visibleFields, viewMode, userRole, currentPage });
};
document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("newbornRecordView", "card");
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
    filterSearch,
    filterOrganization,
    filterFacility,
    filterMother,
    filterDelivery,
    filterStatus,
    filterCreatedFrom,
    filterCreatedTo,
  ].forEach((el) => {
    if (el) {
      el.value = "";
      if (el.dataset) el.dataset.value = "";
    }
  });
  loadEntries(1);
};

// ⬇️ Export
if (exportCSVBtn) {
  exportCSVBtn.onclick = () => {
    exportToExcel(
      entries,
      `newborn_records_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };
}
if (exportPDFBtn) {
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#newbornRecordList";
    exportToPDF("Newborn Record List", target, "portrait", true);
  };
}

// 🚀 Init module
export async function initNewbornRecordModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible = localStorage.getItem("newbornRecordFilterVisible") === "true";

  if (filterVisible) {
    filterCollapse?.classList.remove("hidden");
    filterChevron?.classList.add("chevron-rotate");
  } else {
    filterCollapse?.classList.add("hidden");
    filterChevron?.classList.remove("chevron-rotate");
  }

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "newbornRecordFilterVisible"
  );

  // ✅ Global Search (use notes + complications as main text fields)
  if (filterSearch && filterSearchSuggestions) {
    setupSuggestionInputDynamic(
      filterSearch,
      filterSearchSuggestions,
      "/api/lite/newborn-records",
      (selected) => { filterSearch.dataset.value = selected.id },
      "notes"
    );
  }

  if (filterOrganization && filterOrganizationSuggestions) {
    setupSuggestionInputDynamic(
      filterOrganization,
      filterOrganizationSuggestions,
      "/api/lite/organizations",
      (selected) => {
        filterOrganization.dataset.value = selected.id;
        filterFacility.value = "";
        filterFacility.dataset.value = "";
      },
      "name"
    );
  }

  if (filterFacility && filterFacilitySuggestions) {
    setupSuggestionInputDynamic(
      filterFacility,
      filterFacilitySuggestions,
      "/api/lite/facilities",
      (selected) => {
        filterFacility.dataset.value = selected.id;
      },
      "name",
      {
        extraParams: () => ({
          organization_id: filterOrganization?.dataset.value || ""
        })
      }
    );
  }

  if (filterMother) {
    setupSuggestionInputDynamic(
      filterMother,
      document.getElementById("filterMotherSuggestions"),
      "/api/lite/patients",
      (selected) => { filterMother.dataset.value = selected.id },
      "full_name"
    );
  }

  if (filterDelivery) {
    setupSuggestionInputDynamic(
      filterDelivery,
      document.getElementById("filterDeliverySuggestions"),
      "/api/lite/delivery-records",
      (selected) => { filterDelivery.dataset.value = selected.id },
      "id"
    );
  }

  await loadEntries(1);
}

// ❌ no-op
export function syncRefsToState() {}

// ---- boot ----
function boot() {
  initNewbornRecordModule().catch((err) => {
    console.error("initNewbornRecordModule failed:", err);
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
