// 📁 permissions-render.js – Permission table & card renderers

import { FIELD_LABELS_PERMISSION } from "./permissions-constants.js";
import { formatDate } from "../../utils/ui-utils.js";


import { exportExcelReport } from "../../utils/exportExcelReport.js";
import { exportCsvReport } from "../../utils/exportCsvReport.js";
import { printReport } from "../../utils/printBuilder.js";
import { authFetch } from "../../authSession.js";
import { formatFilters } from "../../utils/filterFormatter.js";

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
function getPermissionActionButtons(entry, user) {
  const userPerms = new Set(user?.permissions || []);
  const canView = userPerms.has("permissions:view");
  const canEdit = userPerms.has("permissions:edit");
  const canDelete = userPerms.has("permissions:delete");

  const buttons = [];

  if (canView)
    buttons.push(`
      <button class="btn btn-outline-primary btn-sm view-btn" data-id="${entry.id}"
        data-bs-toggle="tooltip" data-bs-title="View permission">
        <i class="fas fa-eye"></i>
      </button>`);

  if (canEdit)
    buttons.push(`
      <button class="btn btn-outline-success btn-sm edit-btn" data-id="${entry.id}"
        data-bs-toggle="tooltip" data-bs-title="Edit permission">
        <i class="fas fa-pen"></i>
      </button>`);

  if (canDelete)
    buttons.push(`
      <button class="btn btn-outline-danger btn-sm delete-btn" data-id="${entry.id}"
        data-bs-toggle="tooltip" data-bs-title="Delete permission">
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
    th.textContent = FIELD_LABELS_PERMISSION[field] || field.replace(/_/g, " ");
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

    case "is_global":
      return entry.is_global
        ? `<span class="badge bg-success">Yes</span>`
        : `<span class="badge bg-secondary">No</span>`;

    case "roles":
      if (!entry.roles || !entry.roles.length) return "—";
      return entry.roles
        .map((r) => `<span class="badge bg-primary text-white">${r.name}</span>`)
        .join(" ");

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
    const label = FIELD_LABELS_PERMISSION[field] || field.replace(/_/g, " ");
    const value = renderValue(entry, field);
    html += `<p class="mb-1"><strong>${label}:</strong> ${value}</p>`;
  });

  // 🔹 Optional footer with action buttons
  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getPermissionActionButtons(entry, user)}
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
  const tableBody = document.getElementById("permissionTableBody");
  const cardContainer = document.getElementById("permissionList");
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
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No permissions found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      let rowHTML = "";
      visibleFields.forEach((field) => {
        const value =
          field === "actions"
            ? `<div class="table-actions export-ignore">${getPermissionActionButtons(entry, user)}</div>`
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
      : `<p class="text-muted text-center">No permissions found.</p>`;

    initTooltips(cardContainer);
  }
  setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 EXPORT (MASTER – EXACT DEPOSIT PATTERN)
============================================================ */
function setupExportHandlers(entries, visibleFields) {
  const title = "Permissions Report";

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
      organization_id: val("filterOrganizationSelect"),
      facility_id: val("filterFacilitySelect"),
      key: val("filterKey"),
      module: val("filterModule"),
      category: val("filterCategory"),
      is_global: val("filterIsGlobal"),
      created_from: val("filterCreatedFrom"),
      created_to: val("filterCreatedTo"),
    };
  }

  /* ================= CSV ================= */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,
      data: entries,
      visibleFields,
      fieldLabels: FIELD_LABELS_PERMISSION,

      mapRow: (e, fields) => {
        const row = {};

        fields.forEach((f) => {
          switch (f) {
            case "organization":
              row[f] = e.organization?.name || "";
              break;

            case "facility":
              row[f] = e.facility?.name || "";
              break;

            case "is_global":
              row[f] = e.is_global ? "Yes" : "No";
              break;

            case "roles":
              row[f] = e.roles?.map((r) => r.name).join(", ") || "";
              break;

            case "created_at":
            case "updated_at":
              row[f] = e[f]
                ? new Date(e[f]).toLocaleDateString()
                : "";
              break;

            default:
              row[f] =
                typeof e[f] === "object"
                  ? ""
                  : String(e[f] ?? "");
          }
        });

        return row;
      },
    });
  });

  /* ================= EXCEL ================= */
  newExcelBtn.addEventListener("click", () => {
    exportExcelReport({
      endpoint: "/api/permissions",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_PERMISSION,

      mapRow: (e, fields) => {
        const row = {};

        fields.forEach((f) => {
          switch (f) {
            case "organization":
              row[f] = e.organization?.name || "";
              break;

            case "facility":
              row[f] = e.facility?.name || "";
              break;

            case "is_global":
              row[f] = e.is_global ? "Yes" : "No";
              break;

            case "roles":
              row[f] = e.roles?.map((r) => r.name).join(", ") || "";
              break;

            case "created_at":
            case "updated_at":
              row[f] = e[f]
                ? new Date(e[f]).toLocaleDateString()
                : "";
              break;

            default:
              row[f] =
                typeof e[f] === "object"
                  ? ""
                  : String(e[f] ?? "");
          }
        });

        return row;
      },

      computeTotals: (records) => ({
        "Total Records": records.length,
      }),
    });
  });

  /* ================= PDF ================= */
  newPdfBtn.addEventListener("click", async () => {
    try {
      const filters = getFiltersFromDOM();

      const params = new URLSearchParams();
      params.set("limit", 10000);
      params.set("page", 1);

      Object.entries(filters).forEach(([k, v]) => {
        if (!v || String(v).trim() === "" || v === "null") return;
        params.set(k, v);
      });

      const res = await authFetch(
        `/api/permissions?${params.toString()}`
      );
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
          label: FIELD_LABELS_PERMISSION[f] || f,
        })),

        rows: allEntries.map((e) => {
          const row = {};

          cleanFields.forEach((f) => {
            switch (f) {
              case "organization":
                row[f] = e.organization?.name || "";
                break;

              case "facility":
                row[f] = e.facility?.name || "";
                break;

              case "is_global":
                row[f] = e.is_global ? "Yes" : "No";
                break;

              case "roles":
                row[f] = e.roles?.map((r) => r.name).join(", ") || "";
                break;

              case "created_at":
              case "updated_at":
                row[f] = e[f]
                  ? new Date(e[f]).toLocaleDateString()
                  : "";
                break;

              default:
                row[f] =
                  typeof e[f] === "object"
                    ? ""
                    : String(e[f] ?? "");
            }
          });

          return row;
        }),

        meta: {
          Records: allEntries.length,
        },

        totals: [
          {
            label: "Total Records",
            value: allEntries.length,
            final: true,
          },
        ],

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
      alert("❌ Failed to export report");
    }
  });
}