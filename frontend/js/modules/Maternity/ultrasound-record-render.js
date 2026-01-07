// 📁 ultrasound-record-render.js
// ============================================================
// 🧭 Ultrasound Record Table & Card Renderer (Enterprise-Aligned)
// ============================================================

import { FIELD_LABELS_ULTRASOUND_RECORD } from "./ultrasound-record-constants.js";
import { formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";

/* ============================================================
   🎛️ Action Buttons (Centralized, Permission-Driven)
============================================================ */
function getUltrasoundActionButtons(entry, user) {
  return buildActionButtons({
    module: "ultrasound_record", // maps to STATUS_ACTION_MATRIX.ultrasound_record
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "ultrasound_records", // matches backend permission keys
  });
}

/* ============================================================
   🔠 Field Render Helpers
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.full_name || "—";
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
    pending: "bg-info",
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

/* ============================================================
   🧱 Value Renderer
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    // ---------------- RELATIONS ----------------
    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "patient":
      return renderPatient(entry.patient);
    case "consultation":
      return entry.consultation
        ? `${renderDate(entry.consultation.consultation_date)} (${entry.consultation.status || "—"})`
        : "—";
    case "maternityVisit":
      return entry.maternityVisit
        ? `${renderDate(entry.maternityVisit.visit_date)} (${entry.maternityVisit.status || "—"})`
        : "—";
    case "registrationLog":
      return entry.registrationLog
        ? `${renderDate(entry.registrationLog.registration_time)} (${entry.registrationLog.log_status || "—"})`
        : "—";
    case "department":
      return entry.department?.name || "—";
    case "billableItem":
      return entry.billableItem?.name || "—";
    case "invoice":
      return entry.invoice
        ? `${entry.invoice.invoice_number} (${entry.invoice.status || "—"})`
        : "—";
    case "technician":
      return renderUserName(entry.technician);

    // ---------------- USER ACTORS ----------------
    case "verifiedBy":
      return renderUserName(entry.verifiedBy);
    case "finalizedBy":
      return renderUserName(entry.finalizedBy);
    case "voidedBy":
      return renderUserName(entry.voidedBy);
    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    // ---------------- DATE FIELDS ----------------
    case "scan_date":
    case "prev_ces_date":
    case "cesarean_date":
    case "verified_at":
    case "finalized_at":
    case "voided_at":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return renderDate(entry[field]);

    // ---------------- STATUS ----------------
    case "status":
      return renderStatus(entry.status);

    // ---------------- BOOLEAN FIELDS ----------------
    case "is_emergency":
    case "ultrasound_done":
    case "previous_cesarean":
      return entry[field] ? "Yes" : "No";

    // ---------------- EXTRA FIELDS ----------------
    case "file_path":
      return entry.file_path
        ? `<a href="${entry.file_path}" target="_blank" class="text-decoration-underline">View File</a>`
        : "—";
    case "void_reason":
      return entry.void_reason || "—";

    // ---------------- DEFAULT ----------------
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
    th.textContent =
      FIELD_LABELS_ULTRASOUND_RECORD[field] || field.replace(/_/g, " ");
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
        <p><strong>${FIELD_LABELS_ULTRASOUND_RECORD[f] || f}:</strong> 
        ${renderValue(entry, f)}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getUltrasoundActionButtons(entry, user)}
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
  const tableBody = document.getElementById("ultrasoundRecordTableBody");
  const cardContainer = document.getElementById("ultrasoundRecordList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No ultrasound records found.</td></tr>`;

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
              ? `<div class="table-actions export-ignore">${getUltrasoundActionButtons(entry, user)}</div>`
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
      : `<p class="text-muted text-center py-3">No ultrasound records found.</p>`;

    initTooltips(cardContainer);
  }
}
