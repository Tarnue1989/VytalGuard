// 📁 master-item-render.js – Entity Card System (MASTER ITEM | ENTERPRISE PARITY)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH department-render.js
// 🔹 Table = flat | Card = structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize enabled
// 🔹 Column drag reorder enabled
// 🔹 Full audit section (created / updated / deleted)
// 🔹 Permission-driven actions
// 🔹 Export-safe
// ============================================================================

import { FIELD_LABELS_MASTER_ITEM } from "./master-item-constants.js";

import {
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

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
   🔃 SORTABLE FIELDS (TABLE ONLY – BACKEND SAFE)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "feature_module_id", // ✅ FIXED (DB column)
  "name",
  "code",
  "item_type",
  "status",
  "created_at",
  "updated_at",
]);

/* ============================================================
   🔃 SORT STATE (UI ONLY – MAIN OWNS BACKEND)
============================================================ */
let sortBy = localStorage.getItem("masterItemSortBy") || "";
let sortDir = localStorage.getItem("masterItemSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("masterItemSortBy", sortBy);
  localStorage.setItem("masterItemSortDir", sortDir);

  // 🔗 Bridge to MAIN
  window.setMasterItemSort?.(sortBy, sortDir);
  window.loadMasterItemPage?.(1);
}

/* ============================================================
   🎛️ ACTION BUTTONS
============================================================ */
function getMasterItemActionButtons(entry, user) {
  return buildActionButtons({
    module: "master_item",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "master_items",
  });
}

/* ============================================================
   🧱 DYNAMIC TABLE HEAD (SORT + RESIZE + DRAG)
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  const table = thead?.closest("table");
  if (!thead || !table) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    const label =
      FIELD_LABELS_MASTER_ITEM[field] || field.replace(/_/g, " ");

    if (field === "actions") {
      th.textContent = "Actions";
      th.classList.add("actions-cell");
      tr.appendChild(th);
      return;
    }

    th.dataset.key = field;

    if (SORTABLE_FIELDS.has(field)) {
      th.classList.add("sortable");

      let icon = "ri-arrow-up-down-line";
      if (sortBy === field) {
        icon =
          sortDir === "asc"
            ? "ri-arrow-up-line"
            : "ri-arrow-down-line";
      }

      th.innerHTML = `
        <span>${label}</span>
        <i class="${icon} sort-icon"></i>
      `;
      th.onclick = () => toggleSort(field);
    } else {
      th.innerHTML = `<span>${label}</span>`;
    }

    tr.appendChild(th);
  });

  thead.appendChild(tr);

  /* ================= Column resize ================= */
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

  /* ================= Column drag ================= */
  enableColumnDrag({
    table,
    visibleFields,
    onReorder: () => {
      renderDynamicTableHead(visibleFields);
      window.loadMasterItemPage?.(1);
    },
  });
}

/* ============================================================
   🔠 HELPERS
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [
    user.first_name,
    user.middle_name,
    user.last_name,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

/* ============================================================
   🧩 FIELD VALUE RENDERER
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      let cls = "bg-secondary";
      if (raw === "active") cls = "bg-success";
      if (raw === "inactive") cls = "bg-warning text-dark";
      if (raw === "deleted") cls = "bg-danger";

      return `<span class="badge ${cls}">
        ${raw.toUpperCase()}
      </span>`;
    }

    case "is_controlled":
    case "sample_required":
      return entry[field] === true
        ? "Yes"
        : entry[field] === false
        ? "No"
        : "—";

    case "organization":
    case "organization_id":
      return entry.organization?.name || "—";

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "category":
      return entry.category?.name || "—";

    case "department":
      return entry.department?.name || "—";

    case "feature_module":
    case "feature_module_id": // ✅ FIXED
      return entry.featureModule?.name || "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🗂️ CARD RENDERER — MASTER ITEM
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const safe = (v) =>
    v !== null && v !== undefined && v !== "" ? v : "—";

  const fieldRow = (label, value) => `
    <div class="entity-field">
      <span class="entity-label">${label}</span>
      <span class="entity-value">${safe(value)}</span>
    </div>
  `;

  const status = (entry.status || "").toLowerCase();

  const header = `
    <div class="entity-card-header">
      <div>
        <div class="entity-secondary">${safe(entry.code)}</div>
        <div class="entity-primary">${safe(entry.name)}</div>
      </div>
      ${
        has("status")
          ? `<span class="entity-status ${status}">
               ${status.toUpperCase()}
             </span>`
          : ""
      }
    </div>
  `;

  const contextItems = [];
  if (has("organization"))
    contextItems.push(`🏥 ${safe(entry.organization?.name)}`);
  if (has("facility"))
    contextItems.push(`📍 ${safe(entry.facility?.name)}`);
  if (has("feature_module"))
    contextItems.push(`🧩 ${safe(entry.featureModule?.name)}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map((v) => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  const body = `
    <div class="entity-card-body">
      ${visibleFields
        .filter(
          (f) =>
            ![
              "actions",
              "organization",
              "facility",
              "feature_module",
              "feature_module_id",
              "status",
              "created_at",
              "updated_at",
              "deleted_at",
              "createdBy",
              "updatedBy",
              "deletedBy",
            ].includes(f)
        )
        .map((f) =>
          fieldRow(
            FIELD_LABELS_MASTER_ITEM[f] || f,
            renderValue(entry, f)
          )
        )
        .join("")}
    </div>
  `;

  const audit =
    has("created_at") || has("updated_at") || has("deleted_at")
      ? `
        <details class="entity-notes">
          <summary>Audit</summary>
          <div class="entity-card-body">
            <div>
              ${
                has("createdBy")
                  ? fieldRow(
                      "Created By",
                      renderUserName(entry.createdBy)
                    )
                  : ""
              }
              ${
                has("created_at")
                  ? fieldRow(
                      "Created At",
                      formatDateTime(entry.created_at)
                    )
                  : ""
              }
            </div>
            <div>
              ${
                has("updatedBy")
                  ? fieldRow(
                      "Updated By",
                      renderUserName(entry.updatedBy)
                    )
                  : ""
              }
              ${
                has("updated_at")
                  ? fieldRow(
                      "Updated At",
                      formatDateTime(entry.updated_at)
                    )
                  : ""
              }
              ${
                has("deletedBy") && entry.deletedBy
                  ? fieldRow(
                      "Deleted By",
                      renderUserName(entry.deletedBy)
                    )
                  : ""
              }
              ${
                has("deleted_at") && entry.deleted_at
                  ? fieldRow(
                      "Deleted At",
                      formatDateTime(entry.deleted_at)
                    )
                  : ""
              }
            </div>
          </div>
        </details>
      `
      : "";

  const actions = has("actions")
    ? `<div class="entity-card-footer export-ignore">
         ${getMasterItemActionButtons(entry, user)}
       </div>`
    : "";

  return `
    <div class="entity-card master-item-card">
      ${header}
      ${context}
      ${body}
      ${audit}
      ${actions}
    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER (TABLE + CARD)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("masterItemTableBody");
  const cardContainer = document.getElementById("masterItemList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${visibleFields.length}" class="text-muted text-center">
            No items found.
          </td>
        </tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((field) =>
          field === "actions"
            ? `<td class="actions-cell text-center export-ignore">
                 ${getMasterItemActionButtons(entry, user)}
               </td>`
            : `<td>${renderValue(entry, field)}</td>`
        )
        .join("");
      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    cardContainer.innerHTML = entries.length
      ? entries
          .map((e) => renderCard(e, visibleFields, user))
          .join("")
      : `<p class="text-muted text-center">No items found.</p>`;

    initTooltips(cardContainer);
  }

 setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 EXPORT (MASTER – EXACT DEPOSIT PATTERN)
============================================================ */
function setupExportHandlers(entries, visibleFields) {
  const title = "Master Items Report";

  const pdfBtn = document.getElementById("exportPDFBtn");
  const csvBtn = document.getElementById("exportCSVBtn");
  const excelBtn = document.getElementById("exportExcelBtn");

  if (!pdfBtn || !csvBtn || !excelBtn) return;

  pdfBtn.replaceWith(pdfBtn.cloneNode(true));
  csvBtn.replaceWith(csvBtn.cloneNode(true));
  excelBtn.replaceWith(excelBtn.cloneNode(true));

  const newPdfBtn = document.getElementById("exportPDFBtn");
  const newCsvBtn = document.getElementById("exportCSVBtn");
  const newExcelBtn = document.getElementById("exportExcelBtn");

  function getFiltersFromDOM() {
    const val = (id) => document.getElementById(id)?.value;

    return {
      search: val("globalSearch")?.trim(),
      organization_id: val("filterOrganizationSelect"),
      facility_id: val("filterFacilitySelect"),
      status: val("filterStatusSelect"),
      feature_module_id: document.getElementById("filterFeatureModule")?.dataset?.value,
      dateRange: val("dateRange"),
    };
  }

  /* ================= CSV ================= */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,
      data: entries,
      visibleFields,
      fieldLabels: FIELD_LABELS_MASTER_ITEM,

      mapRow: (e, fields) => {
        const row = {};

        fields.forEach((f) => {
          switch (f) {
            case "organization":
              row[f] = e.organization?.name || "";
              break;

            case "facility":
              row[f] = e.facility?.name || "";
              break;

            case "feature_module":
              row[f] = e.featureModule?.name || "";
              break;

            case "status":
              row[f] = (e.status || "").toUpperCase();
              break;

            case "created_at":
            case "updated_at":
              row[f] = e[f]
                ? new Date(e[f]).toLocaleDateString()
                : "";
              break;

            default:
              row[f] =
                typeof e[f] === "object"
                  ? ""
                  : String(e[f] ?? "");
          }
        });

        return row;
      },
    });
  });

  /* ================= EXCEL ================= */
  newExcelBtn.addEventListener("click", () => {
    exportExcelReport({
      endpoint: "/api/master-items",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_MASTER_ITEM,

      mapRow: (e, fields) => {
        const row = {};

        fields.forEach((f) => {
          switch (f) {
            case "organization":
              row[f] = e.organization?.name || "";
              break;

            case "facility":
              row[f] = e.facility?.name || "";
              break;

            case "feature_module":
              row[f] = e.featureModule?.name || "";
              break;

            case "status":
              row[f] = (e.status || "").toUpperCase();
              break;

            case "created_at":
            case "updated_at":
              row[f] = e[f]
                ? new Date(e[f]).toLocaleDateString()
                : "";
              break;

            default:
              row[f] =
                typeof e[f] === "object"
                  ? ""
                  : String(e[f] ?? "");
          }
        });

        return row;
      },

      computeTotals: (records) => ({
        "Total Records": records.length,
      }),
    });
  });

  /* ================= PDF ================= */
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

      const res = await authFetch(
        `/api/master-items?${params.toString()}`
      );
      const json = await res.json();
      const allEntries = json?.data?.records || [];

      const cleanFields = visibleFields.filter(
        (f) =>
          f !== "actions" &&
          !["deletedBy", "deleted_at"].includes(f)
      );

      printReport({
        title,

        columns: cleanFields.map((f) => ({
          key: f,
          label: FIELD_LABELS_MASTER_ITEM[f] || f,
        })),

        rows: allEntries.map((e) => {
          const row = {};

          cleanFields.forEach((f) => {
            switch (f) {
              case "organization":
                row[f] = e.organization?.name || "";
                break;

              case "facility":
                row[f] = e.facility?.name || "";
                break;

              case "feature_module":
                row[f] = e.featureModule?.name || "";
                break;

              case "status":
                row[f] = (e.status || "").toUpperCase();
                break;

              case "created_at":
              case "updated_at":
                row[f] = e[f]
                  ? new Date(e[f]).toLocaleDateString()
                  : "";
                break;

              default:
                row[f] =
                  typeof e[f] === "object"
                    ? ""
                    : String(e[f] ?? "");
            }
          });

          return row;
        }),

        meta: {
          Records: allEntries.length,
        },

        totals: [
          {
            label: "Total Records",
            value: allEntries.length,
            final: true,
          },
        ],

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
      alert("❌ Failed to export report");
    }
  });
}