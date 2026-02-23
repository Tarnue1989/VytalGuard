// 📁 registrationLog-render.js – Entity Card System (REGISTRATION LOG | ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH department-render.js
// 🔹 Table = flat | Card = structured (entity-card system)
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize enabled
// 🔹 Column drag reorder enabled
// 🔹 Full audit section (created / updated / deleted)
// 🔹 Permission-driven actions (superadmin-aware)
// 🔹 Export-safe
// ============================================================================

import { FIELD_LABELS_REGISTRATION_LOG } from "./registration-log-constants.js";

import {
  formatDateTime, // ⏱️ ALL registration log dates are DATE + TIME
  initTooltips,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE FIELDS (TABLE ONLY – BACKEND SAFE)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "registration_time",
  "log_status",
  "created_at",
  "updated_at",
]);

/* ============================================================
   🔃 SORT STATE (UI ONLY – MAIN OWNS BACKEND)
============================================================ */
let sortBy = localStorage.getItem("registrationLogSortBy") || "";
let sortDir = localStorage.getItem("registrationLogSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("registrationLogSortBy", sortBy);
  localStorage.setItem("registrationLogSortDir", sortDir);

  window.setRegistrationLogSort?.(sortBy, sortDir);
  window.loadRegistrationLogPage?.(1);
}

/* ============================================================
   🎛️ ACTION BUTTONS (PERMISSION-DRIVEN)
============================================================ */
function getRegistrationLogActionButtons(entry, user) {
  return buildActionButtons({
    module: "registration_log",
    status: (entry.log_status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "registration_logs",
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
      FIELD_LABELS_REGISTRATION_LOG[field] || field.replace(/_/g, " ");

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
        icon = sortDir === "asc"
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
      window.loadRegistrationLogPage?.(1);
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
    case "log_status": {
      const raw = (entry.log_status || "").toLowerCase();
      let cls = "bg-secondary";
      if (raw === "active") cls = "bg-success";
      if (raw === "pending") cls = "bg-info";
      if (raw === "completed") cls = "bg-primary";
      if (raw === "cancelled") cls = "bg-warning text-dark";
      if (raw === "voided") cls = "bg-danger";

      return `<span class="badge ${cls}">
        ${raw ? raw.toUpperCase() : "—"}
      </span>`;
    }

    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no || ""} ${entry.patient.first_name || ""} ${entry.patient.last_name || ""}`.trim() || "—"
        : "—";

    case "registrar":
      return renderUserName(entry.registrar);

    case "registration_type":
      return entry.registrationType?.name || "—";

    case "invoice":
      return entry.invoice
        ? `${entry.invoice.invoice_number} (${entry.invoice.status})`
        : "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "registration_time":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    case "is_emergency":
      return entry.is_emergency
        ? `<span class="badge bg-danger">YES</span>`
        : `<span class="badge bg-secondary">NO</span>`;

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🗂️ CARD RENDERER — REGISTRATION LOG (FULL)
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

  const status = (entry.log_status || "").toLowerCase();

  const header = `
    <div class="entity-card-header">
      <div>
        <div class="entity-secondary">
          ${safe(entry.registration_method)}
        </div>
        <div class="entity-primary">
          ${safe(entry.patient?.first_name)} ${safe(entry.patient?.last_name)}
        </div>
      </div>
      ${
        has("log_status")
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

  if (has("registrar"))
    contextItems.push(`👤 ${safe(renderUserName(entry.registrar))}`);

  if (has("registration_time"))
    contextItems.push(`🕒 ${formatDateTime(entry.registration_time)}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map((v) => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  const body = `
    <div class="entity-card-body">
      <div>
        ${has("patient_category")
          ? fieldRow("Patient Category", entry.patient_category)
          : ""}
        ${has("visit_reason")
          ? fieldRow("Visit Reason", entry.visit_reason)
          : ""}
        ${has("registration_source")
          ? fieldRow("Registration Source", entry.registration_source)
          : ""}
      </div>

      <div>
        ${has("registration_type")
          ? fieldRow("Registration Type", entry.registrationType?.name)
          : ""}
        ${has("is_emergency")
          ? fieldRow("Emergency", entry.is_emergency ? "Yes" : "No")
          : ""}
        ${has("invoice")
          ? fieldRow(
              "Invoice",
              entry.invoice ? `${entry.invoice.invoice_number}` : "—"
            )
          : ""}
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
              ${has("createdBy")
                ? fieldRow("Created By", renderUserName(entry.createdBy))
                : ""}
              ${has("created_at")
                ? fieldRow("Created At", formatDateTime(entry.created_at))
                : ""}
            </div>
            <div>
              ${has("updatedBy")
                ? fieldRow("Updated By", renderUserName(entry.updatedBy))
                : ""}
              ${has("updated_at")
                ? fieldRow("Updated At", formatDateTime(entry.updated_at))
                : ""}
              ${has("deletedBy") && entry.deletedBy
                ? fieldRow("Deleted By", renderUserName(entry.deletedBy))
                : ""}
              ${has("deleted_at") && entry.deleted_at
                ? fieldRow("Deleted At", formatDateTime(entry.deleted_at))
                : ""}
            </div>
          </div>
        </details>
      `
      : "";

  const actions = has("actions")
    ? `<div class="entity-card-footer export-ignore">
         ${getRegistrationLogActionButtons(entry, user)}
       </div>`
    : "";

  return `
    <div class="entity-card registration-log-card">
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
  const tableBody = document.getElementById("registrationLogTableBody");
  const cardContainer = document.getElementById("registrationLogList");
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
            No registration logs found.
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
                 ${getRegistrationLogActionButtons(entry, user)}
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
      : `<p class="text-muted text-center">No registration logs found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📤 EXPORT HANDLERS
============================================================ */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Registration Logs Report";

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
      selector: ".table-container.active, #registrationLogList.active",
      orientation: "landscape",
    });
  });
}
