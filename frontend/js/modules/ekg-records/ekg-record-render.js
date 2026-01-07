import { FIELD_LABELS_EKG_RECORD } from "./ekg-record-constants.js";
import { formatDate } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js"; // ✅ shared centralized logic

/* ============================================================
   🧭 Tooltip Initializer
============================================================ */
function initTooltips(scope = document) {
  if (!window.bootstrap) return;
  const triggers = [].slice.call(
    scope.querySelectorAll("[data-bs-toggle='tooltip']")
  );
  triggers.forEach((el) => {
    if (!bootstrap.Tooltip.getInstance(el))
      new bootstrap.Tooltip(el);
  });
}

/* ============================================================
   🎛️ Action Buttons (Centralized)
============================================================ */
function getEKGRecordActionButtons(entry, user) {
  return buildActionButtons({
    module: "ekg_record", // 👈 matches STATUS_ACTION_MATRIX.ekg_record
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "ekg_records", // 👈 aligns with backend permission naming
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
      FIELD_LABELS_EKG_RECORD[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================
   🧍 Field Helpers
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.full_name || "—";
}

/* ============================================================
   🔢 Field Value Renderer
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    /* ---------------- STATUS ---------------- */
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const colorMap = {
        pending: "bg-info",
        in_progress: "bg-warning text-dark",
        completed: "bg-primary",
        verified: "bg-success",
        finalized: "bg-dark",
        cancelled: "bg-danger",
        voided: "bg-secondary",
      };
      return raw
        ? `<span class="badge ${colorMap[raw] || "bg-secondary"}">${label}</span>`
        : "—";
    }

    /* ---------------- RELATIONS ---------------- */
    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no || ""} - ${entry.patient.first_name || ""} ${entry.patient.last_name || ""}`.trim()
        : "—";
    case "consultation":
      return entry.consultation
        ? `${formatDate(entry.consultation.consultation_date)} (${entry.consultation.status})`
        : "—";
    case "registrationLog":
      return entry.registrationLog
        ? `${formatDate(entry.registrationLog.registration_time)} (${entry.registrationLog.log_status})`
        : "—";
    case "billableItem":
      return entry.billableItem?.name || "—";
    case "invoice":
      return entry.invoice
        ? `${entry.invoice.invoice_number} (${entry.invoice.status})`
        : "—";
    case "technician":
      return renderUserName(entry.technician);

    /* ---------------- FILE ---------------- */
    case "file_path":
      return entry.file_path
        ? `<a href="${entry.file_path}" target="_blank" class="text-decoration-underline">View File</a>`
        : "—";

    /* ---------------- BOOLEAN ---------------- */
    case "is_emergency":
      return entry.is_emergency ? "✅ Yes" : "❌ No";

    /* ---------------- USER ACTORS ---------------- */
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

    /* ---------------- DATE FIELDS ---------------- */
    case "recorded_date":
    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "verified_at":
    case "finalized_at":
    case "voided_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    /* ---------------- DEFAULT ---------------- */
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
    const label =
      FIELD_LABELS_EKG_RECORD[field] || field.replace(/_/g, " ");
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getEKGRecordActionButtons(entry, user)}
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
   📋 List Renderer (Table + Card View)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("ekgRecordTableBody");
  const cardContainer = document.getElementById("ekgRecordList");
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
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No EKG records found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      row.innerHTML = visibleFields
        .map((f) => {
          const val =
            f === "actions"
              ? `<div class="table-actions export-ignore">${getEKGRecordActionButtons(entry, user)}</div>`
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
      : `<p class="text-muted text-center py-3">No EKG records found.</p>`;

    initTooltips(cardContainer);
  }
}
