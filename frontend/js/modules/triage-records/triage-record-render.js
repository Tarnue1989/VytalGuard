// 📁 triage-record-render.js – Enterprise-Aligned Master Pattern (Permission-Driven + Role-Aware)
// ============================================================================
// 🧭 Master Pattern: vital-render.js
// 🔹 Full enterprise consistency (permissions, UI logic, tooltips, exports)
// 🔹 Integrates STATUS_ACTION_MATRIX + buildActionButtons
// 🔹 Displays patient number + full name properly
// ============================================================================

import { FIELD_LABELS_TRIAGE_RECORD } from "./triage-record-constants.js";
import { formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";

/* ============================================================
   🎛️ Action Buttons (centralized)
============================================================ */
function getTriageRecordActionButtons(entry, user) {
  return buildActionButtons({
    module: "triage_record", // maps to STATUS_ACTION_MATRIX.triage_record
    status: (entry.triage_status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "triage_records",
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
    th.textContent = FIELD_LABELS_TRIAGE_RECORD[field] || field.replace(/_/g, " ");
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
    case "triage_status": {
      const raw = (entry.triage_status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const colorMap = {
        open: "bg-info",
        in_progress: "bg-warning text-dark",
        completed: "bg-primary",
        verified: "bg-success",
        cancelled: "bg-danger",
        voided: "bg-dark text-light",
      };
      return raw
        ? `<span class="badge ${colorMap[raw] || "bg-secondary"}">${label}</span>`
        : "—";
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
        ? `${entry.registrationLog.registration_time ? formatDate(entry.registrationLog.registration_time) : ""} (${entry.registrationLog.log_status || "—"})`
        : "—";
    case "triageType":
      return entry.triageType?.name || "—";
    case "invoice":
      return entry.invoice
        ? `${entry.invoice.invoice_number || ""} (${entry.invoice.status || "—"})`
        : "—";
    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    case "recorded_at":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🗂️ Card Renderer
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const patientLabel = renderPatient(entry);
  const details = visibleFields
    .filter((f) => f !== "actions")
    .map(
      (f) => `
        <p><strong>${FIELD_LABELS_TRIAGE_RECORD[f] || f}:</strong>
        ${renderValue(entry, f)}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getTriageRecordActionButtons(entry, user)}
        </div>
      </div>`
    : "";

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-header bg-light fw-semibold">
        ${patientLabel}
      </div>
      <div class="card-body">${details}</div>
      ${footer}
    </div>`;
}

/* ============================================================
   📋 Main List Renderer
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("triageRecordTableBody");
  const cardContainer = document.getElementById("triageRecordList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No triage records found.</td></tr>`;

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = noData;
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) => {
          const val =
            f === "actions"
              ? `<div class="table-actions export-ignore">${getTriageRecordActionButtons(entry, user)}</div>`
              : renderValue(entry, f);
          const cls = f === "actions" ? ' class="text-center actions-cell"' : "";
          return `<td${cls}>${val}</td>`;
        })
        .join("");
      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.remove("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center py-3">No triage records found.</p>`;

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
      selector: ".table-container",
      orientation: "landscape",
    });
  });
}
