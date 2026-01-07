// 📁 maternity-visit-render.js – MaternityVisit table & card renderers (Master-Aligned)

import { FIELD_LABELS_MATERNITY_VISIT } from "./maternity-visit-constants.js";
import { formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";

/* ============================================================
   🎛️ Action Buttons (Centralized, Permission-Driven)
============================================================ */
function getMaternityVisitActionButtons(entry, user) {
  return buildActionButtons({
    module: "maternity_visit",              // STATUS_ACTION_MATRIX.maternity_visit
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "maternity_visits",   // backend permission keys
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
    scheduled: "bg-info",
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
    case "doctor":
      return renderUserName(entry.doctor);
    case "midwife":
      return renderUserName(entry.midwife);
    case "consultation":
      return entry.consultation
        ? `${renderDate(entry.consultation.consultation_date)} (${entry.consultation.status || "—"})`
        : "—";
    case "registrationLog":
      return entry.registrationLog
        ? `${renderDate(entry.registrationLog.registration_time)} (${entry.registrationLog.log_status || "—"})`
        : "—";
    case "billableItem":
      return entry.billableItem?.name || "—";
    case "invoice":
      return entry.invoice
        ? `${entry.invoice.invoice_number} (${entry.invoice.status || "—"})`
        : "—";

    // ---------------- USER ACTORS ----------------
    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);
    case "finalizedBy":
      return renderUserName(entry.finalizedBy);
    case "verifiedBy":
      return renderUserName(entry.verifiedBy);

    // ---------------- DATE FIELDS ----------------
    case "visit_date":
    case "lnmp":
    case "expected_due_date":
    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "finalized_at":
    case "verified_at":
      return renderDate(entry[field]);

    // ---------------- STATUS ----------------
    case "status":
      return renderStatus(entry.status);

    // ---------------- BOOLEAN ----------------
    case "is_emergency":
      return entry.is_emergency ? "Yes" : "No";

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
      FIELD_LABELS_MATERNITY_VISIT[field] || field.replace(/_/g, " ");
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
        <p><strong>${FIELD_LABELS_MATERNITY_VISIT[f] || f}:</strong>
        ${renderValue(entry, f)}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getMaternityVisitActionButtons(entry, user)}
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
  const tableBody = document.getElementById("maternityVisitTableBody");
  const cardContainer = document.getElementById("maternityVisitList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">
    No maternity visits found.</td></tr>`;

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
        .map((f) => {
          const val =
            f === "actions"
              ? `<div class="table-actions export-ignore">
                   ${getMaternityVisitActionButtons(entry, user)}
                 </div>`
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

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center py-3">No maternity visits found.</p>`;

    initTooltips(cardContainer);
  }
}
