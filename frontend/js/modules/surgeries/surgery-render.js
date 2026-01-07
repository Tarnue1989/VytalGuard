// 📁 surgery-render.js – Surgery Table & Card Renderers (Enterprise Master Pattern Aligned)
// ============================================================================
// 🔹 Mirrors centralstock-render.js for unified enterprise rendering
// 🔹 Keeps all existing IDs, logic, and export functionality
// 🔹 Adds centralized permission-driven action building
// ============================================================================

import { FIELD_LABELS_SURGERY } from "./surgery-constants.js";
import { formatDate } from "../../utils/ui-utils.js";
import { exportData } from "../../utils/export-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js"; // ✅ unified enterprise builder

/* ============================================================
   🧭 Tooltip Initializer
============================================================ */
function initTooltips(scope = document) {
  if (!window.bootstrap) return;
  const triggers = [].slice.call(scope.querySelectorAll("[data-bs-toggle='tooltip']"));
  triggers.forEach((el) => {
    if (!bootstrap.Tooltip.getInstance(el)) new bootstrap.Tooltip(el);
  });
}

/* ============================================================
   🎛️ Action Buttons (Unified)
============================================================ */
function getSurgeryActionButtons(entry, user) {
  // 🧠 Permission-driven, unified via status-action-matrix
  return buildActionButtons({
    module: "surgery",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "surgeries", // ✅ aligns with backend naming
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
    th.textContent = FIELD_LABELS_SURGERY[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================
   👥 Helper Renderers
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.full_name || "—";
}

function renderValue(entry, field) {
  switch (field) {
    /* ---------- STATUS ---------- */
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const colorMap = {
        scheduled: "bg-info",
        in_progress: "bg-warning text-dark",
        completed: "bg-primary",
        verified: "bg-success",
        finalized: "bg-secondary",
        cancelled: "bg-danger",
        voided: "bg-dark",
      };
      return raw
        ? `<span class="badge ${colorMap[raw] || "bg-secondary"}">${label}</span>`
        : "—";
    }

    /* ---------- RELATIONS ---------- */
    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no} - ${entry.patient.first_name} ${entry.patient.last_name}`
        : "—";
    case "consultation":
      return entry.consultation
        ? `${formatDate(entry.consultation.consultation_date)} (${entry.consultation.status})`
        : "—";
    case "department":
      return entry.department?.name || "—";
    case "billableItem":
      return entry.billableItem?.name || "—";
    case "invoice":
      return entry.invoice
        ? `${entry.invoice.invoice_number} (${entry.invoice.status})`
        : "—";
    case "surgeon":
      return renderUserName(entry.surgeon);

    /* ---------- USER ACTORS ---------- */
    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);
    case "verifiedBy":
      return renderUserName(entry.verifiedBy);
    case "finalizedBy":
      return renderUserName(entry.finalizedBy);
    case "voidedBy":
      return renderUserName(entry.voidedBy);

    /* ---------- DATES ---------- */
    case "scheduled_date":
    case "verified_at":
    case "finalized_at":
    case "voided_at":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    /* ---------- BOOLEAN ---------- */
    case "is_emergency":
      return entry.is_emergency ? "Yes" : "No";

    /* ---------- DEFAULT ---------- */
    default:
      return entry[field] != null ? String(entry[field]) : "—";
  }
}

/* ============================================================
   🗂️ Card Renderer
============================================================ */
export function renderCard(entry, visibleFields, user) {
  let html = "";
  visibleFields.forEach((field) => {
    if (field === "actions") return;
    const label = FIELD_LABELS_SURGERY[field] || field.replace(/_/g, " ");
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getSurgeryActionButtons(entry, user)}
        </div>
      </div>`
    : "";

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      ${footer}
    </div>`;
}

/* ============================================================
   📋 List Renderer (Table + Card)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("surgeryTableBody");
  const cardContainer = document.getElementById("surgeryList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No surgeries found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      row.innerHTML = visibleFields
        .map((f) => {
          const val =
            f === "actions"
              ? `<div class="table-actions export-ignore">${getSurgeryActionButtons(entry, user)}</div>`
              : renderValue(entry, f);
          const cls = f === "actions" ? ' class="text-center actions-cell"' : "";
          return `<td${cls}>${val}</td>`;
        })
        .join("");
      tableBody.appendChild(row);
    });

    initTooltips(tableBody);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.remove("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center py-3">No surgeries found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📤 Export Handlers (Preserved)
============================================================ */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Surgery Report";

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
