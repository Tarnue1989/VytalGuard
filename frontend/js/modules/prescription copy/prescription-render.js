// 📁 prescription-render.js
// ============================================================
// 💊 Prescription Table & Card Renderer (Enterprise-Aligned)
// Master Pattern: Lab Request / Central Stock Unified Renderer
// ============================================================

import { FIELD_LABELS_PRESCRIPTION } from "./prescription-constants.js";
import { formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";

/* ============================================================
   🎛️ Action Buttons (Centralized, Permission-Driven)
============================================================ */
function getPrescriptionActionButtons(entry, user) {
  return buildActionButtons({
    module: "prescription",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "prescriptions",
  });
}

/* ============================================================
   🔠 Field Render Helpers
============================================================ */
function renderUserName(userObj) {
  if (!userObj) return "—";
  const parts = [userObj.first_name, userObj.middle_name, userObj.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : userObj.full_name || userObj.username || "—";
}

function renderPatient(patient) {
  if (!patient) return "—";
  const fullName = [patient.first_name, patient.last_name].filter(Boolean).join(" ");
  return `${patient.pat_no ? patient.pat_no + " - " : ""}${fullName || "—"}`;
}

function renderDate(value) {
  return value ? formatDate(value) : "—";
}

function renderStatus(status) {
  const raw = (status || "").toLowerCase();
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  const colorMap = {
    draft: "bg-secondary",
    issued: "bg-info text-dark",
    in_progress: "bg-warning text-dark",
    completed: "bg-primary",
    verified: "bg-success",
    cancelled: "bg-danger",
    voided: "bg-dark",
  };
  return raw
    ? `<span class="badge ${colorMap[raw] || "bg-secondary"}">${label}</span>`
    : "—";
}

/* ============================================================
   💊 Medication Renderer (Name + Qty + Route + Duration)
   (Bullet style for each medication line)
============================================================ */
function renderMedicationList(items = []) {
  if (!Array.isArray(items) || items.length === 0) return "—";

  const meds = items.map((i) => {
    const name = i.billableItem?.name || i.medication?.name || "Unnamed";
    const qty = i.quantity ?? 0;
    const route = i.route ? i.route : "";
    const duration = i.duration ? i.duration : "";
    const extra =
      [route, duration].filter(Boolean).length > 0
        ? ` – ${[route, duration].filter(Boolean).join(", ")}`
        : "";

    // 🩺 Clean bullet line format (Qty bold)
    return `<li>${name} <span class="text-muted"><strong>(Qty: ${qty})</strong></span>${extra}</li>`;
  });

  return `
    <ul class="mb-0 ps-4" style="list-style-type: disc; line-height: 1.4;">
      ${meds.join("")}
    </ul>
  `;
}


/* ============================================================
   🧱 Value Renderer
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    // -------- RELATIONS --------
    case "organization": return entry.organization?.name || "—";
    case "facility": return entry.facility?.name || "—";
    case "department": return entry.department?.name || "—";
    case "patient": return renderPatient(entry.patient);
    case "doctor": return renderUserName(entry.doctor);
    case "consultation":
      return entry.consultation
        ? `${renderDate(entry.consultation.consultation_date)} (${entry.consultation.status || "—"})`
        : "—";
    case "registrationLog":
      return entry.registrationLog
        ? `${renderDate(entry.registrationLog.registration_time)} (${entry.registrationLog.log_status || "—"})`
        : "—";

    // -------- COLLECTIONS --------
    case "items":
      return renderMedicationList(entry.items);

    // -------- USER ACTORS --------
    case "createdBy": return renderUserName(entry.createdBy);
    case "updatedBy": return renderUserName(entry.updatedBy);
    case "cancelledBy": return renderUserName(entry.cancelledBy);
    case "voidedBy": return renderUserName(entry.voidedBy);
    case "deletedBy": return renderUserName(entry.deletedBy);

    // -------- DATE FIELDS --------
    case "prescription_date":
    case "cancelled_at":
    case "voided_at":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return renderDate(entry[field]);

    // -------- BOOLEAN --------
    case "is_emergency":
      return entry[field] ? "Yes" : "No";

    // -------- STATUS --------
    case "status":
      return renderStatus(entry.status);

    // -------- DEFAULT --------
    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🧱 Table Head Renderer
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = FIELD_LABELS_PRESCRIPTION[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================
   🗂️ Card Renderer
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const details = visibleFields
    .filter((f) => f !== "actions")
    .map(
      (f) => `
        <p><strong>${FIELD_LABELS_PRESCRIPTION[f] || f}:</strong> 
        ${renderValue(entry, f)}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getPrescriptionActionButtons(entry, user)}
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
  const tableBody = document.getElementById("prescriptionTableBody");
  const cardContainer = document.getElementById("prescriptionList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No prescriptions found.</td></tr>`;

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
              ? `<div class="table-actions export-ignore">${getPrescriptionActionButtons(entry, user)}</div>`
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
      : `<p class="text-muted text-center py-3">No prescriptions found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 Export Handlers (Enterprise Unified)
============================================================ */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Prescriptions Report";

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
