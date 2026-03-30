// 📁 user-render.js – ENTERPRISE MASTER FINAL (FULL PARITY – UPGRADED)
// ============================================================================
// 🔹 FULL parity with role-render.js
// 🔹 Table + Card unified system
// 🔹 Sorting (backend bridge)
// 🔹 Column resize + drag reorder
// 🔹 Full audit section added
// 🔹 Context section added
// 🔹 Field-selector safe
// 🔹 Export-safe
// 🔹 ALL IDs preserved
// ============================================================================

import { FIELD_LABELS_USER } from "./user-constants.js";

import {
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE FIELDS
============================================================ */
const SORTABLE_FIELDS = new Set([
  "username",
  "email",
  "status",
  "last_login_at",
  "locked_until",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("userSortBy") || "";
let sortDir = localStorage.getItem("userSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("userSortBy", sortBy);
  localStorage.setItem("userSortDir", sortDir);

  window.setUserSort?.(sortBy, sortDir);
  window.loadUserPage?.(1);
}

/* ============================================================
   🎛️ ACTION BUTTONS
============================================================ */
function getUserActionButtons(entry, user) {
  return buildActionButtons({
    module: "user",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    entry,
    user,
    permissionPrefix: "users",
  });
}

/* ============================================================
   🧱 TABLE HEAD (SORT + RESIZE + DRAG)
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  const table = thead?.closest("table");
  if (!thead || !table) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    const label =
      FIELD_LABELS_USER[field] || field.replace(/_/g, " ");

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
        icon =
          sortDir === "asc"
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

  /* ================= Column resize ================= */
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

  /* ================= Column drag ================= */
  enableColumnDrag({
    table,
    visibleFields,
    onReorder: () => {
      renderDynamicTableHead(visibleFields);
      window.loadUserPage?.(1);
    },
  });
}

/* ============================================================
   🔠 HELPERS
============================================================ */
const safe = (v) =>
  v !== null && v !== undefined && v !== "" ? v : "—";

function renderUserRef(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length
    ? parts.join(" ")
    : user.username || user.email || "—";
}

/* ============================================================
   🧩 FIELD VALUE RENDERER
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const map = {
        active: "bg-success",
        inactive: "bg-warning text-dark",
        suspended: "bg-danger",
      };
      return `<span class="badge ${map[raw] || "bg-secondary"}">
        ${raw.toUpperCase()}
      </span>`;
    }

    case "full_name":
      return (
        [entry.first_name, entry.last_name]
          .filter(Boolean)
          .join(" ") || "—"
      );

    case "organization":
      return entry.organization?.name || "—";

    case "facilities":
      return Array.isArray(entry.facilities)
        ? entry.facilities.map((f) => f.name).join(", ")
        : "—";

    case "roles":
      return Array.isArray(entry.roles)
        ? entry.roles.map((r) => r.name).join(", ")
        : "—";

    case "createdByUser":
    case "updatedByUser":
    case "deletedByUser":
      return renderUserRef(entry[field]);

    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "last_login_at":
    case "locked_until":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🗂️ CARD RENDERER (FULL MASTER - CLEAN)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const safe = (v) =>
    v !== null && v !== undefined && v !== "" ? v : "—";

  const fieldRow = (label, value) =>
    value
      ? `<div class="entity-field">
           <span class="entity-label">${label}</span>
           <span class="entity-value">${safe(value)}</span>
         </div>`
      : "";

  /* ================= HELPERS ================= */

  const renderRoles = (roles) => {
    if (!roles) return "—";
    if (typeof roles === "string") return roles;
    if (Array.isArray(roles)) {
      return roles.map((r) => r.name || r).join(", ");
    }
    return "—";
  };

  const renderFacilities = (facs) => {
    if (!facs) return "—";
    if (typeof facs === "string") return facs;
    if (Array.isArray(facs)) {
      return facs.map((f) => f.name || f).join(", ");
    }
    return "—";
  };

  /* ================= HEADER ================= */
  const header = `
    <div class="entity-card-header">
      <div>
        <div class="entity-primary">
          ${safe(
            renderValue(entry, "full_name") ||
            [entry.first_name, entry.last_name].filter(Boolean).join(" ")
          )}
        </div>

        <!-- ✅ EMAIL (NO UPPERCASE) -->
        <div class="entity-secondary" style="text-transform:none;">
          ${safe(entry.email)}
        </div>
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

  /* ================= CONTEXT (ONLY PLACE FOR ORG/FAC/ROLE) ================= */
  const contextItems = [];

  if (has("organization") && entry.organization?.name) {
    contextItems.push(`🏥 ${safe(entry.organization.name)}`);
  }

  if (has("facilities")) {
    const fac = renderFacilities(entry.facilities);
    if (fac !== "—") contextItems.push(`📍 ${fac}`);
  }

  if (has("roles")) {
    const role = renderRoles(entry.roles);
    if (role !== "—") contextItems.push(`🔐 ${role}`);
  }

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map((v) => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  /* ================= QUICK BODY ================= */
  const body = `
    <div class="entity-card-body">
      <div>
        ${
          has("status")
            ? fieldRow("Status", renderValue(entry, "status"))
            : ""
        }
      </div>
    </div>
  `;

  /* ================= DETAILS (NO ORG/FAC/ROLE DUPLICATION) ================= */
  const details = `
    <details class="entity-section">
      <summary><strong>Details</strong></summary>
      <div class="entity-card-body">

        ${
          has("username")
            ? fieldRow("Username", entry.username)
            : ""
        }

        ${
          has("last_login_at")
            ? fieldRow("Last Login", renderValue(entry, "last_login_at"))
            : ""
        }

        ${
          has("locked_until")
            ? fieldRow("Locked Until", renderValue(entry, "locked_until"))
            : ""
        }

      </div>
    </details>
  `;

  /* ================= AUDIT ================= */
  const audit =
    has("created_at") || has("updated_at")
      ? `
        <details class="entity-section">
          <summary><strong>Audit</strong></summary>
          <div class="entity-card-body">

            <div>
              ${
                has("createdByUser")
                  ? fieldRow(
                      "Created By",
                      renderUserRef(entry.createdByUser)
                    )
                  : ""
              }
              ${
                has("created_at")
                  ? fieldRow("Created At", renderValue(entry, "created_at"))
                  : ""
              }
            </div>

            <div>
              ${
                has("updatedByUser")
                  ? fieldRow(
                      "Updated By",
                      renderUserRef(entry.updatedByUser)
                    )
                  : ""
              }
              ${
                has("updated_at")
                  ? fieldRow("Updated At", renderValue(entry, "updated_at"))
                  : ""
              }
            </div>

          </div>
        </details>
      `
      : "";

  /* ================= ACTIONS ================= */
  const actions = has("actions")
    ? `<div class="entity-card-footer export-ignore">
         ${getUserActionButtons(entry, user)}
       </div>`
    : "";

  /* ================= FINAL ================= */
  return `
    <div class="entity-card user-card">
      ${header}
      ${context}
      ${body}
      ${details}
      ${audit}
      ${actions}
    </div>
  `;
}
/* ============================================================
   📋 LIST RENDERER
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("userTableBody");
  const cardContainer = document.getElementById("userList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${visibleFields.length}" class="text-muted text-center">
            No users found.
          </td>
        </tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((field) =>
          field === "actions"
            ? `<td class="actions-cell text-center export-ignore">
                 ${getUserActionButtons(entry, user)}
               </td>`
            : `<td>${renderValue(entry, field)}</td>`
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
      : `<p class="text-muted text-center">No users found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📤 EXPORT HANDLERS
============================================================ */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Users Report";

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
      selector: ".table-container.active, #userList.active",
      orientation: "landscape",
    });
  });
}