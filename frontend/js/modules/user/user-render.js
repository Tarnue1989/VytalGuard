// 📁 user-render.js – User Table & Card Renderers (ENTERPRISE MASTER UPGRADED)
// ============================================================================
// 🔹 Card upgraded to ENTITY SYSTEM (same as payment / deposit / refund)
// 🔹 Full audit section (DATE + TIME)
// 🔹 Field-selector safe
// 🔹 No duplication (org handled once)
// 🔹 Action matrix preserved
// 🔹 MASTER parity applied
// ============================================================================

import { FIELD_LABELS_USER } from "./user-constants.js";
import { formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";

/* ============================================================
   🎛️ Action Buttons
============================================================ */
function getUserActionButtons(entry, user) {
  return buildActionButtons({
    module: "user",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "users",
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
    th.textContent = FIELD_LABELS_USER[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================
   🔠 HELPERS
============================================================ */
const safe = (v) =>
  v !== null && v !== undefined && v !== "" ? v : "—";

function renderUserRef(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.username || user.email || "—";
}

/* ============================================================
   🧩 VALUE RENDERER
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const colorMap = {
        active: "bg-success",
        inactive: "bg-warning text-dark",
        locked: "bg-danger",
        deleted: "bg-secondary",
      };

      return raw
        ? `<span class="badge ${colorMap[raw] || "bg-secondary"}">${label}</span>`
        : "—";
    }

    case "full_name":
      return (
        [entry.first_name, entry.last_name].filter(Boolean).join(" ") || "—"
      );

    case "organization":
      return entry.organization?.name || "—";

    case "facilities":
      return Array.isArray(entry.facilities) && entry.facilities.length
        ? entry.facilities.map((f) => f.name || f.code || f.id).join(", ")
        : "—";

    case "roles":
      return Array.isArray(entry.roles) && entry.roles.length
        ? entry.roles.map((r) => r.name || r.id).join(", ")
        : "—";

    case "createdByUser":
      return renderUserRef(entry.createdByUser);
    case "updatedByUser":
      return renderUserRef(entry.updatedByUser);
    case "deletedByUser":
      return renderUserRef(entry.deletedByUser);

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
   🗂️ CARD RENDERER — ENTERPRISE
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const row = (label, value) => {
    if (value === undefined || value === null || value === "") return "";
    return `
      <div class="entity-field">
        <span class="entity-label">${label}</span>
        <span class="entity-value">${safe(value)}</span>
      </div>
    `;
  };

  const AUDIT_FIELDS = [
    "createdByUser","updatedByUser","deletedByUser",
    "created_at","updated_at","deleted_at","last_login_at","locked_until"
  ];

  return `
    <div class="entity-card user-card">

      <!-- 🔹 HEADER -->
      <div class="entity-card-header">
        <div>
          <div class="entity-primary">${renderValue(entry, "full_name")}</div>
          <div class="entity-secondary">${safe(entry.email)}</div>
        </div>
        ${
          has("status")
            ? `<span class="entity-status ${status}">${status.toUpperCase()}</span>`
            : ""
        }
      </div>

      <!-- 🔹 QUICK CORE -->
      <div class="entity-card-body">
        ${row("Username", entry.username)}
        ${row("Roles", renderValue(entry, "roles"))}
        ${row("Organization", entry.organization?.name)}
        ${row("Status", status.toUpperCase())}
      </div>

      <!-- 📄 DETAILS -->
      <details class="entity-section">
        <summary><strong>Details</strong></summary>
        <div class="entity-card-body">

          ${row("Facilities", renderValue(entry, "facilities"))}

          ${visibleFields
            .filter(
              (f) =>
                ![
                  "actions",
                  "username",
                  "roles",
                  "organization",
                  "status",
                  "facilities",
                  ...AUDIT_FIELDS,
                ].includes(f)
            )
            .map((f) =>
              row(
                FIELD_LABELS_USER[f] || f,
                renderValue(entry, f)
              )
            )
            .join("")}

        </div>
      </details>

      <!-- 🔍 AUDIT -->
      <details class="entity-section">
        <summary><strong>Audit</strong></summary>
        <div class="entity-card-body">
          ${row("Created By", renderValue(entry, "createdByUser"))}
          ${row("Created At", formatDateTime(entry.created_at))}
          ${row("Updated By", renderValue(entry, "updatedByUser"))}
          ${row("Updated At", formatDateTime(entry.updated_at))}
          ${row("Deleted By", renderValue(entry, "deletedByUser"))}
          ${row("Deleted At", formatDateTime(entry.deleted_at))}
          ${row("Last Login", formatDateTime(entry.last_login_at))}
          ${row("Locked Until", formatDateTime(entry.locked_until))}
        </div>
      </details>

      <!-- ⚙️ ACTIONS -->
      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getUserActionButtons(entry, user)}
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
          <td colspan="${visibleFields.length}"
              class="text-center text-muted py-3">
            No users found.
          </td>
        </tr>`;
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) => {
          const val =
            f === "actions"
              ? `<div class="table-actions export-ignore">
                   ${getUserActionButtons(entry, user)}
                 </div>`
              : renderValue(entry, f);

          const cls =
            f === "actions" ? ' class="text-center actions-cell"' : "";

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
      : `<p class="text-muted text-center py-3">No users found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📤 EXPORT
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
      selector: ".table-container",
      orientation: "landscape",
    });
  });
}

/* ============================================================
   🪟 MODAL
============================================================ */
export function showUserModal(title, bodyHtml) {
  let modalEl = document.getElementById("userActionModal");
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "userActionModal";
    modalEl.className = "modal fade";
    modalEl.tabIndex = -1;
    modalEl.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"></h5>
            <button type="button" class="btn-close"
              data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary"
              data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modalEl);
  }

  modalEl.querySelector(".modal-title").innerHTML = title;
  modalEl.querySelector(".modal-body").innerHTML = bodyHtml;

  new bootstrap.Modal(modalEl).show();
}