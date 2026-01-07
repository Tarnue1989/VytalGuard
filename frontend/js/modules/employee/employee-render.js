// 📁 employee-render.js – Employee table & card renderers (Upgraded Master Pattern)
// ============================================================================
// 🧭 Fully mirrors patient-render.js
// 🔹 Identical image display logic (thumbnail + preview behavior)
// 🔹 Permission-driven buttons via status-action-matrix.js
// 🔹 Consistent renderValue, audit fields, tooltip handling
// 🔹 100% ID-safe, non-breaking upgrade
// ============================================================================

import { FIELD_LABELS_EMPLOYEE } from "./employee-constants.js";
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
function getEmployeeActionButtons(entry, user) {
  return buildActionButtons({
    module: "employee",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "employees",
  });
}

/* ============================================================
   🧱 Dynamic Table Head Renderer (FINAL – RESIZE READY)
   Matches patient-render.js exactly
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
      FIELD_LABELS_EMPLOYEE[field] || field.replace(/_/g, " ");

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
    col.style.width = "150px";
    colgroup.appendChild(col);
  });

  table.prepend(colgroup);

  /* ===============================
     📐 ENABLE COLUMN RESIZE
  =============================== */
  enableColumnResize(table);
}

/* ============================================================
   🔠 Field Render Helpers
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (user.full_name) return user.full_name;
  return user.email || "—";
}

function renderFileField(url, type = "file", isQr = false, label = null) {
  if (!url || typeof url !== "string") return "—";

  const safeUrl = url.startsWith("/uploads/")
    ? url
    : `/uploads/${url.replace(/^\/+/, "")}`;

  const fileName = safeUrl.split("/").pop();
  const style = isQr ? "max-width:150px;" : "max-width:60px;";

  if (type === "image") {
    return `
      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
         data-bs-toggle="tooltip" data-bs-title="Open Image">
        <img src="${safeUrl}" alt="${fileName}" class="rounded shadow-sm"
             style="${style}" onerror="this.style.display='none'" />
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
   🧩 Field Value Renderer
============================================================ */
function renderValue(entry, field, viewMode = "card") {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      let badgeClass = "bg-secondary";
      if (raw === "active") badgeClass = "bg-success";
      if (raw === "inactive") badgeClass = "bg-warning text-dark";
      if (raw === "terminated") badgeClass = "bg-danger";
      return raw ? `<span class="badge ${badgeClass}">${label}</span>` : "—";
    }

    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "department":
      return entry.department?.name || "—";
    case "user":
      return renderUserName(entry.user);
    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    // 📅 DATE ONLY (NO TIME)
    case "dob":
    case "hire_date":
    case "termination_date":
      return entry[field] ? formatDate(entry[field]) : "—";

    // 🕒 AUDIT TIMESTAMPS (DATE + TIME)
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    // 🖼️ Image/File behavior mirrors patient-render.js
    case "photo_path":
      return viewMode === "table"
        ? renderFileField(entry.photo_path, "file", false, "Profile Photo")
        : renderFileField(entry.photo_path, "image");

    case "resume_url":
      return renderFileField(entry.resume_url, "file", false, "Resume");
    case "document_url":
      return renderFileField(entry.document_url, "file", false, "Document");

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
    const label = FIELD_LABELS_EMPLOYEE[field] || field.replace(/_/g, " ");
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getEmployeeActionButtons(entry, user)}
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
   📋 List Renderer (Table + Card View)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("employeeTableBody");
  const cardContainer = document.getElementById("employeeList");
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
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No employees found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      let rowHTML = "";

      visibleFields.forEach((field) => {
        const value =
          field === "actions"
            ? `<div class="table-actions export-ignore">${getEmployeeActionButtons(entry, user)}</div>`
            : renderValue(entry, field, "table");

        const tdClass =
          field === "actions" ? ' class="actions-cell text-center"' : "";

        rowHTML += `<td${tdClass}>${value}</td>`;
      });

      row.innerHTML = rowHTML;
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
      : `<p class="text-muted">No employees found.</p>`;

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

  const title = "Employees Report";

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
      selector: ".table-container.active, #employeeList.active",
      orientation: "landscape",
    });
  });
}
