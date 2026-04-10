// 📁 billable-item-render.js – Entity Card System (PART 1)
// ============================================================================
// 🔹 Converted from: prescription-render.js
// 🔹 FULL MASTER parity preserved
// 🔹 Adapted for Billable Items (prices instead of medications)
// ============================================================================

import { FIELD_LABELS_BILLABLE_ITEM } from "./billable-item-constants.js";
import { exportData } from "../../utils/export-utils.js";
import {
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE FIELDS
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "department_id",
  "name",
  "code",
  "status",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("billableItemSortBy") || "";
let sortDir = localStorage.getItem("billableItemSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("billableItemSortBy", sortBy);
  localStorage.setItem("billableItemSortDir", sortDir);

  // 🔥 send to filter file
  window.setBillableItemSort?.(sortBy, sortDir);

  // 🔥 reload
  window.loadBillableItemPage?.(1);
}
/* ============================================================
   🎛️ ACTIONS
============================================================ */
function getBillableItemActionButtons(entry, user) {
  return buildActionButtons({
    module: "billable_item",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "billable_items",
  });
}

/* ============================================================
   🔠 HELPERS
============================================================ */
const safe = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");

function renderUserName(u) {
  if (!u) return "—";
  return (
    [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ") ||
    u.full_name ||
    "—"
  );
}

/* ============================================================
   💰 RENDER PRICES (CRITICAL)
============================================================ */
function renderPrices(entry) {
  if (!Array.isArray(entry.prices) || !entry.prices.length) return "—";

  return `
    <ul class="mb-0 ps-3">
      ${entry.prices
        .map(
          (p) =>
            `<li>
              ${p.payer_type || "—"} 
              – ${p.currency || ""} 
              – ${p.price || ""}
              ${p.is_default ? " <span class='text-success'>(Default)</span>" : ""}
            </li>`
        )
        .join("")}
    </ul>
  `;
}

/* ============================================================
   🧩 VALUE RENDERER (FIXED — AUDIT + HUMAN READABLE)
============================================================ */
function renderValue(entry, field) {
  const yesNo = (v) => {
    if (v === true || v === "true" || v === 1) return "Yes";
    if (v === false || v === "false" || v === 0) return "No";
    return "—";
  };

  switch (field) {
    case "status": {
      const s = (entry.status || "").toLowerCase();
      const cls =
        s === "active"
          ? "bg-success"
          : s === "inactive"
          ? "bg-secondary"
          : s === "deleted"
          ? "bg-dark text-light"
          : "bg-secondary";

      const label = s
        ? s.charAt(0).toUpperCase() + s.slice(1)
        : "—";

      return `<span class="badge ${cls}">${label}</span>`;
    }

    case "organization":
    case "organization_id":
      return entry.organization?.name || "—";

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "department":
    case "department_id":
      return entry.department?.name || "—";

    case "masterItem":
    case "master_item_id":
      return entry.masterItem?.name || "—";

    case "prices":
      return renderPrices(entry);

    case "createdBy":
      return renderUserName(entry.createdBy);

    case "updatedBy":
      return renderUserName(entry.updatedBy);

    /* ✅ FIXED AUDIT FIELDS */
    case "created_at":
    case "createdAt":
      return entry.createdAt ? formatDateTime(entry.createdAt) : "—";

    case "updated_at":
    case "updatedAt":
      return entry.updatedAt ? formatDateTime(entry.updatedAt) : "—";

    case "deleted_at":
    case "deletedAt":
      return entry.deletedAt ? formatDateTime(entry.deletedAt) : "—";

    /* ✅ BOOLEAN FIELDS (HUMAN READABLE) */
    case "taxable":
    case "discountable":
    case "override_allowed":
    case "is_active":
      return yesNo(entry[field]);

    default: {
      const v = entry[field];
      if (v === null || v === undefined || typeof v === "object") return "—";
      return v;
    }
  }
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
      FIELD_LABELS_BILLABLE_ITEM[field] || field.replace(/_/g, " ");

    if (field === "actions") {
      th.textContent = "Actions";
      th.classList.add("actions-cell");
      tr.appendChild(th);
      return;
    }

    if (SORTABLE_FIELDS.has(field)) {
      let icon = "ri-arrow-up-down-line";
      if (sortBy === field) {
        icon = sortDir === "asc" ? "ri-arrow-up-line" : "ri-arrow-down-line";
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
    onReorder: () => window.loadBillableItemPage?.(1),
  });
}
/* ============================================================
   🗂️ CARD RENDERER (ENTERPRISE — FIXED AUDIT + HUMAN READABLE)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const row = (label, value) =>
    `<div class="entity-field">
       <span class="entity-label">${label}</span>
       <span class="entity-value">${value ?? "—"}</span>
     </div>`;

  const badge = (val) => {
    const label = val
      ? val.charAt(0).toUpperCase() + val.slice(1)
      : "—";
    return `<span class="entity-status ${val}">${label}</span>`;
  };

  const yesNo = (v) => {
    if (v === true || v === "true" || v === 1) return "Yes";
    if (v === false || v === "false" || v === 0) return "No";
    return "—";
  };

  return `
    <div class="entity-card billable-item-card">

      <!-- 🔹 HEADER -->
      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${entry.masterItem?.name || "—"}</div>
          <div class="entity-primary">${entry.name || "Billable Item"}</div>
        </div>
        ${has("status") ? badge(status) : ""}
      </div>

      <!-- 🔹 QUICK CORE -->
      <div class="entity-card-body">
        ${row("Code", entry.code)}
        ${row("Department", entry.department?.name)}
        ${row("Category", entry.category?.name)}
      </div>

      <!-- 💰 PRICING -->
      <details class="entity-section">
        <summary><strong>Pricing</strong></summary>
        <div class="entity-card-body">
          ${renderPrices(entry)}
        </div>
      </details>

      <!-- ⚙️ FLAGS -->
      <details class="entity-section">
        <summary><strong>Flags</strong></summary>
        <div class="entity-card-body">
          ${row("Taxable", yesNo(entry.taxable))}
          ${row("Discountable", yesNo(entry.discountable))}
          ${row("Override Allowed", yesNo(entry.override_allowed))}
          ${row("Active", yesNo(entry.is_active))}
        </div>
      </details>

      <!-- 🔍 AUDIT (FIXED FIELD NAMES) -->
      <details class="entity-section">
        <summary><strong>Audit</strong></summary>
        <div class="entity-card-body">
          ${row("Created By", renderUserName(entry.createdBy))}
          ${row(
            "Created At",
            entry.createdAt ? formatDateTime(entry.createdAt) : "—"
          )}
          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row(
            "Updated At",
            entry.updatedAt ? formatDateTime(entry.updatedAt) : "—"
          )}
        </div>
      </details>

      <!-- ⚙️ ACTIONS -->
      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getBillableItemActionButtons(entry, user)}
             </div>`
          : ""
      }

    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER (UNCHANGED — WORKS WITH FIXES)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("billableItemTableBody");
  const cardContainer = document.getElementById("billableItemList");
  const tableContainer = document.querySelector(".table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${visibleFields.length}" class="text-center text-muted">
            No billable items found.
          </td>
        </tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");

      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">${getBillableItemActionButtons(e, user)}</td>`
            : `<td>${renderValue(e, f)}</td>`
        )
        .join("");

      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-center text-muted">No billable items found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📤 EXPORT
============================================================ */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Billable Items Report";

  document.getElementById("exportCSVBtn")?.addEventListener("click", () =>
    exportData({ type: "csv", data: entries, title })
  );

  document.getElementById("exportExcelBtn")?.addEventListener("click", () =>
    exportData({ type: "xlsx", data: entries, title })
  );

  document.getElementById("exportPDFBtn")?.addEventListener("click", () =>
    exportData({
      type: "pdf",
      title,
      selector: ".table-container.active, #billableItemList.active",
      orientation: "landscape",
    })
  );
}