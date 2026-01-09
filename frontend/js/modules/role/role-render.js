// 📁 role-render.js – Entity Card System (Enterprise Master)
// ============================================================================
// 🧭 Fully aligned with patient-render.js entity-card architecture
// 🔹 Table = flat | Card = structured
// 🔹 Field-selector safe
// 🔹 Full audit section (created / updated / deleted)
// 🔹 Permission-driven actions
// ============================================================================

import { FIELD_LABELS_ROLE } from "./role-constants.js";
import {
  formatDate,
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";

/* ============================================================
   🎛️ Action Buttons
============================================================ */
function getRoleActionButtons(entry, user) {
  return buildActionButtons({
    module: "role",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "roles",
  });
}

/* ============================================================
   🧱 Dynamic Table Head (Resize Ready)
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  const table = thead?.closest("table");
  if (!thead || !table) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = FIELD_LABELS_ROLE[field] || field.replace(/_/g, " ");
    th.dataset.key = field;
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);

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
  return parts.length ? parts.join(" ") : user.username || user.email || "—";
}

/* ============================================================
   🧩 Field Value Renderer
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      let cls = "bg-secondary";
      if (raw === "active") cls = "bg-success";
      if (raw === "inactive") cls = "bg-warning text-dark";
      if (raw === "deleted") cls = "bg-danger";
      return `<span class="badge ${cls}">${label}</span>`;
    }

    case "role_type": {
      const raw = (entry.role_type || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const map = {
        system: "bg-dark",
        owner: "bg-primary",
        custom: "bg-info text-dark",
      };
      return `<span class="badge ${map[raw] || "bg-secondary"}">${label}</span>`;
    }

    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default:
      return entry[field] != null && entry[field] !== "" ? String(entry[field]) : "—";
  }
}

/* ============================================================
   🗂️ CARD RENDERER — ENTITY SYSTEM (ROLE | FINAL)
   ------------------------------------------------------------
   ✔ Header = Identity + Status
   ✔ Context = Scope + Classification
   ✔ Body = Role meaning only
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
  const status = (entry.status || "").toLowerCase();

  const header = `
    <div class="entity-card-header">
      <div>
        <div class="entity-secondary">${safe(entry.code)}</div>
        <div class="entity-primary">${safe(entry.name)}</div>
      </div>
      ${
        has("status")
          ? `<span class="entity-status ${status}">
               ${status.toUpperCase()}
             </span>`
          : ""
      }
    </div>
  `;

  /* ================= CONTEXT (SCOPE ONLY) ================= */
  const contextItems = [];

  if (has("organization") && entry.organization)
    contextItems.push(`🏥 ${safe(entry.organization.name)}`);

  if (has("facility") && entry.facility)
    contextItems.push(`📍 ${safe(entry.facility.name)}`);

  if (has("role_type"))
    contextItems.push(`🔐 ${renderValue(entry, "role_type")}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map(v => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  /* ================= BODY (NO REDUNDANCY) ================= */
  const left = [];
  const right = [];

  if (has("description"))
    left.push(fieldRow("Description", entry.description));

  const body = `
    <div class="entity-card-body">
      <div>${left.join("")}</div>
      <div>${right.join("")}</div>
    </div>
  `;

  /* ================= AUDIT (STANDARDIZED) ================= */
  const auditFields = [];

  if (has("created_at"))
    auditFields.push(fieldRow("Created At", formatDateTime(entry.created_at)));
  if (has("createdBy"))
    auditFields.push(fieldRow("Created By", renderUserName(entry.createdBy)));

  if (has("updated_at"))
    auditFields.push(fieldRow("Updated At", formatDateTime(entry.updated_at)));
  if (has("updatedBy"))
    auditFields.push(fieldRow("Updated By", renderUserName(entry.updatedBy)));

  if (has("deleted_at") && entry.deleted_at)
    auditFields.push(fieldRow("Deleted At", formatDateTime(entry.deleted_at)));
  if (has("deletedBy") && entry.deletedBy)
    auditFields.push(fieldRow("Deleted By", renderUserName(entry.deletedBy)));

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
         ${getRoleActionButtons(entry, user)}
       </div>`
    : "";

  /* ================= FINAL ================= */
  return `
    <div class="entity-card role-card">
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
  const tableBody = document.getElementById("roleTableBody");
  const cardContainer = document.getElementById("roleList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No roles found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach(entry => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields.map(field =>
        field === "actions"
          ? `<td class="actions-cell text-center export-ignore">
               ${getRoleActionButtons(entry, user)}
             </td>`
          : `<td>${renderValue(entry, field)}</td>`
      ).join("");
      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    cardContainer.innerHTML = entries.length
      ? entries.map(e => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted">No roles found.</p>`;

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

  const title = "Roles Report";

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
      selector: ".table-container.active, #roleList.active",
      orientation: "landscape",
    });
  });
}
