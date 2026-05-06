// 📁 master-item-category-render.js – Entity Card System (MASTER ITEM CATEGORY | ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL PARITY WITH department-render.js
// 🔹 Table = flat | Card = structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize enabled
// 🔹 Column drag reorder enabled
// 🔹 Full audit section (created / updated / deleted)
// 🔹 Permission-driven actions
// 🔹 Export-safe
// ============================================================================

import { FIELD_LABELS_MASTER_ITEM_CATEGORY } from "./master-item-category-constants.js";

import {
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
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
  "name",
  "code",

  // 🔥 ADD THIS
  "order_type",

  "status",
  "created_at",
  "updated_at",
]);

  /* ============================================================
    🔃 SORT STATE (UI ONLY – MAIN OWNS BACKEND)
  ============================================================ */
  let sortBy = localStorage.getItem("masterItemCategorySortBy") || "";
  let sortDir = localStorage.getItem("masterItemCategorySortDir") || "asc";

  function toggleSort(field) {
    if (sortBy === field) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortBy = field;
      sortDir = "asc";
    }

    localStorage.setItem("masterItemCategorySortBy", sortBy);
    localStorage.setItem("masterItemCategorySortDir", sortDir);

    // 🔥 EXACT FIX STARTS HERE
    const FIELD_MAP = {
      organization_id: "organization_id",
      facility_id: "facility_id",
      name: "name",
      code: "code",
      order_type: "order_type", // 🔥 REQUIRED
      status: "status",
      created_at: "created_at",
      updated_at: "updated_at",
    };

    const backendField = FIELD_MAP[sortBy] || sortBy;

    // 🔗 Bridge to MAIN (FIXED)
    window.setMasterItemCategorySort?.(backendField, sortDir);
    window.loadMasterItemCategoryPage?.(1);
  }

/* ============================================================
   🎛️ ACTION BUTTONS
============================================================ */
function getCategoryActionButtons(entry, user) {
  return buildActionButtons({
    module: "master_item_category",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "master_item_categories",
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
      FIELD_LABELS_MASTER_ITEM_CATEGORY[field] ||
      field.replace(/_/g, " ");

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
      window.loadMasterItemCategoryPage?.(1);
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

    case "organization":
    case "organization_id":
      return entry.organization?.name || "—";

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";
    case "order_type": {
      const raw = (entry.order_type || "").toLowerCase();

      const map = {
        service: "Service",
        procedure: "Procedure",
        lab: "Lab",
        medication: "Medication", // ✅ FIX
      };

      return map[raw] || raw.toUpperCase() || "—";
    }
    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🗂️ CARD RENDERER — MASTER ITEM CATEGORY
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

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map((v) => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  const body =
    has("description") || has("order_type")
      ? `
        <div class="entity-card-body">
          <div>
            ${
              has("order_type")
                ? fieldRow("Order Type", renderValue(entry, "order_type"))
                : ""
            }
            ${
              has("description")
                ? fieldRow("Description", entry.description)
                : ""
            }
          </div>
        </div>
      `
      : "";
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
         ${getCategoryActionButtons(entry, user)}
       </div>`
    : "";

  return `
    <div class="entity-card master-item-category-card">
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
  const tableBody = document.getElementById("masterItemCategoryTableBody");
  const cardContainer = document.getElementById("masterItemCategoryList");
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
            No categories found.
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
                 ${getCategoryActionButtons(entry, user)}
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
      : `<p class="text-muted text-center">No categories found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 EXPORT (MASTER – ENTERPRISE PARITY)
============================================================ */
function setupExportHandlers(entries, visibleFields) {
  const title = "Master Item Categories Report";

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

  /* =========================================================
     🔎 FILTERS
  ========================================================= */
  function getFiltersFromDOM() {
    const val = (id) => document.getElementById(id)?.value;

    return {
      search: val("globalSearch")?.trim(),
      organization_id: val("filterOrganizationSelect"),
      facility_id: val("filterFacilitySelect"),
      status: val("filterStatusSelect"),
      dateRange: val("dateRange"),
    };
  }

  /* =========================================================
     🔥 SHARED ROW MAPPER
  ========================================================= */
  const mapCategoryRow = (e, fields) => {
    const row = {};

    fields.forEach((f) => {
      switch (f) {

        /* ================= RELATIONS ================= */

        case "organization":
        case "organization_id":
          row[f] = e.organization?.name || "";
          break;

        case "facility":
        case "facility_id":
          row[f] = e.facility?.name || "";
          break;

        /* ================= STATUS ================= */

        case "status":
          row[f] = (e.status || "").toUpperCase();
          break;

        /* ================= ORDER TYPE ================= */

        case "order_type":
          row[f] = (e.order_type || "")
            .replace(/_/g, " ")
            .toUpperCase();
          break;

        /* ================= AUDIT USERS ================= */

        case "createdBy":
          row[f] = renderUserName(e.createdBy);
          break;

        case "updatedBy":
          row[f] = renderUserName(e.updatedBy);
          break;

        case "deletedBy":
          row[f] = renderUserName(e.deletedBy);
          break;

        /* ================= AUDIT DATES ================= */

        case "created_at":
          row[f] = e.created_at
            ? new Date(e.created_at).toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "";
          break;

        case "updated_at":
          row[f] = e.updated_at
            ? new Date(e.updated_at).toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "";
          break;

        case "deleted_at":
          row[f] = e.deleted_at
            ? new Date(e.deleted_at).toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "";
          break;

        /* ================= DEFAULT ================= */

        default:
          row[f] =
            typeof e[f] === "object"
              ? ""
              : String(e[f] ?? "");
      }
    });

    return row;
  };

  /* =========================================================
     ✅ CSV EXPORT
  ========================================================= */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,

      data: entries,

      visibleFields,

      fieldLabels: FIELD_LABELS_MASTER_ITEM_CATEGORY,

      mapRow: (e, fields) =>
        mapCategoryRow(e, fields),
    });
  });

  /* =========================================================
     ✅ EXCEL EXPORT
  ========================================================= */
  newExcelBtn.addEventListener("click", () => {
    exportExcelReport({
      endpoint: "/api/master-item-categories",

      title,

      filters: getFiltersFromDOM(),

      visibleFields,

      fieldLabels: FIELD_LABELS_MASTER_ITEM_CATEGORY,

      mapRow: (e, fields) =>
        mapCategoryRow(e, fields),

      computeTotals: (records) => ({
        "Total Records": records.length,
      }),
    });
  });

  /* =========================================================
     ✅ PDF EXPORT
  ========================================================= */
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
        `/api/master-item-categories?${params.toString()}`
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
          label: FIELD_LABELS_MASTER_ITEM_CATEGORY[f] || f,
        })),

        rows: allEntries.map((e) =>
          mapCategoryRow(e, cleanFields)
        ),

        meta: {
          Organization: allEntries[0]?.organization?.name || "",
          Facility: allEntries[0]?.facility?.name || "",
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

          printedAt: new Date().toLocaleString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
        },
      });

    } catch (err) {
      console.error(err);
      alert("❌ Failed to export report");
    }
  });
}