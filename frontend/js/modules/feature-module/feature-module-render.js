// 📁 feature-module-render.js – Entity Card System (Enterprise Master)
// ============================================================================
// 🧭 Mirrors patient-render.js architecture
// 🔹 Table = flat | Card = structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize enabled
// ============================================================================

import { FIELD_LABELS_FEATURE_MODULE } from "./feature-module-constants.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { formatDateTime, formatDate, initTooltips } from "../../utils/ui-utils.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE FIELDS (TABLE ONLY)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "name",
  "key",
  "category",
  "visibility",
  "enabled",
  "status",
  "route",
  "created_at",
  "updated_at",
]);

/* ============================================================
   🔃 SORT STATE (UI ONLY – MAIN OWNS BACKEND)
============================================================ */
let sortBy = localStorage.getItem("featureModuleSortBy") || "";
let sortDir = localStorage.getItem("featureModuleSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("featureModuleSortBy", sortBy);
  localStorage.setItem("featureModuleSortDir", sortDir);

  // 🔗 Bridge to MAIN
  window.setFeatureModuleSort?.(sortBy, sortDir);
  window.loadFeatureModulePage?.(1);
}

/* ============================================================
   👤 SAFE USER FORMATTER
============================================================ */
function formatUser(user) {
  if (!user) return "—";
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  return name || "—";
}

/* ============================================================
   🎛️ ACTION BUTTONS (UNCHANGED BEHAVIOR)
============================================================ */
function getFeatureModuleActionButtons(entry, userRole) {
  const role = (userRole || "").toLowerCase();
  const canDelete = role === "admin" || role === "super admin";

  const isActive = (entry.status || "").toLowerCase() === "active";
  const isEnabled = !!entry.enabled;

  return `
    <div class="d-inline-flex gap-1">
      <button class="btn btn-outline-primary btn-sm view-btn"
        data-id="${entry.id}" data-bs-toggle="tooltip" title="View">
        <i class="fas fa-eye"></i>
      </button>

      <button class="btn btn-outline-success btn-sm edit-btn"
        data-id="${entry.id}" data-bs-toggle="tooltip" title="Edit">
        <i class="fas fa-pen"></i>
      </button>

      <button class="btn btn-sm ${
        isActive ? "btn-outline-success" : "btn-outline-warning"
      } toggle-status-btn"
        data-id="${entry.id}" data-bs-toggle="tooltip"
        title="${isActive ? "Deactivate" : "Activate"}">
        <i class="fas ${isActive ? "fa-toggle-on" : "fa-toggle-off"}"></i>
      </button>

      <button class="btn btn-sm ${
        isEnabled ? "btn-outline-success" : "btn-outline-danger"
      } toggle-enabled-btn"
        data-id="${entry.id}" data-bs-toggle="tooltip"
        title="${isEnabled ? "Disable" : "Enable"}">
        <i class="fas fa-power-off"></i>
      </button>

      ${
        canDelete
          ? `<button class="btn btn-outline-danger btn-sm delete-btn"
               data-id="${entry.id}" data-bs-toggle="tooltip" title="Delete">
               <i class="fas fa-trash"></i>
             </button>`
          : ""
      }
    </div>
  `;
}

/* ============================================================
   🧱 DYNAMIC TABLE HEAD (SORTABLE + RESIZE + DRAG)
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  const table = thead?.closest("table");
  if (!thead || !table) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    const label = FIELD_LABELS_FEATURE_MODULE[field] || field;

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

  /* ================= Column drag (UI only) ================= */
  enableColumnDrag({
    table,
    visibleFields,
    onReorder: () => {
      renderDynamicTableHead(visibleFields);
      window.loadFeatureModulePage?.(1);
    },
  });
}

/* ============================================================
   🧩 FIELD VALUE RENDERER
============================================================ */
function renderValue(entry, field) {
  switch (field) {

    /* ================= ROLES (FIX) ================= */
    case "roles": {
      if (!Array.isArray(entry.roles) || entry.roles.length === 0) {
        return "—";
      }

      return entry.roles
        .map(
          (r) =>
            `<span class="badge bg-dark text-white me-1">${r.name}</span>`
        )
        .join("");
    }

    case "status": {
      const raw = (entry.status || "").toLowerCase();
      return `<span class="badge ${
        raw === "active" ? "bg-success" : "bg-warning"
      }">${raw || "—"}</span>`;
    }

    case "enabled":
      return `<span class="badge ${
        entry.enabled ? "bg-success" : "bg-danger"
      }">${entry.enabled ? "Enabled" : "Disabled"}</span>`;

    case "visibility":
      return entry.visibility
        ? `<span class="badge bg-info">${entry.visibility}</span>`
        : "—";

    case "tags":
      return Array.isArray(entry.tags) && entry.tags.length
        ? entry.tags
            .map(
              (t) =>
                `<span class="badge bg-light text-dark me-1">#${t}</span>`
            )
            .join("")
        : "—";

    case "parent_id":
      return entry.parent?.name || "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return formatUser(entry[field]);

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🧩 CARD RENDERER — FEATURE MODULE (MASTER STYLE)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const safe = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");

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
      <div class="d-flex align-items-center gap-2">
        ${entry.icon ? `<i class="${entry.icon} fs-4"></i>` : ""}
        <div>
          <div class="entity-primary">${safe(entry.name)}</div>
          <div class="entity-secondary">${safe(entry.key)}</div>
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

  /* ================= CONTEXT ================= */
  const contextItems = [];

  if (has("category")) contextItems.push(`📂 ${safe(entry.category)}`);
  if (has("tenant_scope")) contextItems.push(`🏢 ${safe(entry.tenant_scope)}`);
  if (has("visibility")) contextItems.push(`👁️ ${safe(entry.visibility)}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map(v => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  /* ================= MAIN BODY ================= */
  const body =
    has("description") || has("route") || has("enabled")
      ? `
        <div class="entity-card-body">
          ${has("description") ? fieldRow("Description", entry.description) : ""}
          ${has("route") ? fieldRow("Route", entry.route) : ""}
          ${has("enabled")
            ? fieldRow("Enabled", entry.enabled ? "Yes" : "No")
            : ""}
        </div>
      `
      : "";

  /* ================= DASHBOARD DETAILS ================= */
  const dashboard =
    has("show_on_dashboard") ||
    has("dashboard_type") ||
    has("dashboard_order")
      ? `
        <div class="entity-card-body">
          ${has("show_on_dashboard")
            ? fieldRow(
                "Dashboard",
                entry.show_on_dashboard ? "Shown" : "Hidden"
              )
            : ""}
          ${has("dashboard_type")
            ? fieldRow(
                "Dashboard Type",
                entry.dashboard_type
                  ? entry.dashboard_type.toUpperCase()
                  : "—"
              )
            : ""}
          ${has("dashboard_order")
            ? fieldRow("Dashboard Order", entry.dashboard_order)
            : ""}
        </div>
      `
      : "";

  /* ================= ORDERING ================= */
  const ordering = has("order_index")
    ? `
      <div class="entity-card-body">
        ${fieldRow("Order Index", entry.order_index)}
      </div>
    `
    : "";

  /* ================= HIERARCHY (FIXED) ================= */
  const hierarchy =
    has("parent_id") || has("children")
      ? `
        <div class="entity-card-body">
          ${has("parent_id")
            ? fieldRow(
                "Parent Module",
                entry.parent?.name || "—"
              )
            : ""}
          ${has("children")
            ? fieldRow(
                "Sub-Modules",
                entry.children?.length || 0
              )
            : ""}
        </div>
      `
      : "";

  /* ================= ROLES ================= */
  const roles =
    has("roles") && Array.isArray(entry.roles) && entry.roles.length
      ? `
        <details class="entity-notes">
          <summary>Roles (${entry.roles.length})</summary>
          <div class="entity-card-body">
            ${entry.roles.map(r => fieldRow("Role", r.name)).join("")}
          </div>
        </details>
      `
      : "";

  /* ================= AUDIT ================= */
  const audit =
    has("created_at") || has("updated_at") || has("updatedBy")
      ? `
        <details class="entity-notes">
          <summary>Audit</summary>
          <div class="entity-card-body">
            ${has("created_at")
              ? fieldRow("Created At", formatDateTime(entry.created_at))
              : ""}
            ${has("updated_at")
              ? fieldRow("Updated At", formatDateTime(entry.updated_at))
              : ""}
            ${has("updatedBy") && entry.updatedBy
              ? fieldRow(
                  "Updated By",
                  `${entry.updatedBy.first_name} ${entry.updatedBy.last_name}`
                )
              : ""}
          </div>
        </details>
      `
      : "";

  /* ================= ACTIONS ================= */
  const actions = has("actions")
    ? `
      <div class="entity-card-footer export-ignore">
        ${getFeatureModuleActionButtons(entry, user)}
      </div>
    `
    : "";

  /* ================= FINAL ================= */
  return `
    <div class="entity-card feature-module-card">
      ${header}
      ${context}
      ${body}
      ${dashboard}
      ${ordering}
      ${hierarchy}
      ${roles}
      ${audit}
      ${actions}
    </div>
  `;
}


/* ============================================================
   📋 LIST RENDERER (TABLE + CARD)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, userRole }) {
  const tableBody = document.getElementById("featureModuleTableBody");
  const cardContainer = document.getElementById("featureModuleList");
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
            No feature modules found.
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
                 ${getFeatureModuleActionButtons(entry, userRole)}
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
      ? entries.map((e) => renderCard(e, visibleFields, userRole)).join("")
      : `<p class="text-muted text-center">No feature modules found.</p>`;

    initTooltips(cardContainer);
  }
}
