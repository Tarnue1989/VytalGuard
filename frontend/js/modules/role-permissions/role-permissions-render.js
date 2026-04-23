// 📁 role-permissions-render.js – FULL MASTER PARITY (PART 1)

import { FIELD_LABELS_ROLE_PERMISSION } from "./role-permissions-constants.js";

import {
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";
import { initTimelines } from "../../utils/timeline/timeline-init.js";
import { exportExcelReport } from "../../utils/exportExcelReport.js";
import { exportCsvReport } from "../../utils/exportCsvReport.js";
import { printReport } from "../../utils/printBuilder.js";
import { authFetch } from "../../authSession.js";
import { formatFilters } from "../../utils/filterFormatter.js";

/* ============================================================
   🔃 SORTABLE FIELDS
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "role",
  "permission",
  "status",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("rolePermissionSortBy") || "";
let sortDir = localStorage.getItem("rolePermissionSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("rolePermissionSortBy", sortBy);
  localStorage.setItem("rolePermissionSortDir", sortDir);

  window.setRolePermissionSort?.(sortBy, sortDir);
  window.loadRolePermissionPage?.(1);
}

/* ============================================================
   🧍 USER FORMAT
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  return [user.first_name, user.middle_name, user.last_name]
    .filter(Boolean)
    .join(" ") || "—";
}

/* ============================================================
   🧩 VALUE RENDERER
============================================================ */
function renderValue(entry, field) {
  switch (field) {

    case "status": {
      const raw = (entry.status || "").toLowerCase();
      let cls = "bg-secondary";
      if (raw === "active") cls = "bg-success";
      if (raw === "inactive") cls = "bg-warning text-dark";
      if (raw === "deleted") cls = "bg-danger";

      return `<span class="badge ${cls}">
        ${raw.toUpperCase()}
      </span>`;
    }

    case "organization":
    case "organization_id":
      return entry.organization?.name || "—";

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "role":
      return entry.role?.name || "—";

    case "permission":
      return entry.permission?.key
        ? `<code>${entry.permission.key}</code>`
        : "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🎛️ ACTION BUTTONS (MASTER)
============================================================ */
function getRolePermissionActionButtons(entry, user) {
  return buildActionButtons({
    module: "role_permission", // ✅ MATCH UI MODULE KEY (SINGULAR)
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "role_permissions", // ✅ DB PERMISSIONS (PLURAL)
  });
}

/* ============================================================
   🧱 TABLE HEAD
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
      FIELD_LABELS_ROLE_PERMISSION[field] || field.replace(/_/g, " ");

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
    onReorder: () => {
      renderDynamicTableHead(visibleFields);
      window.loadRolePermissionPage?.(1);
    },
  });
}
/* ============================================================
   🪪 CARD RENDER (FULL MASTER PARITY)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const safe = (v) =>
    v !== null && v !== undefined && v !== "" ? v : "—";

  const fieldRow = (label, value) => `
    <div class="entity-field">
      <span class="entity-label">${label}</span>
      <span class="entity-value">${safe(value)}</span>
    </div>
  `;

  const status = (entry.status || "").toLowerCase();

  const header = `
    <div class="entity-card-header">
      <div>
        <div class="entity-primary">${safe(entry.role?.name)}</div>
        <div class="entity-secondary">${safe(entry.permission?.key)}</div>
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

  /* ================= TIMELINE ================= */
  const timeline = `
    <div
      class="card-timeline"
      data-module="role_permissions"
      data-status="${status}">
    </div>
  `;

  /* ================= CONTEXT ================= */
  const contextItems = [];
  if (has("organization"))
    contextItems.push(`🏥 ${safe(entry.organization?.name)}`);
  if (has("facility"))
    contextItems.push(`📍 ${safe(entry.facility?.name)}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map((v) => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  /* ================= BODY ================= */
  const body = `
    <div class="entity-card-body">
      <div>
        ${has("role") ? fieldRow("Role", entry.role?.name) : ""}
      </div>
      <div>
        ${has("permission") ? fieldRow("Permission", entry.permission?.key) : ""}
      </div>
    </div>
  `;

  /* ================= AUDIT ================= */
  const audit =
    has("created_at") || has("updated_at") || has("deleted_at")
      ? `
        <details class="entity-notes">
          <summary>Audit</summary>
          <div class="entity-card-body">
            <div>
              ${has("createdBy") ? fieldRow("Created By", renderUserName(entry.createdBy)) : ""}
              ${has("created_at") ? fieldRow("Created At", formatDateTime(entry.created_at)) : ""}
            </div>
            <div>
              ${has("updatedBy") ? fieldRow("Updated By", renderUserName(entry.updatedBy)) : ""}
              ${has("updated_at") ? fieldRow("Updated At", formatDateTime(entry.updated_at)) : ""}
              ${has("deletedBy") && entry.deletedBy ? fieldRow("Deleted By", renderUserName(entry.deletedBy)) : ""}
              ${has("deleted_at") && entry.deleted_at ? fieldRow("Deleted At", formatDateTime(entry.deleted_at)) : ""}
            </div>
          </div>
        </details>
      `
      : "";

  /* ================= ACTIONS ================= */
  const actions = has("actions")
    ? `<div class="entity-card-footer export-ignore">
         ${getRolePermissionActionButtons(entry, user)}
       </div>`
    : "";

  return `
    <div class="entity-card role-permission-card">
      ${header}
      ${context}
      ${timeline}
      ${body}
      ${audit}
      ${actions}
    </div>
  `;
}

/* ============================================================
   📋 LIST RENDER (WITH TIMELINE)
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

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${visibleFields.length}" class="text-muted text-center">
            No role permissions found.
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
                 ${getRolePermissionActionButtons(entry, user)}
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

    const fragment = document.createDocumentFragment();

    if (!entries.length) {
      cardContainer.innerHTML = `<p class="text-muted text-center">No role permissions found.</p>`;
      return;
    }

    entries.forEach((entry) => {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = renderCard(entry, visibleFields, user);

      const card = wrapper.firstElementChild;
      const timelineEl = card.querySelector(".card-timeline");

      if (timelineEl) {
        timelineEl.__entry = entry;
      }

      fragment.appendChild(card);
    });

    cardContainer.appendChild(fragment);

    /* 🔥 INIT TIMELINE */
    initTimelines(cardContainer);

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 EXPORT HANDLERS (FULL PARITY)
============================================================ */
function setupExportHandlers(entries, visibleFields) {
  const title = "Role Permissions Report";

  const pdfBtn = document.getElementById("exportPDFBtn");
  const csvBtn = document.getElementById("exportCSVBtn");
  const excelBtn = document.getElementById("exportExcelBtn");

  if (!pdfBtn || !csvBtn || !excelBtn) return;

  pdfBtn.replaceWith(pdfBtn.cloneNode(true));
  csvBtn.replaceWith(csvBtn.cloneNode(true));
  excelBtn.replaceWith(excelBtn.cloneNode(true));

  const newPdfBtn = document.getElementById("exportPDFBtn");
  const newCsvBtn = document.getElementById("exportCSVBtn");
  const newExcelBtn = document.getElementById("exportExcelBtn");

  function getFiltersFromDOM() {
    const val = (id) => document.getElementById(id)?.value;

    return {
      search: val("globalSearch")?.trim(),
      organization_id: val("filterOrganizationSelect"),
      facility_id: val("filterFacilitySelect"),
      role_id: val("filterRoleSelect"),
      permission_id: val("filterPermissionSelect"),
      status: val("filterStatusSelect"),
      dateRange: val("dateRange"),
    };
  }

  const mapRow = (e, fields) => {
    const row = {};

    fields.forEach((f) => {
      switch (f) {
        case "organization":
        case "organization_id":
          row[f] = e.organization?.name || "";
          break;

        case "facility":
        case "facility_id":
          row[f] = e.facility?.name || "";
          break;

        case "role":
          row[f] = e.role?.name || "";
          break;

        case "permission":
          row[f] = e.permission?.key || "";
          break;

        case "status":
          row[f] = (e.status || "").toUpperCase();
          break;

        case "created_at":
        case "updated_at":
          row[f] = e[f] ? new Date(e[f]).toLocaleDateString() : "";
          break;

        default:
          row[f] =
            typeof e[f] === "object"
              ? ""
              : String(e[f] ?? "");
      }
    });

    return row;
  };

  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,
      data: entries,
      visibleFields,
      fieldLabels: FIELD_LABELS_ROLE_PERMISSION,
      mapRow,
    });
  });

  newExcelBtn.addEventListener("click", () => {
    exportExcelReport({
      endpoint: "/api/role-permissions",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_ROLE_PERMISSION,
      mapRow,
    });
  });

  newPdfBtn.addEventListener("click", async () => {
    try {
      const filters = getFiltersFromDOM();

      const params = new URLSearchParams();
      params.set("limit", 10000);
      params.set("page", 1);

      Object.entries(filters).forEach(([k, v]) => {
        if (!v || String(v).trim() === "" || v === "null") return;

        if (k === "dateRange") {
          const [from, to] = v.split(" - ");
          if (from) params.set("date_from", from.trim());
          if (to) params.set("date_to", to.trim());
        } else {
          params.set(k, v);
        }
      });

      const res = await authFetch(`/api/role-permissions?${params.toString()}`);
      const json = await res.json();
      const allEntries = json?.data?.records || [];

      const cleanFields = visibleFields.filter(
        (f) =>
          f !== "actions" &&
          !["deletedBy", "deleted_at"].includes(f)
      );

      printReport({
        title,
        columns: cleanFields.map((f) => ({
          key: f,
          label: FIELD_LABELS_ROLE_PERMISSION[f] || f,
        })),
        rows: allEntries.map((e) => mapRow(e, cleanFields)),
        meta: {
          Organization: allEntries[0]?.organization?.name || "",
          Facility: allEntries[0]?.facility?.name || "",
          Records: allEntries.length,
        },
        context: {
          filters: formatFilters(filters, {
            sample: allEntries[0],
          }),
          printedBy: "System",
          printedAt: new Date().toLocaleString(),
        },
      });

    } catch (err) {
      console.error(err);
      alert("❌ Failed to export full report");
    }
  });
}