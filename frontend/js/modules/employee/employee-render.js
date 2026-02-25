// 📁 employee-render.js – Entity Card System (EMPLOYEE | ENTERPRISE MASTER)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH patient-render.js
// 🔹 Table = flat | Card = RICH + professional
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize + drag enabled
// 🔹 FULL audit section (created / updated / deleted)
// 🔹 Permission-driven actions
// 🔹 Export-safe (no object leaks)
// 🔹 Media fields (photo / resume / document) handled correctly
// ============================================================================

import { FIELD_LABELS_EMPLOYEE } from "./employee-constants.js";
import { calculateAge } from "../../utils/calculateAge.js";

import {
  formatDate,
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE FIELDS (MASTER)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "employee_no",
  "first_name",
  "last_name",
  "gender",
  "status",
  "dob",
  "hire_date",
  "created_at",
  "updated_at",
  "organization",
  "facility",
  "department",
]);

let sortBy = localStorage.getItem("employeeSortBy") || "";
let sortDir = localStorage.getItem("employeeSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("employeeSortBy", sortBy);
  localStorage.setItem("employeeSortDir", sortDir);

  window.setEmployeeSort?.(sortBy, sortDir);
  window.loadEmployeePage?.(1);
}

/* ============================================================
   🎛️ ACTIONS
============================================================ */
function getEmployeeActionButtons(entry, user) {
  return buildActionButtons({
    module: "employee",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "employees",
  });
}

/* ============================================================
   🧱 TABLE HEAD (DYNAMIC + RESIZE + DRAG)
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  const table = thead?.closest("table");
  if (!thead || !table) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.dataset.key = field;

    const label = FIELD_LABELS_EMPLOYEE[field] || field.replace(/_/g, " ");

    if (field === "actions") {
      th.textContent = "Actions";
      th.classList.add("actions-cell");
      tr.appendChild(th);
      return;
    }

    if (SORTABLE_FIELDS.has(field)) {
      let icon = "ri-arrow-up-down-line";
      if (sortBy === field) {
        icon = sortDir === "asc"
          ? "ri-arrow-up-line"
          : "ri-arrow-down-line";
      }

      th.classList.add("sortable");
      th.innerHTML = `<span>${label}</span><i class="${icon} sort-icon"></i>`;
      th.onclick = () => toggleSort(field);
    } else {
      th.innerHTML = `<span>${label}</span>`;
    }

    tr.appendChild(th);
  });

  thead.appendChild(tr);

  let colgroup = table.querySelector("colgroup");
  if (colgroup) colgroup.remove();

  colgroup = document.createElement("colgroup");
  visibleFields.forEach(() => {
    const col = document.createElement("col");
    col.style.width = "160px";
    colgroup.appendChild(col);
  });
  table.prepend(colgroup);

  enableColumnResize(table);
  enableColumnDrag({
    table,
    visibleFields,
    onReorder: () => window.loadEmployeePage?.(1),
  });
}

/* ============================================================
   🔠 HELPERS
============================================================ */
const safe = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");

function renderUserName(u) {
  if (!u) return "—";
  return (
    [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ") ||
    u.full_name ||
    u.email ||
    "—"
  );
}

function renderImage(url, size = 64) {
  if (!url) return "";
  const src = url.startsWith("/uploads/") ? url : `/uploads/${url}`;
  return `
    <a href="${src}" target="_blank">
      <img src="${src}" class="rounded shadow-sm"
           style="width:${size}px;height:${size}px;object-fit:cover;" />
    </a>
  `;
}

function renderFile(url, label) {
  if (!url) return "—";
  const src = url.startsWith("/uploads/") ? url : `/uploads/${url}`;
  const name = src.split("/").pop();
  return `<a href="${src}" target="_blank">${label || name}</a>`;
}

/* ============================================================
   🧩 VALUE RENDERER (OBJECT SAFE)
============================================================ */
function renderValue(entry, field, viewMode = "card") {
  switch (field) {
    case "status": {
      const s = (entry.status || "").toLowerCase();
      const cls =
        s === "active" ? "bg-success" :
        s === "inactive" ? "bg-warning text-dark" :
        s === "terminated" ? "bg-danger" :
        "bg-secondary";
      return `<span class="badge ${cls}">${s.toUpperCase()}</span>`;
    }

    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "department":
      return entry.department?.name || "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "dob":
    case "hire_date":
    case "termination_date":
      return entry[field] ? formatDate(entry[field]) : "—";

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    case "photo_path":
      return viewMode === "table" ? "Photo" : renderImage(entry.photo_path, 80);

    case "resume_url":
      return renderFile(entry.resume_url, "Resume");

    case "document_url":
      return renderFile(entry.document_url, "Document");

    default: {
      const v = entry[field];
      if (v === null || v === undefined || v === "") return "—";
      if (typeof v === "object") return "—";
      return v;
    }
  }
}
function renderFileLink(url, label = "View File") {
  if (!url) return "—";

  const href = url.startsWith("/uploads/")
    ? url
    : `/uploads/${url}`;

  return `
    <a href="${href}"
       target="_blank"
       rel="noopener"
       class="text-primary fw-semibold">
       📎 ${label}
    </a>
  `;
}

/* ============================================================
   🗂️ EMPLOYEE CARD RENDERER — ENTERPRISE / MASTER
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const fullName =
    entry.full_name ||
    [entry.first_name, entry.middle_name, entry.last_name]
      .filter(Boolean)
      .join(" ") ||
    "Unnamed Employee";

  return `
    <div class="entity-card employee-card">

      <!-- ================= HEADER ================= -->
      <div class="entity-card-header d-flex align-items-center gap-3">
        ${
          has("photo_path")
            ? `<div class="entity-avatar">
                 ${renderImage(entry.photo_path, 64)}
               </div>`
            : ""
        }

        <div class="entity-header-main flex-grow-1">
          ${
            has("employee_no")
              ? `<div class="entity-secondary">${safe(entry.employee_no)}</div>`
              : ""
          }
          <div class="entity-primary">${safe(fullName)}</div>
        </div>

        ${
          has("status")
            ? `<span class="entity-status ${status}">
                 ${safe(status.toUpperCase())}
               </span>`
            : ""
        }
      </div>

      <!-- ================= CONTEXT ================= -->
      <div class="entity-card-context">
        ${entry.organization ? `<div>🏥 ${safe(entry.organization.name)}</div>` : ""}
        ${entry.facility ? `<div>📍 ${safe(entry.facility.name)}</div>` : ""}
        ${entry.department ? `<div>🏢 ${safe(entry.department.name)}</div>` : ""}
        ${entry.position ? `<div>🧑‍⚕️ ${safe(entry.position)}</div>` : ""}
        ${
          entry.dob
            ? `<div>🎂 DOB: ${formatDate(entry.dob)} • ${calculateAge(entry.dob)}</div>`
            : ""
        }
      </div>


      <!-- ================= BODY ================= -->
      <div class="entity-card-body">
        ${
          has("gender")
            ? `<div class="entity-field">
                 <span class="entity-label">Gender</span>
                 <span class="entity-value">${safe(entry.gender)}</span>
               </div>`
            : ""
        }

        ${
          has("phone")
            ? `<div class="entity-field">
                 <span class="entity-label">Phone</span>
                 <span class="entity-value">${safe(entry.phone)}</span>
               </div>`
            : ""
        }

        ${
          has("email")
            ? `<div class="entity-field">
                 <span class="entity-label">Email</span>
                 <span class="entity-value">${safe(entry.email)}</span>
               </div>`
            : ""
        }

        ${
          has("address")
            ? `<div class="entity-field">
                 <span class="entity-label">Address</span>
                 <span class="entity-value">${safe(entry.address)}</span>
               </div>`
            : ""
        }

        ${
          has("license_no")
            ? `<div class="entity-field">
                 <span class="entity-label">License</span>
                 <span class="entity-value">${safe(entry.license_no)}</span>
               </div>`
            : ""
        }

        ${
          has("specialty")
            ? `<div class="entity-field">
                 <span class="entity-label">Specialty</span>
                 <span class="entity-value">${safe(entry.specialty)}</span>
               </div>`
            : ""
        }

        ${
          has("resume_url")
            ? `<div class="entity-field">
                 <span class="entity-label">Resume</span>
                 <span class="entity-value">${renderFileLink(entry.resume_url, "View Resume")}</span>
               </div>`
            : ""
        }

        ${
          has("document_url")
            ? `<div class="entity-field">
                 <span class="entity-label">Document</span>
                 <span class="entity-value">${renderFileLink(entry.document_url, "View Document")}</span>
               </div>`
            : ""
        }
      </div>

      <!-- ================= AUDIT ================= -->
      <details class="entity-audit">
        <summary>Audit</summary>

        <div class="entity-card-body">
          <div class="entity-field">
            <span class="entity-label">Created By</span>
            <span class="entity-value">${renderUserName(entry.createdBy)}</span>
          </div>

          <div class="entity-field">
            <span class="entity-label">Created At</span>
            <span class="entity-value">${formatDateTime(entry.created_at)}</span>
          </div>

          <div class="entity-field">
            <span class="entity-label">Updated By</span>
            <span class="entity-value">${renderUserName(entry.updatedBy)}</span>
          </div>

          <div class="entity-field">
            <span class="entity-label">Updated At</span>
            <span class="entity-value">${formatDateTime(entry.updated_at)}</span>
          </div>

          <div class="entity-field">
            <span class="entity-label">Deleted By</span>
            <span class="entity-value">${renderUserName(entry.deletedBy)}</span>
          </div>

          <div class="entity-field">
            <span class="entity-label">Deleted At</span>
            <span class="entity-value">${formatDateTime(entry.deleted_at)}</span>
          </div>
        </div>
      </details>

      <!-- ================= ACTIONS ================= -->
      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getEmployeeActionButtons(entry, user)}
             </div>`
          : ""
      }

    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("employeeTableBody");
  const cardContainer = document.getElementById("employeeList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");
    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${visibleFields.length}" class="text-center text-muted">
            No employees found.
          </td>
        </tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">${getEmployeeActionButtons(e, user)}</td>`
            : `<td>${renderValue(e, f, "table")}</td>`
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
      : `<p class="text-center text-muted">No employees found.</p>`;
    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📤 EXPORT (MASTER)
============================================================ */
let exportHandlersBound = false;
function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Employees Report";

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
      selector: ".table-container.active, #employeeList.active",
      orientation: "landscape",
    })
  );
}
