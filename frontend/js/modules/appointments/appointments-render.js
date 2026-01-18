// 📁 appointment-render.js – Entity Card System (APPOINTMENT | ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH feature-access-render.js
// 🔹 Table = flat | Card = structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize enabled
// 🔹 Column drag reorder enabled
// 🔹 Status + permission driven actions
// 🔹 Export-safe
// ============================================================================

import {
  FIELD_LABELS_APPOINTMENT,
} from "./appointments-constants.js";

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
   🔃 SORTABLE FIELDS (TABLE ONLY – BACKEND SAFE)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "patient_id",
  "doctor_id",
  "department_id",
  "status",
  "date_time",
  "created_at",
  "updated_at",
]);

/* ============================================================
   🔃 SORT STATE (UI ONLY – MAIN OWNS BACKEND)
============================================================ */
let sortBy = localStorage.getItem("appointmentSortBy") || "";
let sortDir = localStorage.getItem("appointmentSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("appointmentSortBy", sortBy);
  localStorage.setItem("appointmentSortDir", sortDir);

  // 🔗 Bridge to MAIN
  window.setAppointmentSort?.(sortBy, sortDir);
  window.loadAppointmentPage?.(1);
}

/* ============================================================
   🎛️ ACTION BUTTONS
============================================================ */
function getAppointmentActionButtons(entry, user) {
  return buildActionButtons({
    module: "appointment",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "appointments",
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
      FIELD_LABELS_APPOINTMENT[field] || field.replace(/_/g, " ");

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
      window.loadAppointmentPage?.(1);
    },
  });
}

/* ============================================================
   🔠 HELPERS
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.email || "—";
}

function renderPatient(entry) {
  const p = entry.patient;
  if (!p) return "—";
  const name = [p.first_name, p.middle_name, p.last_name]
    .filter(Boolean)
    .join(" ");
  return `${p.pat_no || "—"} - ${name || "Unnamed Patient"}`;
}

/* ============================================================
   🧩 FIELD VALUE RENDERER
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      let cls = "bg-secondary";
      if (raw === "scheduled") cls = "bg-primary";
      if (raw === "in_progress") cls = "bg-warning text-dark";
      if (raw === "completed") cls = "bg-success";
      if (raw === "verified") cls = "bg-info";
      if (raw === "cancelled") cls = "bg-danger";
      if (raw === "no_show") cls = "bg-secondary";
      if (raw === "voided") cls = "bg-dark";

      return `<span class="badge ${cls}">
        ${raw.replace(/_/g, " ").toUpperCase()}
      </span>`;
    }

    case "organization":
    case "organization_id":
      return entry.organization?.name || "—";

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "patient":
    case "patient_id":
      return renderPatient(entry);

    case "doctor":
    case "doctor_id":
      return renderUserName(entry.doctor);

    case "department":
    case "department_id":
      return entry.department?.name || "—";

    case "invoice":
      return entry.invoice?.invoice_number || "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "date_time":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🗂️ CARD RENDERER — APPOINTMENT
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const safe = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");

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
        ${has("appointment_code")
          ? `<div class="entity-secondary">${safe(entry.appointment_code)}</div>`
          : ""}
        ${has("patient")
          ? `<div class="entity-primary">${renderPatient(entry)}</div>`
          : ""}
      </div>
      ${
        has("status")
          ? `<span class="entity-status ${status}">
               ${status.replace(/_/g, " ").toUpperCase()}
             </span>`
          : ""
      }
    </div>
  `;

  const contextItems = [];
  if (has("organization")) contextItems.push(`🏥 ${safe(entry.organization?.name)}`);
  if (has("facility")) contextItems.push(`📍 ${safe(entry.facility?.name)}`);
  if (has("date_time")) contextItems.push(`📅 ${formatDateTime(entry.date_time)}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map(v => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  const body = `
    <div class="entity-card-body">
      <div>
        ${has("doctor")
          ? fieldRow("Doctor", renderUserName(entry.doctor))
          : ""}
        ${has("department")
          ? fieldRow("Department", entry.department?.name)
          : ""}
      </div>
      <div>
        ${has("invoice")
          ? fieldRow("Invoice", renderValue(entry, "invoice"))
          : ""}
      </div>
    </div>
  `;

  const audit =
    has("created_at") || has("updated_at")
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
            </div>
          </div>
        </details>
      `
      : "";

  const notes =
    has("notes") && entry.notes
      ? `
        <details class="entity-notes">
          <summary>Notes</summary>
          <p>${entry.notes}</p>
        </details>
      `
      : "";

  const actions = has("actions")
    ? `
      <div class="entity-card-footer export-ignore">
        ${getAppointmentActionButtons(entry, user)}
      </div>
    `
    : "";

  return `
    <div class="entity-card appointment-card">
      ${header}
      ${context}
      ${body}
      ${audit}
      ${notes}
      ${actions}
    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER (TABLE + CARD)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("appointmentTableBody");
  const cardContainer = document.getElementById("appointmentList");
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
            No appointments found.
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
                 ${getAppointmentActionButtons(entry, user)}
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
      : `<p class="text-muted text-center">No appointments found.</p>`;

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

  const title = "Appointments Report";

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
      selector: ".table-container.active, #appointmentList.active",
      orientation: "landscape",
    });
  });
}
