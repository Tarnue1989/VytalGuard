// 📁 billing-trigger-render.js – Entity Card System (BILLING TRIGGER | ENTERPRISE FINAL – FULL SAFE)

import { FIELD_LABELS_BILLING_TRIGGER } from "./billing-trigger-constants.js";

import {
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================ */
const SORTABLE_FIELDS = new Set([
  "module_key",
  "trigger_status",
  "is_active",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("billingTriggerSortBy") || "";
let sortDir = localStorage.getItem("billingTriggerSortDir") || "asc";

/* ============================================================ */
function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("billingTriggerSortBy", sortBy);
  localStorage.setItem("billingTriggerSortDir", sortDir);

  window.setBillingTriggerSort?.(sortBy, sortDir);
  window.loadBillingTriggerPage?.(1);
}

/* ============================================================ */
function getBillingTriggerActionButtons(entry, user) {
  return buildActionButtons({
    module: "billing_trigger",
    status: entry.is_active ? "active" : "inactive",
    entryId: entry.id,
    user,
    permissionPrefix: "billing_triggers",
  });
}

/* ============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  const table = thead?.closest("table");
  if (!thead || !table) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    const label =
      FIELD_LABELS_BILLING_TRIGGER[field] || field.replace(/_/g, " ");

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
    onReorder: () => {
      renderDynamicTableHead(visibleFields);
      window.loadBillingTriggerPage?.(1);
    },
  });
}

/* ============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [
    user.first_name,
    user.middle_name,
    user.last_name,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

/* ============================================================ */
function renderValue(entry, field) {
  switch (field) {
    // 🔥 NEW (SAFE ADD)
    case "featureModule":
      return entry.featureModule?.name || entry.module_key || "—";

    case "module_key":
      return entry.module_key || "—";

    case "is_active":
      return `<span class="badge ${
        entry.is_active ? "bg-success" : "bg-warning text-dark"
      }">
        ${entry.is_active ? "ACTIVE" : "INACTIVE"}
      </span>`;

    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

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

/* ============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const safe = (v) =>
    v !== null && v !== undefined && v !== "" ? v : "—";

  // 🔥 SAFE ADD (NO REMOVAL)
  const moduleName =
    entry.featureModule?.name || entry.module_key;

  const fieldRow = (label, value) => `
    <div class="entity-field">
      <span class="entity-label">${label}</span>
      <span class="entity-value">${safe(value)}</span>
    </div>
  `;

  const header = `
    <div class="entity-card-header">
      <div>
        <!-- 🔥 UPDATED DISPLAY ONLY -->
        <div class="entity-primary">${safe(moduleName)}</div>
        <div class="entity-secondary">${safe(entry.trigger_status)}</div>
      </div>
      ${
        has("is_active")
          ? `<span class="entity-status ${
              entry.is_active ? "active" : "inactive"
            }">
               ${entry.is_active ? "ACTIVE" : "INACTIVE"}
             </span>`
          : ""
      }
    </div>
  `;

  const contextItems = [];
  if (has("organization"))
    contextItems.push(`🏢 ${safe(entry.organization?.name)}`);
  if (has("facility"))
    contextItems.push(`📍 ${safe(entry.facility?.name)}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map((v) => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  const body = `
    <div class="entity-card-body">
      ${has("module_key") ? fieldRow("Module Key", entry.module_key) : ""}
      ${has("trigger_status") ? fieldRow("Trigger Status", entry.trigger_status) : ""}
    </div>
  `;

  const audit =
    has("created_at") || has("updated_at") || has("deleted_at")
      ? `
        <details class="entity-notes">
          <summary>Audit</summary>
          <div class="entity-card-body">
            <div>
              ${has("createdBy") ? fieldRow("Created By", renderUserName(entry.createdBy)) : ""}
              ${has("created_at") ? fieldRow("Created At", formatDateTime(entry.created_at)) : ""}
            </div>
            <div>
              ${has("updatedBy") ? fieldRow("Updated By", renderUserName(entry.updatedBy)) : ""}
              ${has("updated_at") ? fieldRow("Updated At", formatDateTime(entry.updated_at)) : ""}
              ${has("deletedBy") && entry.deletedBy ? fieldRow("Deleted By", renderUserName(entry.deletedBy)) : ""}
              ${has("deleted_at") && entry.deleted_at ? fieldRow("Deleted At", formatDateTime(entry.deleted_at)) : ""}
            </div>
          </div>
        </details>
      `
      : "";

  const actions = has("actions")
    ? `<div class="entity-card-footer export-ignore">
         <div class="card-actions">
           ${getBillingTriggerActionButtons(entry, user)}
         </div>
       </div>`
    : "";

  return `
    <div class="entity-card billing-trigger-card">
      ${header}
      ${context}
      ${body}
      ${audit}
      ${actions}
    </div>
  `;
}

/* ============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("billingTriggerTableBody");
  const cardContainer = document.getElementById("billingTriggerList");
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
            No billing triggers found.
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
                 ${getBillingTriggerActionButtons(entry, user)}
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
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center">No billing triggers found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================ */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Billing Triggers Report";

  document.getElementById("exportCSVBtn")?.addEventListener("click", () => {
    exportData({ type: "csv", data: entries, title });
  });

  document.getElementById("exportExcelBtn")?.addEventListener("click", () => {
    exportData({ type: "xlsx", data: entries, title });
  });

  document.getElementById("exportPDFBtn")?.addEventListener("click", () => {
    exportData({
      type: "pdf",
      title,
      selector: ".table-container.active, #billingTriggerList.active",
      orientation: "landscape",
    });
  });
}