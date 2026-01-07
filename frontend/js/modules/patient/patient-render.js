// 📁 patient-render.js – Patient table & card renderers (Enterprise Master)
// ============================================================================
// 🧭 Matches employee-render.js / delivery-record-render.js standard
// 🔹 Handles JSONB emergency_contacts correctly
// 🔹 Permission-driven buttons via status-action-matrix.js
// 🔹 DOB = DATE ONLY | Audit fields = DATE + TIME
// ============================================================================

import { FIELD_LABELS_PATIENT } from "./patient-constants.js";
import {
  formatDate,
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";

/* ============================================================
   🎛️ Permission-driven Action Buttons
============================================================ */
function getPatientActionButtons(entry, user) {
  return buildActionButtons({
    module: "patient",
    status: (entry.registration_status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "patients",
  });
}

/* ============================================================
   🧱 Dynamic Table Head Renderer (FINAL – RESIZE READY)
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  const table = thead?.closest("table");
  if (!thead || !table) return;

  /* ===============================
     🟦 RESET HEADER
  =============================== */
  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent =
      FIELD_LABELS_PATIENT[field] || field.replace(/_/g, " ");
    th.dataset.key = field;

    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);

  /* ===============================
     🟩 CREATE COLGROUP (CRITICAL)
  =============================== */
  let colgroup = table.querySelector("colgroup");
  if (colgroup) colgroup.remove();

  colgroup = document.createElement("colgroup");

  visibleFields.forEach(() => {
    const col = document.createElement("col");
    col.style.width = "150px"; // default width
    colgroup.appendChild(col);
  });

  table.prepend(colgroup);

  /* ===============================
     📐 ENABLE COLUMN RESIZE
  =============================== */
  enableColumnResize(table);
}

/* ============================================================
   🔠 Helpers
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.email || "—";
}

function renderFileField(url, type = "file", isQr = false, label = null) {
  if (!url || typeof url !== "string") return "—";

  const safeUrl = url.startsWith("/uploads/")
    ? url
    : `/uploads/${url.replace(/^\/+/, "")}`;

  const fileName = safeUrl.split("/").pop();
  const style = isQr ? "max-width:140px;" : "max-width:60px;";

  if (type === "image") {
    return `
      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
         data-bs-toggle="tooltip" data-bs-title="Open Image">
        <img src="${safeUrl}" alt="${fileName}"
             class="rounded shadow-sm"
             style="${style}" />
      </a>
    `;
  }

  return `
    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
       data-bs-toggle="tooltip" data-bs-title="View File">
      <i class="ri-file-2-line me-1"></i>${label || fileName}
    </a>
  `;
}

/* ============================================================
   ☎️ Emergency Contacts Renderer (JSONB SAFE)
============================================================ */
function renderEmergencyContacts(value, viewMode = "card") {
  if (!Array.isArray(value) || !value.length) return "—";

  if (viewMode === "table") {
    return value
      .map((c) => `${c.name || "—"} (${c.phone || "—"})`)
      .join("<br>");
  }

  return `
    <ul class="mb-0 ps-3">
      ${value
        .map(
          (c) =>
            `<li>${c.name || "—"} <small class="text-muted">(${c.phone || "—"})</small></li>`
        )
        .join("")}
    </ul>
  `;
}

/* ============================================================
   🧩 Field Value Renderer (FIXED)
============================================================ */
function renderValue(entry, field, viewMode = "card") {
  switch (field) {
    case "registration_status": {
      const raw = (entry.registration_status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      let cls = "bg-secondary";
      if (raw === "active") cls = "bg-success";
      if (raw === "cancelled") cls = "bg-warning text-dark";
      if (raw === "voided") cls = "bg-danger";
      return raw ? `<span class="badge ${cls}">${label}</span>` : "—";
    }

    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    case "registeredBy":
    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    // ✅ DOB — DATE ONLY (NO TIME EVER)
    case "date_of_birth":
      return entry.date_of_birth ? formatDate(entry.date_of_birth) : "—";

    // ✅ AUDIT FIELDS — DATE + TIME
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    case "photo_path":
      return viewMode === "table"
        ? renderFileField(entry.photo_path, "file", false, "Photo")
        : renderFileField(entry.photo_path, "image");

    case "qr_code_path":
      return viewMode === "table"
        ? renderFileField(entry.qr_code_path, "file", true, "QR Code")
        : renderFileField(entry.qr_code_path, "image", true);

    case "emergency_contacts":
      return renderEmergencyContacts(entry.emergency_contacts, viewMode);

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
    const label = FIELD_LABELS_PATIENT[field] || field.replace(/_/g, " ");
    html += `<p><strong>${label}:</strong> ${renderValue(entry, field)}</p>`;
  });

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getPatientActionButtons(entry, user)}
        </div>
      </div>`
    : "";

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      ${footer}
    </div>
  `;
}

/* ============================================================
   📋 List Renderer (Table + Card)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("patientTableBody");
  const cardContainer = document.getElementById("patientList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No patients found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((field) =>
          field === "actions"
            ? `<td class="actions-cell text-center export-ignore">
                ${getPatientActionButtons(entry, user)}
               </td>`
            : `<td>${renderValue(entry, field, "table")}</td>`
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
      : `<p class="text-muted">No patients found.</p>`;

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

  const title = "Patients Report";

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
      selector: ".table-container.active, #patientList.active",
      orientation: "landscape",
    });
  });
}
