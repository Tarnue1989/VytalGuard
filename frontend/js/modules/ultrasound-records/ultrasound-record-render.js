// 📁 ultrasound-record-render.js – Entity Card System (ULTRASOUND RECORD | ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH delivery-record-render.js / ekg-record-render.js
// 🔹 Table = flat | Card = structured (entity-card system)
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize enabled
// 🔹 Column drag reorder enabled
// 🔹 Full audit section (created / updated / cancelled / verified / finalized / voided)
// 🔹 Permission-driven actions (superadmin-aware)
// 🔹 Export-safe (HTML stripped for exports)
// ============================================================================

import { FIELD_LABELS_ULTRASOUND_RECORD } from "./ultrasound-record-constants.js";

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
  "scan_date",
  "status",
  "created_at",
  "updated_at",
]);

/* ============================================================
   🔃 SORT STATE (UI ONLY – MAIN OWNS BACKEND)
============================================================ */
let sortBy = localStorage.getItem("ultrasoundRecordSortBy") || "";
let sortDir = localStorage.getItem("ultrasoundRecordSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("ultrasoundRecordSortBy", sortBy);
  localStorage.setItem("ultrasoundRecordSortDir", sortDir);

  window.setUltrasoundRecordSort?.(sortBy, sortDir);
  window.loadUltrasoundRecordPage?.(1);
}

/* ============================================================
   🎛️ ACTION BUTTONS (PERMISSION-DRIVEN)
============================================================ */
function getUltrasoundActionButtons(entry, user) {
  return buildActionButtons({
    module: "ultrasound_record",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "ultrasound_records",
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

function renderPatient(p) {
  if (!p) return "—";
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return `${p.pat_no ? p.pat_no + " " : ""}${name || "—"}`.trim();
}

function stripHtml(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

/* ============================================================
   🧩 FIELD VALUE RENDERER
============================================================ */
function renderValue(entry, field, exportMode = false) {
  let value;

  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      let cls = "bg-secondary";

      if (raw === "pending") cls = "bg-secondary";
      if (raw === "in_progress") cls = "bg-warning text-dark";
      if (raw === "completed") cls = "bg-primary";
      if (raw === "verified") cls = "bg-success";
      if (raw === "finalized") cls = "bg-dark";
      if (raw === "cancelled") cls = "bg-danger";
      if (raw === "voided") cls = "bg-secondary";

      value = `<span class="badge ${cls}">
        ${raw ? raw.replace(/_/g, " ").toUpperCase() : "—"}
      </span>`;
      break;
    }

    case "organization":
      value = entry.organization?.name || "—";
      break;

    case "facility":
      value = entry.facility?.name || "—";
      break;

    case "department":
      value = entry.department?.name || "—";
      break;

    case "patient":
      value = renderPatient(entry.patient);
      break;

    case "technician":
      value = renderUserName(entry.technician);
      break;

    case "consultation":
      value = entry.consultation
        ? `${formatDateTime(entry.consultation.consultation_date)} (${entry.consultation.status})`
        : "—";
      break;

    case "maternityVisit":
      value = entry.maternityVisit
        ? `${formatDateTime(entry.maternityVisit.visit_date)} (${entry.maternityVisit.status})`
        : "—";
      break;

    case "registrationLog":
      value = entry.registrationLog
        ? `${formatDateTime(entry.registrationLog.registration_time)} (${entry.registrationLog.log_status})`
        : "—";
      break;

    case "billableItem":
      value = entry.billableItem?.name || "—";
      break;

    case "invoice":
      value = entry.invoice
        ? `${entry.invoice.invoice_number} (${entry.invoice.status})`
        : "—";
      break;

    case "is_emergency":
    case "previous_cesarean":
      value = entry[field]
        ? `<span class="badge bg-danger">YES</span>`
        : `<span class="badge bg-secondary">NO</span>`;
      break;

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
    case "cancelledBy":
    case "verifiedBy":
    case "finalizedBy":
    case "voidedBy":
      value = renderUserName(entry[field]);
      break;

    case "scan_date":
    case "prev_ces_date":
    case "cesarean_date":
    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "cancelled_at":
    case "verified_at":
    case "finalized_at":
    case "voided_at":
      value = entry[field] ? formatDateTime(entry[field]) : "—";
      break;

    case "file_path":
      value = entry.file_path
        ? `<a href="${entry.file_path}" target="_blank">View File</a>`
        : "—";
      break;

    default: {
      const val = entry[field];
      if (val === null || val === undefined) value = "—";
      else if (typeof val === "object") {
        if (val.name) value = val.name;
        else if (val.label) value = val.label;
        else if (val.code) value = val.code;
        else value = "—";
      } else {
        value = val;
      }
    }
  }

  return exportMode ? stripHtml(value) : value;
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
      FIELD_LABELS_ULTRASOUND_RECORD[field] || field.replace(/_/g, " ");

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
      window.loadUltrasoundRecordPage?.(1);
    },
  });
}

/* ============================================================
   🧱 CARD RENDERER (ENTITY CARD SYSTEM – ULTRASOUND RECORD)
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

  const fileRow = (label, url) =>
    url
      ? `
        <div class="entity-field">
          <span class="entity-label">${label}</span>
          <span class="entity-value">
            <a href="${url}" target="_blank" rel="noopener">
              <i class="ri-file-eye-line me-1"></i> View File
            </a>
          </span>
        </div>
      `
      : "";

  const status = (entry.status || "").toLowerCase();

  /* ================= HEADER ================= */
  const header = `
    <div class="entity-card-header">
      <div>
        <div class="entity-secondary">${safe(entry.patient?.pat_no)}</div>
        <div class="entity-primary">${safe(entry.patient_name)}</div>
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

  /* ================= CONTEXT ================= */
  const context = `
    <div class="entity-card-context">
      <div>🏥 ${safe(entry.organization?.name)}</div>
      <div>📍 ${safe(entry.facility?.name)}</div>
      <div>
        <i class="ri-heart-pulse-line text-primary me-1"></i>
          <span class="scan-type-pill">
            ${safe(entry.scan_type || entry.billableItem?.name)}
          </span>
      </div>
    </div>
  `;

  /* ================= CLINICAL SUMMARY (CORE) ================= */
  const clinicalSummary = `
    <div class="entity-card-body">
      <div>
        ${fieldRow("Scan Date", entry.scan_date ? formatDateTime(entry.scan_date) : "—")}
        ${fieldRow("Technician", entry.technician_name || "—")}
        ${fieldRow("Department", entry.department_name || "—")}
      </div>

      <div>
        ${fieldRow(
          "Emergency",
          entry.is_emergency
            ? `<span class="badge bg-danger">YES</span>`
            : `<span class="badge bg-secondary">NO</span>`
        )}
        ${fieldRow("Registration", entry.registration_status || "—")}
      </div>
    </div>
  `;

  /* ================= CLINICAL DETAILS (TOGGLE) ================= */
  const clinicalDetails = `
    <details class="entity-notes">
      <summary>Clinical Details</summary>
      <div class="entity-card-body">
        <div>
          ${fileRow("Scan File", entry.file_path)}
          ${fieldRow("Scan Location", entry.scan_location)}
          ${fieldRow("Findings", entry.ultra_findings)}
          ${fieldRow("Notes", entry.note)}
          ${fieldRow("Indication", entry.indication)}
          ${fieldRow("Next of Kin", entry.next_of_kin)}
        </div>

        <div>
          ${fieldRow("Fetal Heart Rate", entry.fetal_heart_rate)}
          ${fieldRow("Amniotic Volume", entry.amniotic_volume)}
          ${fieldRow("Presentation", entry.presentation)}
          ${fieldRow("Lie", entry.lie)}
          ${fieldRow("Position", entry.position)}
          ${fieldRow("Gender", entry.gender)}
          ${fieldRow("No. of Fetus", entry.number_of_fetus)}
        </div>
      </div>
    </details>
  `;

  /* ================= AUDIT ================= */
  const audit = `
    <details class="entity-notes">
      <summary>Audit</summary>
      <div class="entity-card-body">
        <div>
          ${fieldRow("Created By", entry.created_by_name)}
          ${fieldRow("Created At", entry.created_at ? formatDateTime(entry.created_at) : "—")}
          ${fieldRow("Updated By", entry.updatedBy?.full_name || "—")}
          ${fieldRow("Updated At", entry.updated_at ? formatDateTime(entry.updated_at) : "—")}
        </div>
        <div>
          ${fieldRow("Verified By", entry.verifiedBy?.full_name || "—")}
          ${fieldRow("Verified At", entry.verified_at ? formatDateTime(entry.verified_at) : "—")}
          ${fieldRow("Finalized By", entry.finalizedBy?.full_name || "—")}
          ${fieldRow("Finalized At", entry.finalized_at ? formatDateTime(entry.finalized_at) : "—")}
          ${fieldRow("Voided By", entry.voidedBy?.full_name || "—")}
          ${fieldRow("Voided At", entry.voided_at ? formatDateTime(entry.voided_at) : "—")}
          ${entry.status === "voided"
            ? fieldRow("Void Reason", entry.void_reason)
            : ""}
        </div>
      </div>
    </details>
  `;

  /* ================= ACTIONS ================= */
  const actions = has("actions")
    ? `<div class="entity-card-footer export-ignore">
         ${getUltrasoundActionButtons(entry, user)}
       </div>`
    : "";

  /* ================= FINAL ================= */
  return `
    <div class="entity-card ultrasound-record-card">
      ${header}
      ${context}
      ${clinicalSummary}
      ${clinicalDetails}
      ${audit}
      ${actions}
    </div>
  `;
}


/* ============================================================
   📋 LIST RENDERER (TABLE + CARD)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("ultrasoundRecordTableBody");
  const cardContainer = document.getElementById("ultrasoundRecordList");
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
            No ultrasound records found.
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
                 ${getUltrasoundActionButtons(entry, user)}
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
      : `<p class="text-muted text-center">No ultrasound records found.</p>`;

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

  const title = "Ultrasound Records Report";

  document.getElementById("exportCSVBtn")?.addEventListener("click", () => {
    const data = entries.map((e) => {
      const row = {};
      Object.keys(e).forEach((k) => {
        row[k] = renderValue(e, k, true);
      });
      return row;
    });
    exportData({ type: "csv", data, title });
  });

  document.getElementById("exportExcelBtn")?.addEventListener("click", () => {
    const data = entries.map((e) => {
      const row = {};
      Object.keys(e).forEach((k) => {
        row[k] = renderValue(e, k, true);
      });
      return row;
    });
    exportData({ type: "xlsx", data, title });
  });

  document.getElementById("exportPDFBtn")?.addEventListener("click", () => {
    exportData({
      type: "pdf",
      title,
      selector: ".table-container.active, #ultrasoundRecordList.active",
      orientation: "landscape",
    });
  });
}
