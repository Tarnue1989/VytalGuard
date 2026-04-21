// 📁 patient-render.js – Entity Card System (PATIENT | ENTERPRISE MASTER)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH consultation-render.js
// 🔹 Table = flat | Card = RICH + structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize + drag enabled
// 🔹 FULL audit section (created / updated / deleted)
// 🔹 Permission-driven actions
// 🔹 Export-safe (no object leaks)
// 🔹 JSONB emergency_contacts supported
// 🔹 Media fields (photo / QR) handled correctly
// ============================================================================

import { FIELD_LABELS_PATIENT } from "./patient-constants.js";

import {
  formatDate,
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

import { calculateAge } from "../../utils/calculateAge.js";

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
  "pat_no",
  "first_name",
  "last_name",
  "gender",
  "registration_status",
  "date_of_birth",
  "created_at",
  "updated_at",
  "organization",
  "facility",
]);

let sortBy = localStorage.getItem("patientSortBy") || "";
let sortDir = localStorage.getItem("patientSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("patientSortBy", sortBy);
  localStorage.setItem("patientSortDir", sortDir);

  window.setPatientSort?.(sortBy, sortDir);
  window.loadPatientPage?.(1);
}

/* ============================================================
   🎛️ ACTIONS (MASTER)
============================================================ */
function getPatientActionButtons(entry, user) {
  return buildActionButtons({
    module: "patient",
    status: (entry.registration_status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "patients",
  });
}

/* ============================================================
   🧱 TABLE HEAD (DYNAMIC + RESIZE + DRAG)
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

    const label = FIELD_LABELS_PATIENT[field] || field.replace(/_/g, " ");

    if (field === "actions") {
      th.textContent = "Actions";
      th.classList.add("actions-cell");
      tr.appendChild(th);
      return;
    }

    if (SORTABLE_FIELDS.has(field)) {
      let icon = "ri-arrow-up-down-line";
      if (sortBy === field) {
        icon = sortDir === "asc"
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
    onReorder: () => window.loadPatientPage?.(1),
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

function renderImage(url, size = 64) {
  if (!url) return "";
  const src = url.startsWith("/uploads/") ? url : `/uploads/${url}`;
  return `
    <a href="${src}" target="_blank">
      <img src="${src}" class="rounded shadow-sm"
           style="width:${size}px;height:${size}px;object-fit:cover;" />
    </a>
  `;
}

function renderEmergencyContacts(value, viewMode) {
  if (!Array.isArray(value) || !value.length) return "—";

  if (viewMode === "table") {
    return value.map(c => `${c.name || "—"} (${c.phone || "—"})`).join("<br>");
  }

  return `
    <ul class="ps-3 mb-0">
      ${value.map(
        c => `<li>${c.name || "—"} <small>(${c.phone || "—"})</small></li>`
      ).join("")}
    </ul>
  `;
}

/* ============================================================
   🧩 VALUE RENDERER (OBJECT SAFE)
============================================================ */
function renderValue(entry, field, viewMode = "card") {
  switch (field) {
    case "registration_status": {
      const s = (entry.registration_status || "").toLowerCase();
      const cls =
        s === "active" ? "bg-success" :
        s === "cancelled" ? "bg-warning text-dark" :
        s === "voided" ? "bg-danger" :
        "bg-secondary";
      return `<span class="badge ${cls}">${s.toUpperCase()}</span>`;
    }

    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "date_of_birth":
      return entry.date_of_birth ? formatDate(entry.date_of_birth) : "—";

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    case "photo_path":
      return viewMode === "table" ? "Photo" : renderImage(entry.photo_path, 80);

    case "qr_code_path":
      return viewMode === "table" ? "QR" : renderImage(entry.qr_code_path, 120);

    case "emergency_contacts":
      return renderEmergencyContacts(entry.emergency_contacts, viewMode);

    default: {
      const v = entry[field];
      if (v === null || v === undefined || v === "") return "—";
      if (typeof v === "object") return "—";
      return v;
    }
  }
}

/* ============================================================
   🗂️ CARD RENDERER — RICH + AGE + FULL DETAILS + AUDIT (MASTER)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.registration_status || "").toLowerCase();

  const fullName =
    [entry.first_name, entry.middle_name, entry.last_name]
      .filter(Boolean)
      .join(" ") || "Unnamed Patient";

  return `
    <div class="entity-card patient-card">

      <div class="entity-card-header d-flex gap-3 align-items-center">
        ${has("photo_path")
          ? `<div class="entity-avatar">${renderImage(entry.photo_path, 64)}</div>`
          : ""}
        <div class="flex-grow-1">
          <div class="entity-secondary">${safe(entry.pat_no)}</div>
          <div class="entity-primary">${fullName}</div>
        </div>
        ${has("registration_status")
          ? `<span class="entity-status ${status}">${status.toUpperCase()}</span>`
          : ""}
      </div>

      <div class="entity-card-context">
        ${entry.organization ? `<div>🏥 ${entry.organization.name}</div>` : ""}
        ${entry.facility ? `<div>📍 ${entry.facility.name}</div>` : ""}
        ${
          entry.date_of_birth
            ? `<div>🎂 DOB: ${formatDate(entry.date_of_birth)} • ${calculateAge(entry.date_of_birth)}</div>`
            : ""
        }
      </div>

      <div class="entity-card-body">
        ${has("gender") ? `<div class="entity-field"><span class="entity-label">Gender</span><span class="entity-value">${safe(entry.gender)}</span></div>` : ""}
        ${has("phone_number") ? `<div class="entity-field"><span class="entity-label">Phone</span><span class="entity-value">${safe(entry.phone_number)}</span></div>` : ""}
        ${has("email_address") ? `<div class="entity-field"><span class="entity-label">Email</span><span class="entity-value">${safe(entry.email_address)}</span></div>` : ""}
        ${has("home_address") ? `<div class="entity-field"><span class="entity-label">Address</span><span class="entity-value">${safe(entry.home_address)}</span></div>` : ""}
        ${has("emergency_contacts") ? `<div class="entity-field"><span class="entity-label">Emergency</span><span class="entity-value">${renderEmergencyContacts(entry.emergency_contacts)}</span></div>` : ""}
        ${has("qr_code_path") ? `<div class="entity-field"><span class="entity-label">QR Code</span><span class="entity-value">${renderImage(entry.qr_code_path, 120)}</span></div>` : ""}
      </div>

      <details class="entity-notes">
        <summary>Additional Details</summary>
        <div class="entity-card-body">
          <div class="entity-field"><span class="entity-label">Marital Status</span><span class="entity-value">${safe(entry.marital_status)}</span></div>
          <div class="entity-field"><span class="entity-label">Religion</span><span class="entity-value">${safe(entry.religion)}</span></div>
          <div class="entity-field"><span class="entity-label">Profession</span><span class="entity-value">${safe(entry.profession)}</span></div>
          <div class="entity-field"><span class="entity-label">Registration Source</span><span class="entity-value">${safe(entry.source_of_registration)}</span></div>
          <div class="entity-field"><span class="entity-label">National ID</span><span class="entity-value">${safe(entry.national_id)}</span></div>
          <div class="entity-field"><span class="entity-label">Insurance #</span><span class="entity-value">${safe(entry.insurance_number)}</span></div>
          <div class="entity-field"><span class="entity-label">Passport #</span><span class="entity-value">${safe(entry.passport_number)}</span></div>
          <div class="entity-field"><span class="entity-label">Notes</span><span class="entity-value">${safe(entry.notes)}</span></div>
        </div>
      </details>

      <details class="entity-notes">
        <summary>Audit</summary>
        <div class="entity-card-body">
          <div class="entity-field"><span class="entity-label">Created By</span><span class="entity-value">${renderUserName(entry.createdBy)}</span></div>
          <div class="entity-field"><span class="entity-label">Created At</span><span class="entity-value">${formatDateTime(entry.created_at)}</span></div>
          <div class="entity-field"><span class="entity-label">Updated By</span><span class="entity-value">${renderUserName(entry.updatedBy)}</span></div>
          <div class="entity-field"><span class="entity-label">Updated At</span><span class="entity-value">${formatDateTime(entry.updated_at)}</span></div>
          <div class="entity-field"><span class="entity-label">Deleted By</span><span class="entity-value">${renderUserName(entry.deletedBy)}</span></div>
          <div class="entity-field"><span class="entity-label">Deleted At</span><span class="entity-value">${formatDateTime(entry.deleted_at)}</span></div>
        </div>
      </details>

      ${has("actions")
        ? `<div class="entity-card-footer export-ignore">
             ${getPatientActionButtons(entry, user)}
           </div>`
        : ""}
    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("patientTableBody");
  const cardContainer = document.getElementById("patientList");
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
            No patients found.
          </td>
        </tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">${getPatientActionButtons(e, user)}</td>`
            : `<td>${renderValue(e, f, "table")}</td>`
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
      : `<p class="text-center text-muted">No patients found.</p>`;
    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);;
}

/* ============================================================
   📤 EXPORT (MASTER – EXACT DEPOSIT PATTERN)
============================================================ */
function setupExportHandlers(entries, visibleFields) {
  const title = "Patients Report";

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
      search: val("filterSearch")?.trim(),
      organization_id: val("filterOrganizationSelect"),
      facility_id: val("filterFacilitySelect"),
      registration_status: val("filterStatus"),
      gender: val("filterGender"),
      dateRange: val("dateRange"),
    };
  }

  /* ================= CSV ================= */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,
      data: entries,
      visibleFields,
      fieldLabels: FIELD_LABELS_PATIENT,

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
            case "full_name":
              row[f] = [
                e.first_name,
                e.middle_name,
                e.last_name,
              ]
                .filter(Boolean)
                .join(" ");
              break;

            case "registration_status":
              row[f] = (e.registration_status || "").toUpperCase();
              break;

            case "gender":
              row[f] = (e.gender || "").toUpperCase();
              break;

            case "date_of_birth":
              row[f] = e.date_of_birth
                ? new Date(e.date_of_birth).toLocaleDateString()
                : "";
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
      endpoint: "/api/patients",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_PATIENT,

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
            case "full_name":
              row[f] = [
                e.first_name,
                e.middle_name,
                e.last_name,
              ]
                .filter(Boolean)
                .join(" ");
              break;

            case "registration_status":
              row[f] = (e.registration_status || "").toUpperCase();
              break;

            case "gender":
              row[f] = (e.gender || "").toUpperCase();
              break;

            case "date_of_birth":
              row[f] = e.date_of_birth
                ? new Date(e.date_of_birth).toLocaleDateString()
                : "";
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

        if (k === "dateRange") {
          const [from, to] = v.split(" - ");
          if (from) params.set("date_from", from.trim());
          if (to) params.set("date_to", to.trim());
        } else {
          params.set(k, v);
        }
      });

      const res = await authFetch(
        `/api/patients?${params.toString()}`
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
          label: FIELD_LABELS_PATIENT[f] || f,
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
              case "full_name":
                row[f] = [
                  e.first_name,
                  e.middle_name,
                  e.last_name,
                ]
                  .filter(Boolean)
                  .join(" ");
                break;

              case "registration_status":
                row[f] = (e.registration_status || "").toUpperCase();
                break;

              case "gender":
                row[f] = (e.gender || "").toUpperCase();
                break;

              case "date_of_birth":
                row[f] = e.date_of_birth
                  ? new Date(e.date_of_birth).toLocaleDateString()
                  : "";
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