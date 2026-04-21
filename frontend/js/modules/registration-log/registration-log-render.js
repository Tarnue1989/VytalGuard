// 📁 registrationLog-render.js – Entity Card System (REGISTRATION LOG | ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH department-render.js
// 🔹 Table = flat | Card = structured (entity-card system)
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize enabled
// 🔹 Column drag reorder enabled
// 🔹 Full audit section (created / updated / deleted)
// 🔹 Permission-driven actions (superadmin-aware)
// 🔹 Export-safe
// ============================================================================

import { FIELD_LABELS_REGISTRATION_LOG } from "./registration-log-constants.js";

import {
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";
import { initTimelines } from "../../utils/timeline/timeline-init.js";

import { exportExcelReport } from "../../utils/exportExcelReport.js";
import { exportCsvReport } from "../../utils/exportCsvReport.js";
import { printReport } from "../../utils/printBuilder.js";
import { authFetch } from "../../authSession.js";
import { formatFilters } from "../../utils/filterFormatter.js";

/* ============================================================ */
const SORTABLE_FIELDS = new Set([
  "registration_time",
  "log_status",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("registrationLogSortBy") || "";
let sortDir = localStorage.getItem("registrationLogSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("registrationLogSortBy", sortBy);
  localStorage.setItem("registrationLogSortDir", sortDir);

  window.setRegistrationLogSort?.(sortBy, sortDir);
  window.loadRegistrationLogPage?.(1);
}

/* ============================================================ */
function getRegistrationLogActionButtons(entry, user) {
  return buildActionButtons({
    module: "registration_log",
    status: (entry.log_status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "registration_logs",
  });
}

/* ============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  const table = thead?.closest("table");
  if (!thead || !table) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    const label =
      FIELD_LABELS_REGISTRATION_LOG[field] || field.replace(/_/g, " ");

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
        icon = sortDir === "asc"
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
      window.loadRegistrationLogPage?.(1);
    },
  });
}

/* ============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.full_name || "—";
}

/* ============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "log_status": {
      const raw = (entry.log_status || "").toLowerCase();
      let cls = "bg-secondary";
      if (raw === "active") cls = "bg-success";
      if (raw === "pending") cls = "bg-info";
      if (raw === "completed") cls = "bg-primary";
      if (raw === "cancelled") cls = "bg-warning text-dark";
      if (raw === "voided") cls = "bg-danger";

      return `<span class="badge ${cls}">
        ${raw ? raw.toUpperCase() : "—"}
      </span>`;
    }

    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    /* ✅ PATIENT FIX */
    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no || "—"} - ${entry.patient.first_name || ""} ${entry.patient.last_name || ""}`
        : "—";

    /* ✅ INSURANCE FIX */
    case "patientInsurance":
      if (entry.payer_type === "insurance" && !entry.patientInsurance) {
        return `<span class="text-danger">⚠ Missing Insurance</span>`;
      }
      return entry.patientInsurance
        ? `${entry.patientInsurance.policy_number} - ${entry.patientInsurance.plan_name || ""} (${entry.patientInsurance.provider?.name || ""})`
        : "—";

    case "registrar":
      return renderUserName(entry.registrar);

    case "registration_type":
      return entry.registrationType?.name || "—";

    /* ✅ INVOICE FIX */
    case "invoice":
      return entry.invoice
        ? `${entry.invoice.invoice_number} - ${entry.invoice.total || 0} ${entry.invoice.currency || ""} (${entry.invoice.status})`
        : "—";

    /* ✅ PAYER TYPE FIX */
    case "payer_type":
      return entry.payer_type
        ? entry.payer_type.replace("_", " ").toUpperCase()
        : "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "registration_time":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    case "is_emergency":
      return entry.is_emergency
        ? `<span class="badge bg-danger">YES</span>`
        : `<span class="badge bg-secondary">NO</span>`;

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================ */
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

  const status = (entry.log_status || "").toLowerCase();

  const timeline = `
    <div
      class="card-timeline"
      data-module="registration_log"
      data-status="${status}">
    </div>
  `;

  const header = `
    <div class="entity-card-header">
      <div>
        <div class="entity-secondary">
          ${safe(entry.registration_method)}
        </div>
        <div class="entity-primary">
          ${
            entry.patient
              ? `${safe(entry.patient.pat_no)} - ${safe(entry.patient.first_name)} ${safe(entry.patient.last_name)}`
              : "—"
          }
        </div>
      </div>
      ${
        has("log_status")
          ? `<span class="entity-status ${status}">
               ${status.toUpperCase()}
             </span>`
          : ""
      }
    </div>
  `;

  const contextItems = [];

  if (has("organization"))
    contextItems.push(`🏥 ${safe(entry.organization?.name)}`);

  if (has("facility"))
    contextItems.push(`📍 ${safe(entry.facility?.name)}`);

  if (has("registrar"))
    contextItems.push(`👤 ${safe(renderUserName(entry.registrar))}`);

  if (has("registration_time"))
    contextItems.push(`🕒 ${formatDateTime(entry.registration_time)}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map((v) => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  const body = `
    <div class="entity-card-body">
      <div>
        ${has("patient_category")
          ? fieldRow("Patient Category", entry.patient_category)
          : ""}
        ${has("visit_reason")
          ? fieldRow("Visit Reason", entry.visit_reason)
          : ""}
        ${has("registration_source")
          ? fieldRow("Registration Source", entry.registration_source)
          : ""}
      </div>

      <div>
        ${has("registration_type")
          ? fieldRow("Registration Type", entry.registrationType?.name)
          : ""}

        ${has("payer_type")
          ? fieldRow(
              "Payer Type",
              entry.payer_type
                ? entry.payer_type.replace("_", " ").toUpperCase()
                : "—"
            )
          : ""}

        ${has("patientInsurance")
          ? fieldRow(
              "Insurance",
              (() => {
                if (entry.payer_type === "insurance" && !entry.patientInsurance) {
                  return `<span class="text-danger">⚠ Missing Insurance</span>`;
                }

                if (!entry.patientInsurance) return "—";

                const pi = entry.patientInsurance;
                const policy = pi.policy_number || "";
                const plan = pi.plan_name || "";
                const provider = pi.provider?.name || "";

                if (policy && plan && provider) {
                  return `${policy} - ${plan} (${provider})`;
                }

                if (plan && provider) {
                  return `${plan} (${provider})`;
                }

                if (provider) {
                  return provider;
                }

                return "—";
              })()
            )
          : ""}

        ${has("is_emergency")
          ? fieldRow("Emergency", entry.is_emergency ? "Yes" : "No")
          : ""}

        ${has("invoice")
          ? fieldRow(
              "Invoice",
              entry.invoice
                ? `${entry.invoice.invoice_number} - ${entry.invoice.total || 0} ${entry.invoice.currency || ""} (${entry.invoice.status})`
                : "—"
            )
          : ""}
      </div>
    </div>
  `;

  const audit =
    has("created_at") || has("updated_at") || has("deleted_at")
      ? `
        <details class="entity-notes">
          <summary>Audit</summary>
          <div class="entity-card-body">
            <div>
              ${has("createdBy")
                ? fieldRow("Created By", renderUserName(entry.createdBy))
                : ""}
              ${has("created_at")
                ? fieldRow("Created At", formatDateTime(entry.created_at))
                : ""}
            </div>
            <div>
              ${has("updatedBy")
                ? fieldRow("Updated By", renderUserName(entry.updatedBy))
                : ""}
              ${has("updated_at")
                ? fieldRow("Updated At", formatDateTime(entry.updated_at))
                : ""}
              ${has("deletedBy") && entry.deletedBy
                ? fieldRow("Deleted By", renderUserName(entry.deletedBy))
                : ""}
              ${has("deleted_at") && entry.deleted_at
                ? fieldRow("Deleted At", formatDateTime(entry.deleted_at))
                : ""}
            </div>
          </div>
        </details>
      `
      : "";

  const actions = has("actions")
    ? `<div class="entity-card-footer export-ignore">
         ${getRegistrationLogActionButtons(entry, user)}
       </div>`
    : "";

  return `
    <div class="entity-card registration-log-card">
      ${header}
      ${context}
      ${timeline}
      ${body}
      ${audit}
      ${actions}
    </div>
  `;
}
/* ============================================================ */
export function renderList({ entries = [], visibleFields = [], viewMode, user }) {
  const tableBody = document.getElementById("registrationLogTableBody");
  const cardContainer = document.getElementById("registrationLogList");
  const tableContainer = document.querySelector(".table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  /* ================= RESET ================= */
  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const safeFields = Array.isArray(visibleFields) ? visibleFields : [];
  const safeEntries = Array.isArray(entries) ? entries : [];

  /* ============================================================ */
  /* ========================= TABLE ============================ */
  /* ============================================================ */
  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderDynamicTableHead(safeFields);

    /* ================= EMPTY ================= */
    if (!safeEntries.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${safeFields.length || 1}" class="text-muted text-center">
            No registration logs found.
          </td>
        </tr>`;
      initTooltips(tableBody);
      return;
    }

    /* ================= ROWS ================= */
    const fragment = document.createDocumentFragment();

    safeEntries.forEach((entry) => {
      const tr = document.createElement("tr");

      tr.innerHTML = safeFields
        .map((field) => {
          if (field === "actions") {
            return `
              <td class="actions-cell text-center export-ignore">
                ${getRegistrationLogActionButtons(entry, user)}
              </td>`;
          }

          try {
            const value = renderValue(entry, field);
            return `<td>${value ?? "—"}</td>`;
          } catch (err) {
            console.error("Render error:", field, err);
            return `<td>—</td>`;
          }
        })
        .join("");

      fragment.appendChild(tr);
    });

    tableBody.appendChild(fragment);

    initTooltips(tableBody);
  }

  /* ============================================================ */
  /* ========================== CARD ============================ */
  /* ============================================================ */
  else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    /* ================= EMPTY ================= */
    if (!safeEntries.length) {
      cardContainer.innerHTML = `
        <div class="text-muted text-center py-4">
          No registration logs found.
        </div>`;
      initTooltips(cardContainer);
      return;
    }

    /* ================= CARDS ================= */
    const fragment = document.createDocumentFragment();

    safeEntries.forEach((entry) => {
      try {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = renderCard(entry, safeFields, user);

        const card = wrapper.firstElementChild;
        const timelineEl = card.querySelector(".card-timeline");

        if (timelineEl) {
          timelineEl.__entry = entry;
        }

        fragment.appendChild(card);
      } catch (err) {
        console.error("Card render error:", err);

        const errorCard = document.createElement("div");
        errorCard.className = "entity-card error-card";
        errorCard.innerHTML = `<div class="text-danger">Error rendering entry</div>`;
        fragment.appendChild(errorCard);
      }
    });

    cardContainer.appendChild(fragment);

    initTimelines(cardContainer);

    initTooltips(cardContainer);
  }

  /* ============================================================ */
  /* ========================= EXPORT =========================== */
  /* ============================================================ */

  const exportSafeData = safeEntries.map((e) => ({ ...e }));

  setupExportHandlers(exportSafeData, visibleFields);
}
/* ============================================================
   📤 EXPORT (MASTER – EXACT DEPOSIT PATTERN)
============================================================ */
function setupExportHandlers(entries, visibleFields) {
  const title = "Registration Logs Report";

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
      patient_id: document.getElementById("filterPatientId")?.value,
      registrar_id: document.getElementById("filterRegistrarId")?.value,
      registration_type_id: val("filterRegistrationType"),
      registration_method: val("filterMethod"),
      patient_category: val("filterCategory"),
      log_status: val("filterStatus"),
      registration_source: val("filterSource"),
      payer_type: val("filterPayerType"),
      dateRange: val("dateRange"),
    };
  }

  /* ================= CSV ================= */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,
      data: entries,
      visibleFields,
      fieldLabels: FIELD_LABELS_REGISTRATION_LOG,

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

            case "patient":
              row[f] = e.patient
                ? `${e.patient.first_name || ""} ${e.patient.last_name || ""}`.trim()
                : "";
              break;

            case "registrar":
              row[f] = e.registrar
                ? `${e.registrar.first_name || ""} ${e.registrar.last_name || ""}`.trim()
                : "";
              break;

            case "log_status":
              row[f] = (e.log_status || "").toUpperCase();
              break;

            case "is_emergency":
              row[f] = e.is_emergency ? "Yes" : "No";
              break;

            case "registration_time":
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
      endpoint: "/api/registration-logs",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_REGISTRATION_LOG,

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

            case "patient":
              row[f] = e.patient
                ? `${e.patient.first_name || ""} ${e.patient.last_name || ""}`.trim()
                : "";
              break;

            case "registrar":
              row[f] = e.registrar
                ? `${e.registrar.first_name || ""} ${e.registrar.last_name || ""}`.trim()
                : "";
              break;

            case "log_status":
              row[f] = (e.log_status || "").toUpperCase();
              break;

            case "is_emergency":
              row[f] = e.is_emergency ? "Yes" : "No";
              break;

            case "registration_time":
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

        if (k === "dateRange") {
          const [from, to] = v.split(" - ");
          if (from) params.set("date_from", from.trim());
          if (to) params.set("date_to", to.trim());
        } else {
          params.set(k, v);
        }
      });

      const res = await authFetch(
        `/api/registration-logs?${params.toString()}`
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
          label: FIELD_LABELS_REGISTRATION_LOG[f] || f,
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

              case "patient":
                row[f] = e.patient
                  ? `${e.patient.first_name || ""} ${e.patient.last_name || ""}`.trim()
                  : "";
                break;

              case "registrar":
                row[f] = e.registrar
                  ? `${e.registrar.first_name || ""} ${e.registrar.last_name || ""}`.trim()
                  : "";
                break;

              case "log_status":
                row[f] = (e.log_status || "").toUpperCase();
                break;

              case "is_emergency":
                row[f] = e.is_emergency ? "Yes" : "No";
                break;

              case "registration_time":
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