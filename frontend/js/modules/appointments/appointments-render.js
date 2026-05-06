// 📁 appointment-render.js – Entity Card System (APPOINTMENT | ENTERPRISE MASTER)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH consultation-render.js
// 🔹 Table = flat | Card = RICH + structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize + drag enabled
// 🔹 Full audit section (created / updated / deleted)
// 🔹 Permission-driven actions
// 🔹 Export-safe (no object leaks)
// ============================================================================

import { FIELD_LABELS_APPOINTMENT } from "./appointments-constants.js";

import {
  formatDate,
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

import { exportExcelReport } from "../../utils/exportExcelReport.js";
import { exportCsvReport } from "../../utils/exportCsvReport.js";
import { printReport } from "../../utils/printBuilder.js";
import { authFetch } from "../../authSession.js";
import { formatFilters } from "../../utils/filterFormatter.js";

/* ============================================================
   🔃 SORTABLE FIELDS (MASTER PARITY)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "patient_id",
  "doctor_id",
  "department_id",
  "date_time",
  "status",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("appointmentSortBy") || "";
let sortDir = localStorage.getItem("appointmentSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("appointmentSortBy", sortBy);
  localStorage.setItem("appointmentSortDir", sortDir);

  window.setAppointmentSort?.(sortBy, sortDir);
  window.loadAppointmentPage?.(1);
}

/* ============================================================
   🎛️ ACTIONS (MASTER)
============================================================ */
function getAppointmentActionButtons(entry, user) {
  return buildActionButtons({
    module: "appointment",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "appointments",
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
    th.dataset.key = field;

    const label =
      FIELD_LABELS_APPOINTMENT[field] || field.replace(/_/g, " ");

    if (field === "actions") {
      th.textContent = "Actions";
      th.classList.add("actions-cell");
      tr.appendChild(th);
      return;
    }

    if (SORTABLE_FIELDS.has(field)) {
      let icon = "ri-arrow-up-down-line";
      if (sortBy === field) {
        icon =
          sortDir === "asc"
            ? "ri-arrow-up-line"
            : "ri-arrow-down-line";
      }

      th.classList.add("sortable");
      th.innerHTML = `<span>${label}</span><i class="${icon} sort-icon"></i>`;
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
    onReorder: () => window.loadAppointmentPage?.(1),
  });
}

/* ============================================================
   🔠 HELPERS
============================================================ */
const safe = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");

function renderUserName(u) {
  if (!u) return "—";
  return (
    [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ") ||
    u.full_name ||
    u.email ||
    "—"
  );
}

function renderPatient(entry) {
  if (!entry.patient) return "—";
  const p = entry.patient;
  return `${p.pat_no || "—"} - ${[p.first_name, p.middle_name, p.last_name]
    .filter(Boolean)
    .join(" ")}`;
}

/* ============================================================
   🧩 TABLE VALUE RENDERER (OBJECT SAFE)
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const s = (entry.status || "").toLowerCase();
      const cls =
        s === "scheduled"
          ? "bg-primary"
          : s === "in_progress"
          ? "bg-warning text-dark"
          : s === "completed"
          ? "bg-success"
          : s === "verified"
          ? "bg-info"
          : s === "cancelled"
          ? "bg-danger"
          : s === "no_show"
          ? "bg-secondary"
          : s === "voided"
          ? "bg-dark text-light"
          : "bg-secondary";
      return `<span class="badge ${cls}">${s.replace(/_/g, " ").toUpperCase()}</span>`;
    }

    case "organization":
    case "organization_id":
      return entry.organization?.name || "—";

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "patient":
    case "patient_id":
      return renderPatient(entry);

    case "doctor":
    case "doctor_id":
      return renderUserName(entry.doctor);

    case "department":
    case "department_id":
      return entry.department?.name || "—";

    case "invoice":
    case "invoice_id":
      return entry.invoice?.invoice_number || "—";

    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    case "date_time":
      return entry.date_time ? formatDateTime(entry.date_time) : "—";

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default: {
      const v = entry[field];
      if (v === null || v === undefined || v === "") return "—";
      if (typeof v === "object") return "—";
      return v;
    }
  }
}

/* ============================================================
   🗂️ CARD RENDERER — RICH (MASTER)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const row = (label, value) =>
    value === undefined || value === null || value === ""
      ? ""
      : `
        <div class="entity-field">
          <span class="entity-label">${label}</span>
          <span class="entity-value">${safe(value)}</span>
        </div>
      `;

  return `
    <div class="entity-card appointment-card">
      <div class="entity-card-header">
        <div>
          ${has("appointment_code")
            ? `<div class="entity-secondary">${safe(entry.appointment_code)}</div>`
            : ""}
          <div class="entity-primary">${renderPatient(entry)}</div>
        </div>
        ${
          has("status")
            ? `<span class="entity-status ${status}">${status.replace(/_/g, " ").toUpperCase()}</span>`
            : ""
        }
      </div>

      <div class="entity-card-context">
        ${entry.organization ? `<div>🏥 ${entry.organization.name}</div>` : ""}
        ${entry.facility ? `<div>📍 ${entry.facility.name}</div>` : ""}
        ${entry.doctor ? `<div>👨‍⚕️ ${renderUserName(entry.doctor)}</div>` : ""}
        ${entry.department ? `<div>🏬 ${entry.department.name}</div>` : ""}
        ${entry.date_time ? `<div>📅 ${formatDateTime(entry.date_time)}</div>` : ""}
      </div>

      <div class="entity-card-body">
        ${row("Doctor", renderUserName(entry.doctor))}
        ${row("Department", entry.department?.name)}
        ${row("Invoice", entry.invoice?.invoice_number)}
        ${row("Status", status.replace(/_/g, " ").toUpperCase())}
      </div>

      <details class="entity-notes">
        <summary>Audit</summary>
        <div class="entity-card-body">
          ${row("Created By", renderUserName(entry.createdBy))}
          ${row("Created At", formatDateTime(entry.created_at))}
          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row("Updated At", formatDateTime(entry.updated_at))}
          ${row("Deleted By", renderUserName(entry.deletedBy))}
          ${row("Deleted At", formatDateTime(entry.deleted_at))}
        </div>
      </details>

      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getAppointmentActionButtons(entry, user)}
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
  const tableBody = document.getElementById("appointmentTableBody");
  const cardContainer = document.getElementById("appointmentList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");
    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${visibleFields.length}" class="text-center text-muted">
            No appointments found.
          </td>
        </tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">
                 ${getAppointmentActionButtons(e, user)}
               </td>`
            : `<td>${renderValue(e, f)}</td>`
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
      : `<p class="text-center text-muted">No appointments found.</p>`;
    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 EXPORT (MASTER – ENTERPRISE PARITY)
============================================================ */
function setupExportHandlers(entries, visibleFields) {
  const title = "Appointments Report";

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

  /* =========================================================
     🔎 FILTERS
  ========================================================= */
  function getFiltersFromDOM() {
    const val = (id) => document.getElementById(id)?.value;

    return {
      search: val("globalSearch")?.trim(),
      organization_id: val("filterOrganizationSelect"),
      facility_id: val("filterFacilitySelect"),
      status: val("filterStatus"),
      department_id: val("filterDepartment"),
      patient_id: document.getElementById("filterPatientId")?.value,
      doctor_id: document.getElementById("filterDoctorId")?.value,
      dateRange: val("dateRange"),
    };
  }

  /* =========================================================
     🔥 SHARED ROW MAPPER
  ========================================================= */
  const mapAppointmentRow = (e, fields) => {
    const row = {};

    fields.forEach((f) => {
      switch (f) {

        /* ================= RELATIONS ================= */

        case "organization":
        case "organization_id":
          row[f] = e.organization?.name || "";
          break;

        case "facility":
        case "facility_id":
          row[f] = e.facility?.name || "";
          break;

        case "patient":
        case "patient_id":
          row[f] = renderPatient(e);
          break;

        case "doctor":
        case "doctor_id":
          row[f] = renderUserName(e.doctor);
          break;

        case "department":
        case "department_id":
          row[f] = e.department?.name || "";
          break;

        case "invoice":
        case "invoice_id":
          row[f] = e.invoice?.invoice_number || "";
          break;

        /* ================= STATUS ================= */

        case "status":
          row[f] = (e.status || "")
            .replace(/_/g, " ")
            .toUpperCase();
          break;

        /* ================= DATES ================= */

        case "date_time":
          row[f] = e.date_time
            ? new Date(e.date_time).toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "";
          break;

        /* ================= AUDIT USERS ================= */

        case "createdBy":
          row[f] = renderUserName(e.createdBy);
          break;

        case "updatedBy":
          row[f] = renderUserName(e.updatedBy);
          break;

        case "deletedBy":
          row[f] = renderUserName(e.deletedBy);
          break;

        /* ================= AUDIT DATES ================= */

        case "created_at":
          row[f] = e.created_at
            ? new Date(e.created_at).toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "";
          break;

        case "updated_at":
          row[f] = e.updated_at
            ? new Date(e.updated_at).toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "";
          break;

        case "deleted_at":
          row[f] = e.deleted_at
            ? new Date(e.deleted_at).toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "";
          break;

        /* ================= DEFAULT ================= */

        default:
          row[f] =
            typeof e[f] === "object"
              ? ""
              : String(e[f] ?? "");
      }
    });

    return row;
  };

  /* =========================================================
     ✅ CSV EXPORT
  ========================================================= */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,

      data: entries,

      visibleFields,

      fieldLabels: FIELD_LABELS_APPOINTMENT,

      mapRow: (e, fields) =>
        mapAppointmentRow(e, fields),
    });
  });

  /* =========================================================
     ✅ EXCEL EXPORT
  ========================================================= */
  newExcelBtn.addEventListener("click", () => {
    exportExcelReport({
      endpoint: "/api/appointments",

      title,

      filters: getFiltersFromDOM(),

      visibleFields,

      fieldLabels: FIELD_LABELS_APPOINTMENT,

      mapRow: (e, fields) =>
        mapAppointmentRow(e, fields),

      computeTotals: (records) => ({
        "Total Records": records.length,
      }),
    });
  });

  /* =========================================================
     ✅ PDF EXPORT
  ========================================================= */
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
        `/api/appointments?${params.toString()}`
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
          label: FIELD_LABELS_APPOINTMENT[f] || f,
        })),

        rows: allEntries.map((e) =>
          mapAppointmentRow(e, cleanFields)
        ),

        meta: {
          Organization: allEntries[0]?.organization?.name || "",
          Facility: allEntries[0]?.facility?.name || "",
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

          printedAt: new Date().toLocaleString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
        },
      });

    } catch (err) {
      console.error(err);
      alert("❌ Failed to export report");
    }
  });
}