// 📦 surgery-filter-main.js – Filters + Table/Card (Enterprise Pattern Aligned)
// ============================================================================
// 🔹 Mirrors centralstock-filter-main.js for unified lifecycle & summary logic
// 🔹 Adds universal summary renderer using #moduleSummary
// 🔹 Handles role-aware org/facility filters, patient/surgeon search, and export tools
// 🔹 Supports dynamic records-per-page dropdown and pagination control
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadPatientsLite,
  loadEmployeesLite,
  loadBillableItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./surgery-render.js";
import { setupActionHandlers } from "./surgery-actions.js";
import {
  FIELD_ORDER_SURGERY,
  FIELD_DEFAULTS_SURGERY,
} from "./surgery-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth Guard + Session
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   👥 Role & Permissions
============================================================ */
const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

let perms = [];
try {
  const rawPerms = JSON.parse(localStorage.getItem("permissions") || "[]");
  perms = Array.isArray(rawPerms)
    ? rawPerms.map((p) => String(p.key || p).toLowerCase().trim())
    : [];
} catch {
  perms = [];
}
const user = { role: userRole, permissions: perms };

/* ============================================================
   🧠 Shared State
============================================================ */
const sharedState = { currentEditIdRef: { value: null } };
window.showForm = () => {};
window.resetForm = () => {};
window.entries = [];

/* ============================================================
   🧩 Field Visibility
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "surgery",
  userRole,
  defaultFields: FIELD_DEFAULTS_SURGERY,
  allowedFields: FIELD_ORDER_SURGERY,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_SURGERY
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterPatient = document.getElementById("filterPatient");
const filterPatientHidden = document.getElementById("filterPatientId");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");
const filterSurgeon = document.getElementById("filterSurgeon");
const filterSurgeonHidden = document.getElementById("filterSurgeonId");
const filterSurgeonSuggestions = document.getElementById("filterSurgeonSuggestions");
const filterSurgeryType = document.getElementById("filterSurgeryType");
const filterStatus = document.getElementById("filterStatus");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   📊 Universal Summary Renderer (Enhanced)
============================================================ */
function renderModuleSummary(summary = {}) {
  const container = document.getElementById("moduleSummary");
  if (!container) return;

  const colorMap = {
    scheduled: "text-primary",
    in_progress: "text-warning",
    completed: "text-success",
    verified: "text-info",
    finalized: "text-purple",
    cancelled: "text-danger",
    voided: "text-danger",
    total: "text-dark fw-bold",
    total_emergency: "text-danger fw-semibold",
  };

  const formatValue = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "object") {
      return Object.entries(val)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
    }
    return val;
  };

  const keys = Object.keys(summary);
  if (!keys.length) {
    container.innerHTML = `<div class="text-muted small">No summary data</div>`;
    return;
  }

  container.innerHTML = `
    <div class="d-flex flex-wrap gap-3 justify-content-start align-items-center fw-semibold small mb-3">
      ${keys
        .map((key) => {
          const val = formatValue(summary[key]);
          const label = key.replace(/_/g, " ").toUpperCase();
          const color = colorMap[key] || "text-dark";
          return `<span class="${color}">${label}: ${val}</span>`;
        })
        .join('<span class="text-muted"> | </span>')}
    </div>
  `;
}

/* ============================================================
   🔁 Pagination / State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("surgeryView") || "table";

const savedLimit = parseInt(localStorage.getItem("surgeryPageLimit") || "25", 10);
let getPagination = initPaginationControl("surgery", loadEntries, savedLimit);

const recordsPerPageSelect = document.getElementById("recordsPerPage");
if (recordsPerPageSelect) {
  recordsPerPageSelect.value = savedLimit;
  recordsPerPageSelect.addEventListener("change", async () => {
    const newLimit = parseInt(recordsPerPageSelect.value, 10);
    localStorage.setItem("surgeryPageLimit", newLimit);
    getPagination = initPaginationControl("surgery", loadEntries, newLimit);
    await loadEntries(1);
  });
}

/* ============================================================
   📋 Filters
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    patient_id: filterPatientHidden?.value || "",
    surgeon_id: filterSurgeonHidden?.value || "",
    surgery_type: filterSurgeryType?.value || "",
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

/* ============================================================
   📦 Load Surgeries (with Summary)
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();
    const filters = getFilters();
    const q = new URLSearchParams();
    const { page: safePage, limit: safeLimit } = getPagination(page);

    q.append("page", safePage);
    q.append("limit", safeLimit);

    if (filters.created_from) q.append("created_at[gte]", filters.created_from);
    if (filters.created_to) q.append("created_at[lte]", filters.created_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["created_from", "created_to"].includes(k)) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_SURGERY.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/surgeries?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || safePage;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, user, currentPage });
    if (payload.summary) renderModuleSummary(payload.summary);

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
      document.getElementById("paginationButtons"),
      currentPage,
      totalPages,
      loadEntries
    );

    if (!records.length) showToast("ℹ️ No surgeries found");
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load surgeries");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("surgeryView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("tableViewBtn")?.classList.add("active");
  document.getElementById("cardViewBtn")?.classList.remove("active");
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("surgeryView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("cardViewBtn")?.classList.add("active");
  document.getElementById("tableViewBtn")?.classList.remove("active");
};

/* ============================================================
   🔍 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => await loadEntries(1);
document.getElementById("resetFilterBtn").onclick = () => {
  [
    filterPatient,
    filterSurgeon,
    filterSurgeryType,
    filterStatus,
    filterCreatedFrom,
    filterCreatedTo,
  ].forEach((el) => (el ? (el.value = "") : null));
  if (filterPatientHidden) filterPatientHidden.value = "";
  if (filterSurgeonHidden) filterSurgeonHidden.value = "";
  loadEntries(1);
};

/* ============================================================
   ⬇️ Export Tools (Clean + Tight Summary Layout)
   - Includes Surgery Summary only (no extra title)
   - Matches CentralStock export behavior
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(
      entries,
      `surgeries_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    try {
      const targetSelector =
        viewMode === "table" ? ".table-container" : "#surgeryList";
      const target = document.querySelector(targetSelector);
      if (!target) return showToast("⚠️ Nothing to export");

      // 🧩 Capture and style the current summary
      const summaryEl = document.getElementById("moduleSummary");
      const summaryHTML = summaryEl
        ? `<div class="export-summary border rounded p-2 mb-2" style="
              background:#fafafa;
              font-size:11px;
              line-height:1.4;
              text-align:center;
            ">
            <h5 class="text-center fw-bold mb-1" style="
              margin:0;
              font-size:13px;
              color:#222;
            ">Surgery Summary</h5>
            ${summaryEl.innerHTML}
          </div>`
        : "";

      // 🧱 Combine summary + data table/card
      const combinedHTML = `
        <div id="exportWrapper" style="font-family:'Segoe UI',sans-serif;">
          ${summaryHTML}
          ${target.outerHTML}
        </div>
      `;

      // 🧰 Create temporary export container
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = combinedHTML;
      document.body.appendChild(tempDiv);

      // 🖨️ Generate PDF (portrait)
      exportToPDF("Surgery_List", "#exportWrapper", "portrait", true);

      // 🧹 Cleanup temporary DOM
      setTimeout(() => tempDiv.remove(), 1200);
    } catch (err) {
      console.error("❌ exportPDF failed:", err);
      showToast("❌ Failed to export PDF");
    }
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initSurgeryModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible = localStorage.getItem("surgeryFilterVisible") === "true";
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
    "surgeryFilterVisible"
  );

  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    (selected) => {
      filterPatientHidden.value = selected?.id || "";
      filterPatient.value = selected?.label || "";
    },
    "label"
  );

  setupSuggestionInputDynamic(
    filterSurgeon,
    filterSurgeonSuggestions,
    "/api/lite/employees",
    (selected) => {
      filterSurgeonHidden.value = selected?.id || "";
      filterSurgeon.value = selected?.full_name || "";
    },
    "full_name"
  );

  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      orgs.unshift({ id: "", name: "-- All Organizations --" });
      setupSelectOptions(filterOrg, orgs, "id", "name");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
        facs.unshift({ id: "", name: "-- All Facilities --" });
        setupSelectOptions(filterFacility, facs, "id", "name");
      }

      await reloadFacilities();
      filterOrg?.addEventListener("change", async () => {
        await reloadFacilities(filterOrg.value || null);
      });
    } else if (userRole.includes("admin")) {
      filterOrg?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      facs.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facs, "id", "name");
    } else {
      filterOrg?.closest(".form-group")?.classList.add("hidden");
      filterFacility?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ preload dropdowns failed:", err);
    showToast("❌ Failed to load filter dropdowns");
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initSurgeryModule().catch((err) =>
    console.error("initSurgeryModule failed:", err)
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
