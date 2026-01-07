// 📁 lab-result-render.js – Lab Result Table & Card Renderers
// ============================================================
// 💉 Enterprise-Aligned (Consultation Master Pattern)
// Mirrors consultation-render.js and lab-request-render.js
// ============================================================

import { FIELD_LABELS_LAB_RESULT } from "./lab-result-constants.js";
import { formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";

/* ============================================================
   🎛️ Action Buttons (centralized)
============================================================ */
function getLabResultActionButtons(entry, user) {
  return buildActionButtons({
    module: "lab_result",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "lab_results",
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
      FIELD_LABELS_LAB_RESULT[field] || field.replace(/_/g, " ");
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

function renderFileField(url) {
  if (!url || typeof url !== "string") return "—";
  const fileName = url.split("/").pop();
  return `<a href="${url}" target="_blank" rel="noopener noreferrer" data-bs-toggle="tooltip" data-bs-title="Open attachment">
    <i class="ri-file-2-line me-1"></i>${fileName}</a>`;
}

function renderValue(entry, field) {
  switch (field) {
    /* 🩸 Status with Bootstrap color mapping */
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);

      const colorMap = {
        draft: "bg-secondary text-white",
        pending: "bg-info text-dark",
        in_progress: "bg-warning text-dark",
        started: "bg-warning text-dark",
        completed: "bg-primary text-white",
        reviewed: "bg-success-subtle text-dark",
        verified: "bg-success text-white",
        cancelled: "bg-danger text-white",
        voided: "bg-dark text-white",
      };

      return raw
        ? `<span class="badge ${colorMap[raw] || "bg-secondary text-white"}" 
            data-bs-toggle="tooltip" data-bs-title="Status: ${label}">
            ${label}</span>`
        : "—";
    }

    /* 🏢 Linked entities */
    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "department":
      return entry.department?.name || "—";
    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no || ""} ${entry.patient.full_name || entry.patient.first_name || ""} ${entry.patient.last_name || ""}`.trim()
        : "—";
    case "doctor":
      return renderUserName(entry.doctor);
    case "consultation":
      return entry.consultation
        ? `Consultation (${entry.consultation.status})`
        : "—";
    case "registrationLog":
      return entry.registrationLog
        ? `Registration (${entry.registrationLog.log_status})`
        : "—";

    /* 🧪 Lab Request + Items (UUID-free) */
    case "labRequest":
      if (entry.labRequest) {
        const code =
          entry.labRequest.request_no ||
          entry.labRequest.code ||
          "Lab Request";
        const status = entry.labRequest.status
          ? ` (${entry.labRequest.status.toLowerCase()})`
          : "";
        return `${code}${status}`;
      }
      return "—";

    case "labRequestItem":
      if (entry.labRequestItem?.labTest?.name)
        return entry.labRequestItem.labTest.name;
      if (entry.labRequestItem?.notes)
        return entry.labRequestItem.notes;
      if (Array.isArray(entry.labRequest?.items))
        return entry.labRequest.items
          .map((i) => i.labTest?.name)
          .filter(Boolean)
          .join(", ") || "—";
      return "—";

    case "labTest":
      return (
        entry.labRequest?.labTest?.name ||
        entry.labRequestItem?.labTest?.name ||
        "—"
      );

    /* 🕒 Dates + Attachments */
    case "result_date":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field], true) : "—";
    case "attachment_url":
      return renderFileField(entry.attachment_url);

    /* 👤 Audit trail users */
    case "enteredBy":
      return renderUserName(entry.enteredBy);
    case "reviewedBy":
      return renderUserName(entry.reviewedBy);
    case "verifiedBy":
      return renderUserName(entry.verifiedBy);
    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    /* 🧩 Default */
    default:
      return entry[field] != null ? String(entry[field]) : "—";
  }
}

/* ============================================================
   🗂️ Card Renderer
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const details = visibleFields
    .filter((f) => f !== "actions")
    .map(
      (f) => `
        <p><strong>${FIELD_LABELS_LAB_RESULT[f] || f}:</strong>
        ${renderValue(entry, f)}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getLabResultActionButtons(entry, user)}
        </div>
      </div>`
    : "";

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${details}</div>
      ${footer}
    </div>`;
}

/* ============================================================
   📋 Main List Renderer
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("labResultTableBody");
  const cardContainer = document.getElementById("labResultList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";
  exportHandlersBound = false;

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No lab results found.</td></tr>`;

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
              ? `<div class="table-actions export-ignore">${getLabResultActionButtons(entry, user)}</div>`
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
      : `<p class="text-muted text-center py-3">No lab results found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📦 Export Handlers (Enterprise Export Engine)
============================================================ */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Lab Results Report";

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
      selector: ".table-container",
      orientation: "landscape",
    })
  );
}
