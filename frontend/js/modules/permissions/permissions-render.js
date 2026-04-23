// 📦 permissions-render.js – ENTERPRISE MASTER (FULL)

/* ============================================================
   🔐 IMPORTS
============================================================ */
import { FIELD_LABELS_PERMISSION } from "./permissions-constants.js";
import { formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

import { exportExcelReport } from "../../utils/exportExcelReport.js";
import { exportCsvReport } from "../../utils/exportCsvReport.js";
import { printReport } from "../../utils/printBuilder.js";
import { authFetch } from "../../authSession.js";
import { formatFilters } from "../../utils/filterFormatter.js";

/* ============================================================
   🔃 SORT SYSTEM
============================================================ */
const SORTABLE_FIELDS = new Set([
  "key",
  "name",
  "module",
  "category",
  "is_global",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("permissionSortBy") || "";
let sortDir = localStorage.getItem("permissionSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("permissionSortBy", sortBy);
  localStorage.setItem("permissionSortDir", sortDir);

  window.setPermissionSort?.(sortBy, sortDir);
  window.loadPermissionPage?.(1);
}

/* ============================================================
   🛡️ SAFE HELPERS
============================================================ */
const safe = (v) =>
  v !== null && v !== undefined && v !== "" ? v : "—";

function renderUserName(u) {
  if (!u) return "—";
  return [u.first_name, u.middle_name, u.last_name]
    .filter(Boolean)
    .join(" ") || "—";
}

/* ============================================================
   🎛️ ACTION BUTTONS
============================================================ */
function getPermissionActionButtons(entry, user) {
  return buildActionButtons({
    module: "permissions",
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "permissions",
  });
}

/* ============================================================
   🧱 TABLE HEAD
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  const table = thead?.closest("table");
  if (!thead || !table) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.dataset.key = field;

    const label =
      FIELD_LABELS_PERMISSION[field] || field.replace(/_/g, " ");

    if (field === "actions") {
      th.textContent = "Actions";
      th.classList.add("actions-cell");
      tr.appendChild(th);
      return;
    }

    if (SORTABLE_FIELDS.has(field)) {
      let icon = "ri-arrow-up-down-line";

      if (sortBy === field) {
        icon =
          sortDir === "asc"
            ? "ri-arrow-up-line"
            : "ri-arrow-down-line";
      }

      th.classList.add("sortable");
      th.innerHTML = `<span>${label}</span><i class="${icon} sort-icon"></i>`;
      th.onclick = () => toggleSort(field);
    } else {
      th.innerHTML = `<span>${label}</span>`;
    }

    tr.appendChild(th);
  });

  thead.appendChild(tr);

  let colgroup = table.querySelector("colgroup");
  if (colgroup) colgroup.remove();

  colgroup = document.createElement("colgroup");
  visibleFields.forEach(() => {
    const col = document.createElement("col");
    col.style.width = "160px";
    colgroup.appendChild(col);
  });

  table.prepend(colgroup);

  enableColumnResize(table);
  enableColumnDrag({
    table,
    visibleFields,
    onReorder: () => window.loadPermissionPage?.(1),
  });
}

/* ============================================================
   🔡 VALUE RENDERER
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "is_global":
      return entry.is_global
        ? `<span class="badge bg-success">YES</span>`
        : `<span class="badge bg-secondary">NO</span>`;

    case "roles":
      return entry.roles?.length
        ? entry.roles
            .map(
              (r) =>
                `<span class="badge bg-primary">${r.name}</span>`
            )
            .join(" ")
        : "—";

    case "createdBy":
      return renderUserName(entry.createdBy);

    case "updatedBy":
      return renderUserName(entry.updatedBy);

    case "deletedBy":
      return renderUserName(entry.deletedBy);

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default: {
      const v = entry[field];
      if (v === null || v === undefined || v === "") return "—";
      if (typeof v === "object") return "—";
      return v;
    }
  }
}

/* ============================================================
   🗂️ CARD VIEW (ENTERPRISE)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);

  const row = (label, value) => {
    if (!value) return "";
    return `
      <div class="entity-field">
        <span class="entity-label">${label}</span>
        <span class="entity-value">${safe(value)}</span>
      </div>
    `;
  };

  return `
    <div class="entity-card permission-card">

      <div class="entity-card-header">
        <div>
          <div class="entity-primary">${safe(entry.key)}</div>
          <div class="entity-secondary">${safe(entry.module)}</div>
        </div>
        ${
          has("is_global")
            ? `<span class="entity-status ${
                entry.is_global ? "active" : "inactive"
              }">
                ${entry.is_global ? "GLOBAL" : "LOCAL"}
              </span>`
            : ""
        }
      </div>

      <div class="entity-card-body">
        ${row("Name", entry.name)}
        ${row("Category", entry.category)}
        ${row("Description", entry.description)}
      </div>

      <details class="entity-section">
        <summary><strong>Audit</strong></summary>
        <div class="entity-card-body">
          ${row("Created By", renderUserName(entry.createdBy))}
          ${row("Created At", formatDateTime(entry.created_at))}
          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row("Updated At", formatDateTime(entry.updated_at))}
        </div>
      </details>

      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getPermissionActionButtons(entry, user)}
             </div>`
          : ""
      }

    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("permissionTableBody");
  const cardContainer = document.getElementById("permissionList");
  const tableContainer = document.querySelector(".table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No permissions found.</td></tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");

      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">
                 ${getPermissionActionButtons(e, user)}
               </td>`
            : `<td>${renderValue(e, f)}</td>`
        )
        .join("");

      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    if (!entries.length) {
      cardContainer.innerHTML = `<p class="text-muted text-center">No permissions found.</p>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    entries.forEach((entry) => {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = renderCard(entry, visibleFields, user);
      fragment.appendChild(wrapper.firstElementChild);
    });

    cardContainer.appendChild(fragment);
    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 EXPORT (MASTER PARITY — FIXED)
============================================================ */
function setupExportHandlers(entries, visibleFields) {
  const title = "Permissions Report";

  const pdfBtn = document.getElementById("exportPDFBtn");
  const csvBtn = document.getElementById("exportCSVBtn");
  const excelBtn = document.getElementById("exportExcelBtn");

  if (!pdfBtn || !csvBtn || !excelBtn) return;

  // 🔥 RESET (same as MASTER)
  pdfBtn.replaceWith(pdfBtn.cloneNode(true));
  csvBtn.replaceWith(csvBtn.cloneNode(true));
  excelBtn.replaceWith(excelBtn.cloneNode(true));

  const newPdfBtn = document.getElementById("exportPDFBtn");
  const newCsvBtn = document.getElementById("exportCSVBtn");
  const newExcelBtn = document.getElementById("exportExcelBtn");

  /* ============================================================
     🔍 FILTERS (MATCH YOUR FILTER FILE)
  ============================================================ */
  function getFiltersFromDOM() {
    const val = (id) => document.getElementById(id)?.value;

    return {
      search: val("globalSearch")?.trim(),
      module: val("filterModule"),
      category: val("filterCategory"),
      is_global: val("filterIsGlobal"),
      dateRange: val("dateRange"),
    };
  }

  /* ============================================================
     🔁 MAP ROW (SAFE)
  ============================================================ */
  const mapRow = (e, fields) => {
    const row = {};

    fields.forEach((f) => {
      switch (f) {
        case "is_global":
          row[f] = e.is_global ? "YES" : "NO";
          break;

        case "roles":
          row[f] = e.roles?.map(r => r.name).join(", ") || "";
          break;

        case "createdBy":
          row[f] = e.createdBy
            ? `${e.createdBy.first_name || ""} ${e.createdBy.last_name || ""}`.trim()
            : "";
          break;

        case "updatedBy":
          row[f] = e.updatedBy
            ? `${e.updatedBy.first_name || ""} ${e.updatedBy.last_name || ""}`.trim()
            : "";
          break;

        case "status":
          row[f] = (e.status || "").toUpperCase();
          break;

        case "created_at":
        case "updated_at":
          row[f] = e[f] ? new Date(e[f]).toLocaleDateString() : "";
          break;

        default:
          row[f] =
            typeof e[f] === "object"
              ? ""
              : String(e[f] ?? "");
      }
    });

    return row;
  };

  /* ============================================================
     ✅ CSV
  ============================================================ */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,
      data: entries,
      visibleFields,
      fieldLabels: FIELD_LABELS_PERMISSION,
      mapRow,
    });
  });

  /* ============================================================
     ✅ EXCEL (SERVER SIDE)
  ============================================================ */
  newExcelBtn.addEventListener("click", () => {
    exportExcelReport({
      endpoint: "/api/permissions",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_PERMISSION,
      mapRow,
    });
  });

  /* ============================================================
     ✅ PDF (FULL REPORT)
  ============================================================ */
  newPdfBtn.addEventListener("click", async () => {
    try {
      const filters = getFiltersFromDOM();

      const params = new URLSearchParams();
      params.set("limit", 10000);
      params.set("page", 1);

      Object.entries(filters).forEach(([k, v]) => {
        if (!v || String(v).trim() === "" || v === "null") return;

        if (k === "dateRange") {
          const [from, to] = v.split(" - ");
          if (from) params.set("date_from", from.trim());
          if (to) params.set("date_to", to.trim());
        } else {
          params.set(k, v);
        }
      });

      const res = await authFetch(`/api/permissions?${params.toString()}`);
      const json = await res.json();
      const allEntries = json?.data?.records || [];

      const cleanFields = visibleFields.filter(
        (f) => f !== "actions"
      );

      printReport({
        title,

        columns: cleanFields.map((f) => ({
          key: f,
          label: FIELD_LABELS_PERMISSION[f] || f,
        })),

        rows: allEntries.map((e) => mapRow(e, cleanFields)),

        meta: {
          Records: allEntries.length,
        },

        context: {
          filters: formatFilters(filters, {
            sample: allEntries[0],
          }),
          printedBy: "System",
          printedAt: new Date().toLocaleString(),
        },
      });
    } catch (err) {
      console.error(err);
      alert("❌ Failed to export full report");
    }
  });
}