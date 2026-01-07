// 📁 role-permissions-render.js – RolePermission table & card renderers

import { FIELD_LABELS_ROLE_PERMISSION } from "./role-permissions-constants.js";
import { formatDate } from "../../utils/ui-utils.js";

/* ============================================================
   🧩 Helper Utilities
   ============================================================ */

// ▶️ Bootstrap tooltips initializer
function initTooltips(scope = document) {
  if (!window.bootstrap) return;
  const triggers = scope.querySelectorAll("[data-bs-toggle='tooltip']");
  triggers.forEach((el) => {
    if (!bootstrap.Tooltip.getInstance(el)) {
      new bootstrap.Tooltip(el);
    }
  });
}

// 🧍 Format user full name safely
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : (user.username || "—");
}

/* ============================================================
   🛠️ Action Buttons
   ============================================================ */
function getRolePermissionActionButtons(entry, user) {
  const userPerms = new Set(user?.permissions || []);
  const canView = userPerms.has("role_permissions:view");
  const canEdit = userPerms.has("role_permissions:edit");
  const canDelete = userPerms.has("role_permissions:delete");

  const buttons = [];

  if (canView)
    buttons.push(`
      <button class="btn btn-outline-primary btn-sm view-btn" data-id="${entry.id}"
        data-bs-toggle="tooltip" data-bs-title="View role permission">
        <i class="fas fa-eye"></i>
      </button>`);

  if (canEdit)
    buttons.push(`
      <button class="btn btn-outline-success btn-sm edit-btn" data-id="${entry.id}"
        data-bs-toggle="tooltip" data-bs-title="Edit role permission">
        <i class="fas fa-pen"></i>
      </button>`);

  if (canDelete)
    buttons.push(`
      <button class="btn btn-outline-danger btn-sm delete-btn" data-id="${entry.id}"
        data-bs-toggle="tooltip" data-bs-title="Delete role permission">
        <i class="fas fa-trash"></i>
      </button>`);

  return buttons.length
    ? `<div class="d-inline-flex gap-1">${buttons.join("")}</div>`
    : "";
}

/* ============================================================
   📋 Dynamic Table Head Renderer
   ============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = FIELD_LABELS_ROLE_PERMISSION[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================
   🔡 Value Renderer
   ============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    case "role":
      return entry.role?.name || "—";

    case "permission":
      return entry.permission?.key
        ? `<code>${entry.permission.key}</code> <small class="text-muted">(${entry.permission.module || "—"})</small>`
        : "—";

    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    case "created_at":
      return entry.created_at ? formatDate(entry.created_at) : "—";
    case "updated_at":
      return entry.updated_at ? formatDate(entry.updated_at) : "—";
    case "deleted_at":
      return entry.deleted_at ? formatDate(entry.deleted_at) : "—";

    default:
      return entry[field] != null && entry[field] !== ""
        ? String(entry[field])
        : "—";
  }
}

/* ============================================================
   🪪 Card Renderer
   ============================================================ */
export function renderCard(entry, visibleFields, user) {
  let html = "";

  visibleFields.forEach((field) => {
    if (field === "actions") return; // handled separately
    const label = FIELD_LABELS_ROLE_PERMISSION[field] || field.replace(/_/g, " ");
    const value = renderValue(entry, field);
    html += `<p class="mb-1"><strong>${label}:</strong> ${value}</p>`;
  });

  // 🔹 Optional footer with action buttons
  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getRolePermissionActionButtons(entry, user)}
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
   📦 Main List Renderer
   ============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("rolePermissionTableBody");
  const cardContainer = document.getElementById("rolePermissionList");
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
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No role permissions found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      let rowHTML = "";
      visibleFields.forEach((field) => {
        const value =
          field === "actions"
            ? `<div class="table-actions export-ignore">${getRolePermissionActionButtons(entry, user)}</div>`
            : renderValue(entry, field);

        const tdClass =
          field === "actions" ? ' class="actions-cell text-center"' : "";
        rowHTML += `<td${tdClass}>${value}</td>`;
      });
      row.innerHTML = rowHTML;
      tableBody.appendChild(row);
    });

    initTooltips(tableBody);
  } else {
    // 🧩 Card View
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.remove("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center">No role permissions found.</p>`;

    initTooltips(cardContainer);
  }
}
