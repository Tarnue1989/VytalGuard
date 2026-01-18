// 📁 feature-access-render.js – Entity Card System (Enterprise Master)
// ============================================================================
// 🧭 Mirrors feature-module-render.js EXACTLY in capability
// 🔹 Table = flat | Card = structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize enabled
// 🔹 Column drag reorder enabled
// ============================================================================

import { FIELD_LABELS_FEATURE_ACCESS } from "./feature-access-constants.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import {
  formatDate,
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE FIELDS (TABLE ONLY)
   (keep ID-based fields for backend parity)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "module_id",
  "role_id",
  "facility_id",
  "status",
  "created_at",
  "updated_at",
]);

/* ============================================================
   🔃 SORT STATE (UI ONLY – MAIN OWNS BACKEND)
============================================================ */
let sortBy = localStorage.getItem("featureAccessSortBy") || "";
let sortDir = localStorage.getItem("featureAccessSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("featureAccessSortBy", sortBy);
  localStorage.setItem("featureAccessSortDir", sortDir);

  // 🔗 Bridge to MAIN
  window.setFeatureAccessSort?.(sortBy, sortDir);
  window.loadFeatureAccessPage?.(1);
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
   🎛️ ACTION BUTTONS (PARITY)
============================================================ */
function getFeatureAccessActionButtons(entry, userRole) {
  const role = (userRole || "").toLowerCase();
  const canDelete = role.includes("admin");
  const isActive = (entry.status || "").toLowerCase() === "active";

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
    const label = FIELD_LABELS_FEATURE_ACCESS[field] || field;

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
      window.loadFeatureAccessPage?.(1);
    },
  });
}

/* ============================================================
   🧩 FIELD VALUE RENDERER (FIXED)
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    /* ---------- STATUS ---------- */
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      return `<span class="badge ${
        raw === "active" ? "bg-success" : "bg-warning"
      }">${raw || "—"}</span>`;
    }

    /* ---------- SEMANTIC FIELDS (FIX) ---------- */
    case "organization":
      return entry.organization?.name || "—";

    case "module":
      return entry.module?.name || "—";

    case "role":
      return entry.role?.name || "—";

    case "facility":
      return entry.facility
        ? entry.facility.name
        : `<span class="badge bg-info">Org-wide</span>`;

    /* ---------- ID FIELDS (BACKWARD SAFE) ---------- */
    case "organization_id":
      return entry.organization?.name || "—";

    case "module_id":
      return entry.module?.name || "—";

    case "role_id":
      return entry.role?.name || "—";

    case "facility_id":
      return entry.facility
        ? entry.facility.name
        : `<span class="badge bg-info">Org-wide</span>`;

    /* ---------- AUDIT ---------- */
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
   🧩 CARD RENDERER — FEATURE ACCESS (AUDIT-ONLY DATES)
============================================================ */
export function renderCard(entry, visibleFields, userRole) {
  const has = (f) => visibleFields.includes(f);

  const safe = (v) =>
    v !== null && v !== undefined && v !== "" ? v : "—";

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
        <div class="entity-primary">
          ${safe(entry.module?.name)}
        </div>
        <div class="entity-secondary">
          ${safe(entry.role?.name)}
        </div>
      </div>
      ${
        has("status")
          ? `<span class="entity-status ${(entry.status || "").toLowerCase()}">
               ${(entry.status || "").toUpperCase()}
             </span>`
          : ""
      }
    </div>
  `;

  /* ================= CONTEXT ================= */
  const contextItems = [];

  if (has("organization") || has("organization_id")) {
    contextItems.push(`🏥 ${safe(entry.organization?.name)}`);
  }

  if (has("facility") || has("facility_id")) {
    contextItems.push(
      entry.facility
        ? `📍 ${safe(entry.facility.name)}`
        : `📍 Organization-wide`
    );
  }

  const context = contextItems.length
    ? `
      <div class="entity-card-context">
        ${contextItems.map(v => `<div>${v}</div>`).join("")}
      </div>
    `
    : "";

  /* ================= AUDIT (ONLY PLACE FOR DATES) ================= */
  const audit =
    has("created_at") ||
    has("updated_at") ||
    has("createdBy") ||
    has("updatedBy") ||
    has("deletedBy") ||
    has("deleted_at")
      ? `
        <details class="entity-notes">
          <summary>Audit</summary>
          <div class="entity-card-body">
            ${has("createdBy")
              ? fieldRow("Created By", formatUser(entry.createdBy))
              : ""}
            ${has("created_at")
              ? fieldRow("Created At", formatDateTime(entry.created_at))
              : ""}
            ${has("updatedBy")
              ? fieldRow("Updated By", formatUser(entry.updatedBy))
              : ""}
            ${has("updated_at")
              ? fieldRow("Updated At", formatDateTime(entry.updated_at))
              : ""}
            ${has("deletedBy") && entry.deletedBy
              ? fieldRow("Deleted By", formatUser(entry.deletedBy))
              : ""}
            ${has("deleted_at")
              ? fieldRow("Deleted At", formatDateTime(entry.deleted_at))
              : ""}
          </div>
        </details>
      `
      : "";

  /* ================= MORE DETAILS (HUMAN READABLE) ================= */
  const moreDetails =
    has("module") ||
    has("role") ||
    has("organization") ||
    has("facility")
      ? `
        <details class="entity-notes">
          <summary>More Details</summary>
          <div class="entity-card-body">
            ${fieldRow("Module", entry.module?.name)}
            ${fieldRow("Module Key", entry.module?.key)}
            ${fieldRow("Role", entry.role?.name)}
            ${fieldRow("Organization", entry.organization?.name)}
            ${
              entry.facility
                ? fieldRow("Facility", entry.facility.name)
                : fieldRow("Facility", "Organization-wide")
            }
          </div>
        </details>
      `
      : "";

  /* ================= ACTIONS ================= */
  const actions = has("actions")
    ? `
      <div class="entity-card-footer export-ignore">
        ${getFeatureAccessActionButtons(entry, userRole)}
      </div>
    `
    : "";

  /* ================= FINAL ================= */
  return `
    <div class="entity-card feature-access-card">
      ${header}
      ${context}
      ${audit}
      ${moreDetails}
      ${actions}
    </div>
  `;
}


/* ============================================================
   📋 LIST RENDERER (TABLE + CARD)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const userRole = user?.role;
  const tableBody = document.getElementById("featureAccessTableBody");
  const cardContainer = document.getElementById("featureAccessList");
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
            No feature access records found.
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
                 ${getFeatureAccessActionButtons(entry, userRole)}
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
      : `<p class="text-muted text-center">No feature access records found.</p>`;

    initTooltips(cardContainer);
  }
}
