// 📁 insurance-provider-render.js – Entity Card System (INSURANCE PROVIDER | ENTERPRISE FINAL)
// ============================================================================
// 🔹 Converted from role-render.js (MASTER PARITY)
// 🔹 Table = flat | Card = structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize enabled
// 🔹 Column drag reorder enabled
// 🔹 Full audit section
// 🔹 Permission-driven actions
// 🔹 Export-safe
// ============================================================================

import { FIELD_LABELS_INSURANCE_PROVIDER } from "./insurance-provider-constants.js";

import {
  formatDate,
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE FIELDS
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "name",
  "email",
  "phone",
  "status",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("insuranceProviderSortBy") || "";
let sortDir = localStorage.getItem("insuranceProviderSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("insuranceProviderSortBy", sortBy);
  localStorage.setItem("insuranceProviderSortDir", sortDir);

  window.setInsuranceProviderSort?.(sortBy, sortDir);
  window.loadInsuranceProviderPage?.(1);
}

/* ============================================================
   🎛️ ACTION BUTTONS
============================================================ */
function getInsuranceProviderActionButtons(entry, user) {
  return buildActionButtons({
    module: "insurance_provider",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "insurance_providers",
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
    const label = FIELD_LABELS_INSURANCE_PROVIDER[field] || field.replace(/_/g, " ");

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
        icon = sortDir === "asc" ? "ri-arrow-up-line" : "ri-arrow-down-line";
      }

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
    onReorder: () => {
      renderDynamicTableHead(visibleFields);
      window.loadInsuranceProviderPage?.(1);
    },
  });
}

/* ============================================================
   🔠 HELPERS
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.username || user.email || "—";
}

/* ============================================================
   🧩 FIELD VALUE
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      let cls = "bg-secondary";
      if (raw === "active") cls = "bg-success";
      if (raw === "inactive") cls = "bg-warning text-dark";
      if (raw === "deleted") cls = "bg-danger";

      return `<span class="badge ${cls}">${raw.toUpperCase()}</span>`;
    }

    case "organization":
    case "organization_id":
      return entry.organization?.name || "—";

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "created_by":
      return renderUserName(entry.createdBy);

    case "updated_by":
      return renderUserName(entry.updatedBy);

    case "deleted_by":
      return renderUserName(entry.deletedBy);

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
   🗂️ CARD
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = f => visibleFields.includes(f);
  const safe = v => (v !== null && v !== undefined && v !== "" ? v : "—");

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
        <div class="entity-primary">${safe(entry.name)}</div>
        <div class="entity-secondary">${safe(entry.email)}</div>
      </div>
      ${
        has("status")
          ? `<span class="entity-status ${status}">${status.toUpperCase()}</span>`
          : ""
      }
    </div>
  `;

  const contextItems = [];
  if (has("organization")) contextItems.push(`🏥 ${safe(entry.organization?.name)}`);
  if (has("facility")) contextItems.push(`📍 ${safe(entry.facility?.name)}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map(v => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  const body = `
    <div class="entity-card-body">
      <div>
        ${has("phone") ? fieldRow("Phone", entry.phone) : ""}
        ${has("contact_info") ? fieldRow("Contact Info", entry.contact_info) : ""}
        ${has("address") ? fieldRow("Address", entry.address) : ""}
      </div>
      <div></div>
    </div>
  `;

const audit =
  entry.created_at ||
  entry.updated_at ||
  entry.deleted_at ||
  entry.createdBy ||
  entry.updatedBy ||
  entry.deletedBy
    ? `
      <details class="entity-notes">
        <summary>Audit</summary>
        <div class="entity-card-body">

          <div>
            ${
              entry.createdBy
                ? fieldRow("Created By", renderUserName(entry.createdBy))
                : ""
            }
            ${
              entry.created_at
                ? fieldRow("Created At", formatDateTime(entry.created_at))
                : ""
            }
          </div>

          <div>
            ${
              entry.updatedBy
                ? fieldRow("Updated By", renderUserName(entry.updatedBy))
                : ""
            }
            ${
              entry.updated_at
                ? fieldRow("Updated At", formatDateTime(entry.updated_at))
                : ""
            }
          </div>

          <div>
            ${
              entry.deletedBy
                ? fieldRow("Deleted By", renderUserName(entry.deletedBy))
                : ""
            }
            ${
              entry.deleted_at
                ? fieldRow("Deleted At", formatDateTime(entry.deleted_at))
                : ""
            }
          </div>

        </div>
      </details>
    `
    : "";
  const actions = has("actions")
    ? `<div class="entity-card-footer export-ignore">
         ${getInsuranceProviderActionButtons(entry, user)}
       </div>`
    : "";

  return `
    <div class="entity-card insurance-provider-card">
      ${header}
      ${context}
      ${body}
      ${audit}
      ${actions}
    </div>
  `;
}

/* ============================================================
   📋 LIST
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("insuranceProviderTableBody");
  const cardContainer = document.getElementById("insuranceProviderList");
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
            No providers found.
          </td>
        </tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach(entry => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields.map(field =>
        field === "actions"
          ? `<td class="actions-cell text-center export-ignore">
               ${getInsuranceProviderActionButtons(entry, user)}
             </td>`
          : `<td>${renderValue(entry, field)}</td>`
      ).join("");
      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    cardContainer.innerHTML = entries.length
      ? entries.map(e => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center">No providers found.</p>`;

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

  const title = "Insurance Providers Report";

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
      selector: ".table-container.active, #insuranceProviderList.active",
      orientation: "landscape",
    });
  });
}