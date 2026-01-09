// 📁 appointment-render.js – Enterprise-Aligned Master Pattern (Permission-Driven + Role-Aware)
// ============================================================================
// 🧭 Master Pattern: triage-record-render.js
// 🔹 Full enterprise consistency (permissions, UI logic, tooltips, exports)
// 🔹 Integrates STATUS_ACTION_MATRIX + buildActionButtons
// 🔹 Field-selector safe for BOTH table and card views
// ============================================================================

import {
  FIELD_LABELS_APPOINTMENT,
  FIELD_GROUPS_APPOINTMENT,
} from "./appointments-constants.js";

import { formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";

/* ============================================================
   🎛️ Action Buttons (centralized)
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
   🧱 Dynamic Table Head Renderer
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent =
      FIELD_LABELS_APPOINTMENT[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================
   🔠 Field Render Helpers
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.full_name || "—";
}

function renderPatient(entry) {
  const p = entry.patient;
  if (!p) return "—";
  const patNo = p.pat_no || "—";
  const name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
  return `${patNo} - ${name || "Unnamed"}`;
}

function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.replace(/_/g, " ").toUpperCase();
      return raw ? label : "—";
    }

    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "patient":
      return renderPatient(entry);
    case "doctor":
      return renderUserName(entry.doctor);
    case "department":
      return entry.department?.name || "—";
    case "invoice":
      return entry.invoice
        ? entry.invoice.invoice_number || "—"
        : "—";
    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    case "date_time":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🗂️ CARD RENDERER — ENTITY SYSTEM (APPOINTMENT)
   Field-Selector SAFE • Enterprise-Aligned
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

  /* ================= HEADER ================= */
  const patient = entry.patient || {};
  const patientName = [patient.first_name, patient.last_name].filter(Boolean).join(" ");
  const patientCode = patient.pat_no || "—";
  const status = (entry.status || "").toLowerCase();

  const header = `
    <div class="entity-card-header">
      <div>
        ${has("patient") ? `<div class="entity-secondary">${patientCode}</div>` : ""}
        ${has("patient") ? `<div class="entity-primary">${patientName || "Unnamed Patient"}</div>` : ""}
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
  const contextItems = [];

  if (has("facility"))
    contextItems.push(`📍 ${safe(entry.facility?.name)}`);

  if (has("organization"))
    contextItems.push(`🏥 ${safe(entry.organization?.name)}`);

  if (has("date_time"))
    contextItems.push(`📅 ${entry.date_time ? formatDateTime(entry.date_time) : "—"}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map(v => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  /* ================= BODY ================= */
  const left = [];
  const right = [];

  if (has("doctor"))
    left.push(fieldRow("Doctor", renderUserName(entry.doctor)));

  if (has("department"))
    left.push(fieldRow("Department", safe(entry.department?.name)));

  if (has("appointment_code"))
    left.push(fieldRow("Appointment", safe(entry.appointment_code)));

  if (has("invoice"))
    right.push(fieldRow("Invoice", renderValue(entry, "invoice")));

  const body =
    left.length || right.length
      ? `
        <div class="entity-card-body">
          <div>${left.join("")}</div>
          <div>${right.join("")}</div>
        </div>
      `
      : "";

  /* ================= AUTO EXTRA FIELDS ================= */
  const usedFields = new Set([
    "patient",
    "status",
    "facility",
    "organization",
    "date_time",
    "doctor",
    "department",
    "appointment_code",
    "invoice",
    "notes",
    "created_at",
    "updated_at",
    "createdBy",
    "updatedBy",
    "actions",
  ]);

  const extraFields = visibleFields
    .filter(f => !usedFields.has(f))
    .map(f =>
      fieldRow(
        FIELD_LABELS_APPOINTMENT[f] || f,
        renderValue(entry, f)
      )
    );

  const extrasSection = extraFields.length
    ? `
      <details class="entity-notes">
        <summary>More Details</summary>
        <div class="entity-card-body">
          <div>${extraFields.join("")}</div>
        </div>
      </details>
    `
    : "";

  /* ================= NOTES ================= */
  const notes =
    has("notes") && entry.notes
      ? `
        <details class="entity-notes">
          <summary>Notes</summary>
          <p>${entry.notes}</p>
        </details>
      `
      : "";

  /* ================= AUDIT ================= */
  const auditFields = [];

  if (has("created_at"))
    auditFields.push(fieldRow("Created At", formatDateTime(entry.created_at)));

  if (has("createdBy"))
    auditFields.push(fieldRow("Created By", renderUserName(entry.createdBy)));

  if (has("updated_at"))
    auditFields.push(fieldRow("Updated At", formatDateTime(entry.updated_at)));

  if (has("updatedBy"))
    auditFields.push(fieldRow("Updated By", renderUserName(entry.updatedBy)));

  const auditSection = auditFields.length
    ? `
      <details class="entity-notes">
        <summary>Audit Information</summary>
        <div class="entity-card-body">
          <div>${auditFields.join("")}</div>
        </div>
      </details>
    `
    : "";

  /* ================= ACTIONS ================= */
  const actions = has("actions")
    ? `
      <div class="entity-card-footer">
        ${getAppointmentActionButtons(entry, user)}
      </div>
    `
    : "";

  /* ================= FINAL ================= */
  return `
    <div class="entity-card appointment-card">
      ${header}
      ${context}
      ${body}
      ${extrasSection}
      ${notes}
      ${auditSection}
      ${actions}
    </div>
  `;
}

/* ============================================================
   📋 Main List Renderer
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("appointmentTableBody");
  const cardContainer = document.getElementById("appointmentList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No appointments found.</td></tr>`;

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = noData;
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell text-center">${getAppointmentActionButtons(entry, user)}</td>`
            : `<td>${renderValue(entry, f)}</td>`
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
      : `<p class="text-muted text-center py-3">No appointments found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📤 Export Handlers
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
      selector: ".table-container",
      orientation: "landscape",
    });
  });
}
