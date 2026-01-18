// 📁 patient-render.js – Entity Card System (Enterprise Master)
// ============================================================================
// 🧭 Matches appointment-render.js entity-card architecture
// 🔹 Table = flat | Card = structured
// 🔹 Field-selector safe
// 🔹 JSONB emergency_contacts supported
// 🔹 Media fields (photo / QR) handled correctly
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
   🔃 Sortable Fields (TABLE ONLY)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "pat_no",
  "first_name",
  "last_name",
  "gender",
  "registration_status",
  "date_of_birth",
  "created_at",
  "updated_at",

  // ✅ JOIN-BASED SORTS (backend-supported)
  "organization",
  "facility",
]);


/* ============================================================
   🔃 Sort State (TABLE ONLY – LOCAL UI STATE)
   ❗ MAIN owns backend state
============================================================ */
let sortBy = localStorage.getItem("patientSortBy") || "";
let sortDir = localStorage.getItem("patientSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  // 💾 persist UI state
  localStorage.setItem("patientSortBy", sortBy);
  localStorage.setItem("patientSortDir", sortDir);

  // 🔗 bridge to MAIN (ONLY correct reload path)
  window.setPatientSort?.(sortBy, sortDir);
  window.loadPatientPage?.(1);
}

/* ============================================================
   🎛️ Action Buttons
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
   🧱 Dynamic Table Head (SORTABLE)
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  const table = thead?.closest("table");
  if (!thead || !table) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    const label = FIELD_LABELS_PATIENT[field] || field;

    // ❌ actions column not sortable
    if (field === "actions") {
      th.textContent = "Actions";
      th.classList.add("actions-cell");
      tr.appendChild(th);
      return;
    }

    th.dataset.key = field;

    if (SORTABLE_FIELDS.has(field)) {
      th.classList.add("sortable");

      let icon = "ri-arrow-up-down-line";
      if (sortBy === field) {
        icon = sortDir === "asc"
          ? "ri-arrow-up-line"
          : "ri-arrow-down-line";
      }

      th.innerHTML = `
        <span>${label}</span>
        <i class="${icon} sort-icon"></i>
      `;

      th.onclick = () => toggleSort(field);
    } else {
      th.innerHTML = `<span>${label}</span>`;
    }

    tr.appendChild(th);
  });

  thead.appendChild(tr);

  /* === column resize stays intact === */
  let colgroup = table.querySelector("colgroup");
  if (colgroup) colgroup.remove();

  colgroup = document.createElement("colgroup");
  visibleFields.forEach(() => {
    const col = document.createElement("col");
    col.style.width = "150px";
    colgroup.appendChild(col);
  });

  table.prepend(colgroup);
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
  if (!url) return "—";
  const safeUrl = url.startsWith("/uploads/") ? url : `/uploads/${url}`;
  const fileName = safeUrl.split("/").pop();
  const style = isQr ? "max-width:140px;" : "max-width:60px;";

  if (type === "image") {
    return `
      <a href="${safeUrl}" target="_blank">
        <img src="${safeUrl}" class="rounded shadow-sm" style="${style}" />
      </a>
    `;
  }

  return `
    <a href="${safeUrl}" target="_blank">
      <i class="ri-file-2-line me-1"></i>${label || fileName}
    </a>
  `;
}

function renderEmergencyContacts(value, viewMode = "card") {
  if (!Array.isArray(value) || !value.length) return "—";

  if (viewMode === "table") {
    return value.map(c => `${c.name || "—"} (${c.phone || "—"})`).join("<br>");
  }

  return `
    <ul class="mb-0 ps-3">
      ${value.map(
        c => `<li>${c.name || "—"} <small>(${c.phone || "—"})</small></li>`
      ).join("")}
    </ul>
  `;
}

/* ============================================================
   🧩 Field Value Renderer (TABLE + CARD)
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
      return `<span class="badge ${cls}">${label}</span>`;
    }

    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "date_of_birth":
      return entry.date_of_birth ? formatDate(entry.date_of_birth) : "—";

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
   🗂️ CARD RENDERER — ENTITY SYSTEM (PATIENT | FINAL + AUDIT)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = f => visibleFields.includes(f);
  const safe = v => (v !== null && v !== undefined && v !== "" ? v : "—");

  const fieldRow = (label, value) => `
    <div class="entity-field">
      <span class="entity-label">${label}</span>
      <span class="entity-value">${safe(value)}</span>
    </div>
  `;

  const fullName =
    [entry.first_name, entry.middle_name, entry.last_name]
      .filter(Boolean)
      .join(" ") || "Unnamed Patient";

  const status = (entry.registration_status || "").toLowerCase();

  const header = `
    <div class="entity-card-header">
      <div>
        <div class="entity-secondary">${safe(entry.pat_no)}</div>
        <div class="entity-primary">${fullName}</div>
      </div>
      ${
        has("registration_status")
          ? `<span class="entity-status ${status}">
               ${status.toUpperCase()}
             </span>`
          : ""
      }
    </div>
  `;

  const contextItems = [];
  if (has("organization")) contextItems.push(`🏥 ${safe(entry.organization?.name)}`);
  if (has("facility")) contextItems.push(`📍 ${safe(entry.facility?.name)}`);
  if (has("date_of_birth"))
    contextItems.push(`🎂 DOB: ${formatDate(entry.date_of_birth)}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map(v => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  const left = [];
  const right = [];

  if (has("gender")) left.push(fieldRow("Gender", entry.gender));
  if (has("marital_status")) left.push(fieldRow("Marital Status", entry.marital_status));
  if (has("religion")) left.push(fieldRow("Religion", entry.religion));
  if (has("profession")) left.push(fieldRow("Profession", entry.profession));

  if (has("national_id")) left.push(fieldRow("National ID", entry.national_id));
  if (has("insurance_number"))
    left.push(fieldRow("Insurance No.", entry.insurance_number));
  if (has("passport_number"))
    left.push(fieldRow("Passport No.", entry.passport_number));

  if (has("phone_number")) right.push(fieldRow("Phone", entry.phone_number));
  if (has("email_address")) right.push(fieldRow("Email", entry.email_address));
  if (has("home_address")) right.push(fieldRow("Address", entry.home_address));
  if (has("photo_path"))
    right.push(fieldRow("Photo", renderValue(entry, "photo_path")));
  if (has("qr_code_path"))
    right.push(fieldRow("QR Code", renderValue(entry, "qr_code_path")));

  const body = `
    <div class="entity-card-body">
      <div>${left.join("")}</div>
      <div>${right.join("")}</div>
    </div>
  `;

  const actions = has("actions")
    ? `<div class="entity-card-footer">
         ${getPatientActionButtons(entry, user)}
       </div>`
    : "";

  return `
    <div class="entity-card patient-card">
      ${header}
      ${context}
      ${body}
      ${actions}
    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER (TABLE + CARD)
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
