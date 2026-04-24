// 📁 triage-record-render.js – Entity Card System (TRIAGE RECORD | ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH vital-render.js
// 🔹 Table = flat | Card = structured (entity-card system)
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize enabled
// 🔹 Column drag reorder enabled
// 🔹 Full audit section (created / updated / deleted / verified / finalized / voided)
// 🔹 Permission-driven actions (superadmin-aware)
// 🔹 Export-safe
// ============================================================================

import { FIELD_LABELS_TRIAGE_RECORD } from "./triage-record-constants.js";

import {
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
  "recorded_at",
  "triage_status",
  "created_at",
  "updated_at",
]);

/* ============================================================
   🔃 SORT STATE (UI ONLY – MAIN OWNS BACKEND)
============================================================ */
let sortBy = localStorage.getItem("triageRecordSortBy") || "";
let sortDir = localStorage.getItem("triageRecordSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("triageRecordSortBy", sortBy);
  localStorage.setItem("triageRecordSortDir", sortDir);

  window.setTriageRecordSort?.(sortBy, sortDir);
  window.loadTriageRecordPage?.(1);
}

/* ============================================================
   🎛️ ACTION BUTTONS (PERMISSION-DRIVEN)
============================================================ */
function getTriageRecordActionButtons(entry, user) {
  return buildActionButtons({
    module: "triage_record",
    status: (entry.triage_status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "triage_records",
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
      FIELD_LABELS_TRIAGE_RECORD[field] || field.replace(/_/g, " ");

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
      window.loadTriageRecordPage?.(1);
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

function renderPatient(entry) {
  const p = entry.patient;
  if (!p) return "—";
  const patNo = p.pat_no || "";
  const name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
  return `${patNo} ${name}`.trim() || "—";
}

/* ============================================================
   🧩 FIELD VALUE RENDERER
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "triage_status": {
      const raw = (entry.triage_status || "").toLowerCase();
      let cls = "bg-secondary";
      if (raw === "open") cls = "bg-info";
      if (raw === "in_progress") cls = "bg-warning text-dark";
      if (raw === "completed") cls = "bg-primary";
      if (raw === "verified") cls = "bg-success";
      if (raw === "finalized") cls = "bg-dark";
      if (raw === "cancelled") cls = "bg-danger";
      if (raw === "voided") cls = "bg-secondary";

      return `<span class="badge ${cls}">
        ${raw ? raw.toUpperCase() : "—"}
      </span>`;
    }

    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    case "patient":
      return renderPatient(entry);

    case "doctor":
      return renderUserName(entry.doctor);

    case "nurse":
      return renderUserName(entry.nurse);

    case "registrationLog":
      return entry.registrationLog
        ? `${formatDateTime(entry.registrationLog.registration_time)} (${entry.registrationLog.log_status})`
        : "—";

    case "triageType":
      return entry.triageType?.name || "—";

    case "invoice":
      return entry.invoice
        ? `${entry.invoice.invoice_number || ""} (${entry.invoice.status || "—"})`
        : "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
    case "verifiedBy":
    case "finalizedBy":
    case "voidedBy":
      return renderUserName(entry[field]);

    case "recorded_at":
    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "verified_at":
    case "finalized_at":
    case "voided_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🧱 CARD RENDERER (ENTITY SYSTEM)
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

  const status = (entry.triage_status || "").toLowerCase();

  const header = `
    <div class="entity-card-header">
      <div>
        <div class="entity-secondary">
          ${has("recorded_at") ? formatDateTime(entry.recorded_at) : "—"}
        </div>
        <div class="entity-primary">
          ${renderPatient(entry)}
        </div>
      </div>
      ${
        has("triage_status")
          ? `<span class="entity-status ${status}">
               ${status.toUpperCase()}
             </span>`
          : ""
      }
    </div>
  `;

  const context = `
    <div class="entity-card-context">
      <div>🏥 ${safe(entry.organization?.name)}</div>
      <div>📍 ${safe(entry.facility?.name)}</div>
      <div>👤 ${renderUserName(entry.nurse)}</div>
    </div>
  `;

  const body = `
    <div class="entity-card-body">
      <div>
        ${fieldRow("Blood Pressure", entry.bp)}
        ${fieldRow("Pulse", entry.pulse)}
        ${fieldRow("Resp. Rate", entry.rr)}
        ${fieldRow("Temperature", entry.temp)}
        ${fieldRow("SpO₂", entry.oxygen)}
      </div>
      <div>
        ${fieldRow("Weight", entry.weight)}
        ${fieldRow("Height", entry.height)}
        ${fieldRow("RBG", entry.rbg)}
        ${fieldRow("Pain Score", entry.pain_score)}
        ${fieldRow("Position", entry.position)}
      </div>
    </div>
  `;

  const audit = `
    <details class="entity-notes">
      <summary>Audit</summary>
      <div class="entity-card-body">
        <div>
          ${fieldRow("Created By", renderUserName(entry.createdBy))}
          ${fieldRow("Created At", formatDateTime(entry.created_at))}
        </div>
        <div>
          ${fieldRow("Updated By", renderUserName(entry.updatedBy))}
          ${fieldRow("Updated At", formatDateTime(entry.updated_at))}
        </div>
      </div>
    </details>
  `;

  const actions = has("actions")
    ? `<div class="entity-card-footer export-ignore">
         ${getTriageRecordActionButtons(entry, user)}
       </div>`
    : "";

  return `
    <div class="entity-card triage-record-card">
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
  const tableBody = document.getElementById("triageRecordTableBody");
  const cardContainer = document.getElementById("triageRecordList");
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
            No triage records found.
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
                 ${getTriageRecordActionButtons(entry, user)}
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
      : `<p class="text-muted text-center">No triage records found.</p>`;

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

  const title = "Triage Records Report";

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
      selector: ".table-container.active, #triageRecordList.active",
      orientation: "landscape",
    });
  });
}
