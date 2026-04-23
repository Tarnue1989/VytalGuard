// 📁 medical-record-render.js – Permission-Driven Table & Card Renderers (Upgraded)
// ===============================================================================
// 🧭 Master Pattern: Consultation (Enterprise-Aligned)
// Consistent with Central Stock / Consultation modules
// – Unified table ↔ card rendering
// – STATUS_ACTION_MATRIX-driven buttons
// – Tooltip + export integration
// – Role & permission awareness
// ===============================================================================

import { FIELD_LABELS_MEDICAL_RECORD } from "./medical-record-constants.js";
import { formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js"; // ✅ shared enterprise utility
import { exportData } from "../../utils/export-utils.js";

/* ============================================================
   🎛️ Action Buttons (centralized)
============================================================ */
function getMedicalRecordActionButtons(entry, user) {
  return buildActionButtons({
    module: "medical_record", // 👈 maps to STATUS_ACTION_MATRIX.medical_record
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "medical_records", // 👈 matches backend permission keys
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
      FIELD_LABELS_MEDICAL_RECORD[field] || field.replace(/_/g, " ");
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

function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const colorMap = {
        draft: "bg-info",
        reviewed: "bg-warning text-dark",
        finalized: "bg-primary",
        verified: "bg-success",
        voided: "bg-dark",
      };
      if (entry.deleted_at) return `<span class="badge bg-warning text-dark">Deleted</span>`;
      return raw
        ? `<span class="badge ${colorMap[raw] || "bg-secondary"}">${label}</span>`
        : "—";
    }

    case "is_emergency":
      return entry.is_emergency ? "Yes" : "No";

    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no || ""} ${entry.patient.full_name || ""}`.trim() || "—"
        : "—";
    case "doctor":
      return renderUserName(entry.doctor);
    case "consultation":
      return entry.consultation
        ? entry.consultation.diagnosis ||
          formatDate(entry.consultation.consultation_date)
        : "—";
    case "registrationLog":
      return entry.registrationLog
        ? `${formatDate(entry.registrationLog.registration_time)} (${entry.registrationLog.log_status})`
        : "—";
    case "invoice":
      return entry.invoice
        ? `${entry.invoice.invoice_number} (${entry.invoice.status})`
        : "—";

    // 🧾 Audit & Lifecycle Users
    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);
    case "reviewedBy":
      return renderUserName(entry.reviewedBy);
    case "finalizedBy":
      return renderUserName(entry.finalizedBy);
    case "verifiedBy":
      return renderUserName(entry.verifiedBy);
    case "voidedBy":
      return renderUserName(entry.voidedBy);

    // 🕒 Timestamps
    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "reviewed_at":
    case "finalized_at":
    case "verified_at":
    case "voided_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    case "void_reason":
      return entry.void_reason || "—";

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
        <p><strong>${FIELD_LABELS_MEDICAL_RECORD[f] || f}:</strong> 
        ${renderValue(entry, f)}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getMedicalRecordActionButtons(entry, user)}
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
  const tableBody = document.getElementById("medicalRecordTableBody");
  const cardContainer = document.getElementById("medicalRecordList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No medical records found.</td></tr>`;

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
              ? `<div class="table-actions export-ignore">${getMedicalRecordActionButtons(entry, user)}</div>`
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
      : `<p class="text-muted text-center py-3">No medical records found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 Export Handlers (CSV / Excel / PDF)
============================================================ */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Medical Records Report";

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
