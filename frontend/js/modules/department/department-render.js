// 📁 department-render.js – Department Table & Card Renderers (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: patient-render.js / role-render.js
// 🔹 Entity-card architecture (header, context, body, audit, actions)
// 🔹 Permission-driven buttons via STATUS_ACTION_MATRIX
// 🔹 Field-selector safe
// 🔹 100% ID-safe (departmentTableBody / departmentList)
// ============================================================================

import { FIELD_LABELS_DEPARTMENT } from "./department-constants.js";
import {
  formatDate,
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";

/* ============================================================
   🎛️ Action Buttons
============================================================ */
function getDepartmentActionButtons(entry, user) {
  return buildActionButtons({
    module: "department",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "departments",
  });
}

/* ============================================================
   🧱 Dynamic Table Head
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent =
      FIELD_LABELS_DEPARTMENT[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================
   🔠 Helpers
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

function renderStatusBadge(status) {
  const raw = (status || "").toLowerCase();
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  let cls = "bg-secondary";
  if (raw === "active") cls = "bg-success";
  if (raw === "inactive") cls = "bg-warning text-dark";
  if (raw === "deleted") cls = "bg-danger";
  return `<span class="badge ${cls}">${label}</span>`;
}

/* ============================================================
   🧩 Field Renderer (TABLE + CARD)
============================================================ */
function renderValue(entry, field, viewMode = "card") {
  switch (field) {
    case "status":
      return renderStatusBadge(entry.status);

    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    case "head_of_department":
      return entry.head_of_department
        ? renderUserName(entry.head_of_department)
        : "—";

    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default:
      return entry[field] != null && entry[field] !== ""
        ? String(entry[field])
        : "—";
  }
}

/* ============================================================
   🗂️ CARD RENDERER — ENTITY SYSTEM (DEPARTMENT | FINAL)
   ------------------------------------------------------------
   ✔ Header = Identity + Status
   ✔ Context = Organization / Facility / Head
   ✔ Body = Department meaning only
   ✔ Audit = Collapsible (enterprise standard)
   ✔ Actions = Permission-driven
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

  /* ================= HEADER ================= */
  const header = `
    <div class="entity-card-header">
      <div>
        <div class="entity-secondary">${safe(entry.code)}</div>
        <div class="entity-primary">${safe(entry.name)}</div>
      </div>
      ${
        has("status")
          ? renderStatusBadge(entry.status)
          : ""
      }
    </div>
  `;

  /* ================= CONTEXT (NO REDUNDANCY) ================= */
  const contextItems = [];
  if (has("organization") && entry.organization)
    contextItems.push(`🏥 ${safe(entry.organization.name)}`);
  if (has("facility") && entry.facility)
    contextItems.push(`📍 ${safe(entry.facility.name)}`);
  if (has("head_of_department") && entry.head_of_department)
    contextItems.push(`👤 ${renderUserName(entry.head_of_department)}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map(v => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  /* ================= BODY (DEPARTMENT ONLY) ================= */
  const left = [];
  const right = [];

  if (has("description"))
    left.push(fieldRow("Description", entry.description));

  if (has("head_of_department"))
    left.push(
      fieldRow(
        "Head of Department",
        renderValue(entry, "head_of_department")
      )
    );

  const body = `
    <div class="entity-card-body">
      <div>${left.join("")}</div>
      <div>${right.join("")}</div>
    </div>
  `;

  /* ================= AUDIT (ENTERPRISE STANDARD) ================= */
  const auditFields = [];

  if (has("created_at"))
    auditFields.push(fieldRow("Created At", renderValue(entry, "created_at")));
  if (has("createdBy"))
    auditFields.push(fieldRow("Created By", renderValue(entry, "createdBy")));

  if (has("updated_at"))
    auditFields.push(fieldRow("Updated At", renderValue(entry, "updated_at")));
  if (has("updatedBy"))
    auditFields.push(fieldRow("Updated By", renderValue(entry, "updatedBy")));

  if (has("deleted_at") && entry.deleted_at)
    auditFields.push(fieldRow("Deleted At", renderValue(entry, "deleted_at")));
  if (has("deletedBy") && entry.deletedBy)
    auditFields.push(fieldRow("Deleted By", renderValue(entry, "deletedBy")));

  const auditSection = auditFields.length
    ? `<details class="entity-notes">
         <summary>Audit Information</summary>
         <div class="entity-card-body">
           <div>${auditFields.join("")}</div>
         </div>
       </details>`
    : "";

  /* ================= ACTIONS ================= */
  const actions = has("actions")
    ? `<div class="entity-card-footer">
         ${getDepartmentActionButtons(entry, user)}
       </div>`
    : "";

  /* ================= FINAL ================= */
  return `
    <div class="entity-card department-card">
      ${header}
      ${context}
      ${body}
      ${auditSection}
      ${actions}
    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER (TABLE + CARD)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("departmentTableBody");
  const cardContainer = document.getElementById("departmentList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No departments found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((field) =>
          field === "actions"
            ? `<td class="actions-cell text-center export-ignore">
                 ${getDepartmentActionButtons(entry, user)}
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
      ? entries.map(e => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted">No departments found.</p>`;

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

  const title = "Departments Report";

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
      selector: ".table-container.active, #departmentList.active",
      orientation: "landscape",
    });
  });
}
