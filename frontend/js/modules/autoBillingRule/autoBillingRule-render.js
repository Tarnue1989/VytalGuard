// 📁 autoBillingRule-render.js – FULL ENTERPRISE MASTER PARITY (UPGRADED)
// ============================================================================
// 🧭 Mirrors registrationLog-render.js MASTER EXACTLY
// 🔹 Table = flat | Card = structured (entity-card system)
// 🔹 Sorting bridge (UI → backend)
// 🔹 Column resize + drag enabled
// 🔹 Full audit section
// 🔹 Permission-driven actions
// 🔹 Export-safe
// 🔹 NO API / NO state logic
// ============================================================================

import { FIELD_LABELS_AUTO_BILLING_RULE } from "./autoBillingRule-constants.js";

import {
  formatDate,
  initTooltips,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE FIELDS (TABLE ONLY)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "status",
  "created_at",
  "updated_at",
]);

/* ============================================================
   🔃 SORT STATE (UI ONLY)
============================================================ */
let sortBy = localStorage.getItem("autoBillingRuleSortBy") || "";
let sortDir = localStorage.getItem("autoBillingRuleSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("autoBillingRuleSortBy", sortBy);
  localStorage.setItem("autoBillingRuleSortDir", sortDir);

  window.setAutoBillingRuleSort?.(sortBy, sortDir);
  window.loadAutoBillingRulePage?.(1);
}

/* ============================================================
   🎛️ ACTION BUTTONS
============================================================ */
function getAutoBillingRuleActionButtons(entry, user) {
  return buildActionButtons({
    module: "auto_billing_rule",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "auto_billing_rules",
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
      FIELD_LABELS_AUTO_BILLING_RULE[field] || field.replace(/_/g, " ");

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

  /* ---------- Column Resize ---------- */
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

  /* ---------- Column Drag ---------- */
  enableColumnDrag({
    table,
    visibleFields,
    onReorder: () => {
      renderDynamicTableHead(visibleFields);
      window.loadAutoBillingRulePage?.(1);
    },
  });
}

/* ============================================================
   🔠 HELPERS
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.full_name || "—";
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
        ${raw ? raw.toUpperCase() : "—"}
      </span>`;
    }

    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    case "trigger_feature_module":
      return entry.featureModule?.name || "—";

    case "trigger_module":
      return entry.featureModule?.name || "—";

    case "billableItem":
      return entry.billableItem?.name || "—";

    case "auto_generate":
      return entry.auto_generate
        ? `<span class="badge bg-success">YES</span>`
        : `<span class="badge bg-secondary">NO</span>`;

    case "charge_mode":
      return entry.charge_mode || "—";

    case "default_price":
      return entry.default_price != null
        ? `$${Number(entry.default_price).toFixed(2)}`
        : "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🗂️ CARD RENDERER (ENTERPRISE STRUCTURE)
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
        <div class="entity-secondary">
          ${safe(entry.featureModule?.name)}
        </div>
        <div class="entity-primary">
          ${safe(entry.featureModule?.name)}
        </div>
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

  const context = `
    <div class="entity-card-context">
      ${has("organization") ? `<div>🏥 ${safe(entry.organization?.name)}</div>` : ""}
      ${has("facility") ? `<div>📍 ${safe(entry.facility?.name)}</div>` : ""}
      ${has("billableItem") ? `<div>💳 ${safe(entry.billableItem?.name)}</div>` : ""}
    </div>
  `;

  const body = `
    <div class="entity-card-body">
      <div>
        ${has("charge_mode") ? fieldRow("Charge Mode", entry.charge_mode) : ""}
        ${has("default_price") ? fieldRow("Default Price", `$${entry.default_price || 0}`) : ""}
      </div>
      <div>
        ${has("auto_generate") ? fieldRow("Auto Generate", entry.auto_generate ? "Yes" : "No") : ""}
      </div>
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
              ${has("created_at") ? fieldRow("Created At", formatDate(entry.created_at)) : ""}
            </div>
            <div>
              ${has("updatedBy") ? fieldRow("Updated By", renderUserName(entry.updatedBy)) : ""}
              ${has("updated_at") ? fieldRow("Updated At", formatDate(entry.updated_at)) : ""}
              ${has("deletedBy") ? fieldRow("Deleted By", renderUserName(entry.deletedBy)) : ""}
              ${has("deleted_at") ? fieldRow("Deleted At", formatDate(entry.deleted_at)) : ""}
            </div>
          </div>
        </details>
      `
      : "";

  const actions = has("actions")
    ? `<div class="entity-card-footer export-ignore">
         ${getAutoBillingRuleActionButtons(entry, user)}
       </div>`
    : "";

  return `
    <div class="entity-card auto-billing-rule-card">
      ${header}
      ${context}
      ${body}
      ${audit}
      ${actions}
    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("autoBillingRuleTableBody");
  const cardContainer = document.getElementById("autoBillingRuleList");
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
            No auto billing rules found.
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
                 ${getAutoBillingRuleActionButtons(entry, user)}
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
      : `<p class="text-muted text-center">No auto billing rules found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 EXPORT HANDLERS
============================================================ */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Auto Billing Rules Report";

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
      selector: ".table-container.active, #autoBillingRuleList.active",
      orientation: "landscape",
    });
  });
}