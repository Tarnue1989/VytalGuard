// 📁 labrequest-render.js – Entity Card System (LAB REQUEST | ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH consultation-render.js
// 🔹 Table = flat | Card = RICH + structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize + drag enabled
// 🔹 Full audit section (created / updated / deleted / cancelled / voided)
// 🔹 Permission-driven actions
// 🔹 Export-safe (no object leaks)
// ============================================================================

import { FIELD_LABELS_LAB_REQUEST } from "./lab-request-constants.js";

import {
  formatDate,
  formatDateTime,
  initTooltips,
  formatClinicalDate,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE FIELDS (MASTER PARITY)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "patient_id",
  "doctor_id",
  "department_id",
  "request_date",
  "status",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("labRequestSortBy") || "";
let sortDir = localStorage.getItem("labRequestSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("labRequestSortBy", sortBy);
  localStorage.setItem("labRequestSortDir", sortDir);
  window.setLabRequestSort = (field, dir) => {
    sortBy = field;
    sortDir = dir;
  };

  window.loadLabRequestPage = (p = 1) => loadEntries(p);
}

/* ============================================================
   🎛️ ACTIONS (MASTER)
============================================================ */
function getLabRequestActionButtons(entry, user) {
  return buildActionButtons({
    module: "lab_request",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "lab_requests",
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

function renderPatient(entry) {
  const p = entry.patient;
  if (!p) return "—";
  return `${p.pat_no || "—"} - ${[p.first_name, p.last_name]
    .filter(Boolean)
    .join(" ")}`;
}

function renderItems(entry) {
  if (!Array.isArray(entry.items) || !entry.items.length) return "—";
  return `
    <ul class="mb-0 ps-3">
      ${entry.items
        .map((i) => `<li>${i.labTest?.name || "—"}</li>`)
        .join("")}
    </ul>
  `;
}

/* ============================================================
   🧩 VALUE RENDERER (OBJECT SAFE)
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const s = (entry.status || "").toLowerCase();
      const cls =
        s === "draft"
          ? "bg-secondary"
          : s === "pending"
          ? "bg-info"
          : s === "in_progress"
          ? "bg-warning text-dark"
          : s === "completed"
          ? "bg-primary"
          : s === "verified"
          ? "bg-success"
          : s === "cancelled"
          ? "bg-danger"
          : s === "voided"
          ? "bg-dark text-light"
          : "bg-secondary";
      return `<span class="badge ${cls}">${s.toUpperCase()}</span>`;
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

    case "items":
      return renderItems(entry);

    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "cancelledBy":
      return renderUserName(entry.cancelledBy);
    case "voidedBy":
      return renderUserName(entry.voidedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    case "request_date":
      return formatClinicalDate(entry.request_date);

    case "created_at":
    case "updated_at":
    case "cancelled_at":
    case "voided_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    case "is_emergency":
      return entry.is_emergency ? "Yes" : "No";

    default: {
      const v = entry[field];
      if (v === null || v === undefined || typeof v === "object") return "—";
      return v;
    }
  }
}

/* ============================================================
   🧱 TABLE HEAD (MASTER)
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
      FIELD_LABELS_LAB_REQUEST[field] || field.replace(/_/g, " ");

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
    onReorder: () => window.loadLabRequestPage?.(1),
  });
}

/* ============================================================
   🗂️ CARD RENDERER — RICH + CLINICAL-FIRST (ENTERPRISE MASTER)
   - Lab tests ALWAYS visible
   - No hidden clinical data
   - Secondary info collapsible
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const row = (label, value) =>
    `<div class="entity-field">
       <span class="entity-label">${label}</span>
       <span class="entity-value">${value ?? "—"}</span>
     </div>`;

  const badge = (val) =>
    `<span class="entity-status ${val}">${val.toUpperCase()}</span>`;

  const yesNo = (v) => (v ? "Yes" : "No");

  const renderConsultation = () => {
    if (!entry.consultation) return "—";
    return `
      ${formatDate(entry.consultation.consultation_date)} ·
      ${(entry.consultation.status || "").toUpperCase()}
    `;
  };

  const renderRegistrationLog = () => {
    if (!entry.registrationLog) return "—";
    return `
      ${formatDateTime(entry.registrationLog.registration_time)} ·
      ${(entry.registrationLog.log_status || "").toUpperCase()}
    `;
  };

  return `
    <div class="entity-card lab-request-card">

      <!-- ================= HEADER ================= -->
      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${renderPatient(entry)}</div>
          <div class="entity-primary">Lab Request</div>
        </div>
        ${has("status") ? badge(status) : ""}
      </div>

      <!-- ================= CONTEXT ================= -->
      <div class="entity-card-context">
        <div>🏥 ${entry.organization?.name || "—"}</div>
        <div>📍 ${entry.facility?.name || "—"}</div>
        <div>👨‍⚕️ ${renderUserName(entry.doctor) || "No Doctor Assigned"}</div>
        <div>🏬 ${entry.department?.name || "No Department Assigned"}</div>
      </div>

      <!-- ================= CORE ================= -->
      <div class="entity-card-body">
        ${row("Request Date", formatClinicalDate(entry.request_date))}
        ${row("Emergency", yesNo(entry.is_emergency))}
        ${row("Status", status.toUpperCase())}
      </div>

      <!-- ================= LAB TESTS (ALWAYS VISIBLE) ================= -->
      <div class="entity-section">
        <div class="entity-section-title">Lab Tests</div>
        <div class="entity-card-body">
          ${renderItems(entry)}
        </div>
      </div>

      <!-- ================= NOTES ================= -->
      ${
        entry.notes
          ? `<div class="entity-card-body">
               ${row("Notes", entry.notes)}
             </div>`
          : ""
      }

      <!-- ================= LINKS ================= -->
      <details class="entity-section">
        <summary>Linked Records</summary>
        <div class="entity-card-body">
          ${row("Consultation", renderConsultation())}
          ${row("Registration Log", renderRegistrationLog())}
        </div>
      </details>

      <!-- ================= AUDIT ================= -->
      <details class="entity-section">
        <summary>Audit</summary>
        <div class="entity-card-body">
          ${row("Created By", renderUserName(entry.createdBy))}
          ${row("Created At", formatDateTime(entry.created_at))}
          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row("Updated At", formatDateTime(entry.updated_at))}
          ${row("Cancelled By", renderUserName(entry.cancelledBy))}
          ${row("Cancelled At", formatDateTime(entry.cancelled_at))}
          ${row("Voided By", renderUserName(entry.voidedBy))}
          ${row("Voided At", formatDateTime(entry.voided_at))}
        </div>
      </details>

      <!-- ================= ACTIONS ================= -->
      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getLabRequestActionButtons(entry, user)}
             </div>`
          : ""
      }
    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("labRequestTableBody");
  const cardContainer = document.getElementById("labRequestList");
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
            No lab requests found.
          </td>
        </tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">${getLabRequestActionButtons(e, user)}</td>`
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
      : `<p class="text-center text-muted">No lab requests found.</p>`;
    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📤 EXPORT (MASTER)
============================================================ */
let exportHandlersBound = false;
function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Lab Requests Report";

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
      selector: ".table-container.active, #labRequestList.active",
      orientation: "landscape",
    })
  );
}
