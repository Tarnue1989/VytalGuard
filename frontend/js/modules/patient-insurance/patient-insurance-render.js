// 📦 patient-insurance-render.js – Entity Card System (PATIENT INSURANCE | FINAL FIXED)

import { FIELD_LABELS_PATIENT_INSURANCE } from "./patient-insurance-constants.js";
import { getCurrencySymbol } from "../../utils/currency-utils.js";
import { formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

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
  "patient_id",
  "provider_id",
  "policy_number",
  "plan_name",
  "coverage_limit",
  "status",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("patientInsuranceSortBy") || "";
let sortDir = localStorage.getItem("patientInsuranceSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("patientInsuranceSortBy", sortBy);
  localStorage.setItem("patientInsuranceSortDir", sortDir);

  window.setPatientInsuranceSort?.(sortBy, sortDir);
  window.loadPatientInsurancePage?.(1);
}

/* ============================================================
   🎛️ ACTIONS
============================================================ */
function getPatientInsuranceActionButtons(entry, user) {
  return buildActionButtons({
    module: "patient_insurances",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "patient_insurances",
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
      FIELD_LABELS_PATIENT_INSURANCE[field] || field.replace(/_/g, " ");

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
    onReorder: () => window.loadPatientInsurancePage?.(1),
  });
}

/* ============================================================
   🔠 HELPERS
============================================================ */
const safe = (v) =>
  v !== null && v !== undefined && v !== "" ? v : "—";

const money = (v) =>
  v != null
    ? `${getCurrencySymbol("USD")} ${Number(v).toFixed(2)}`
    : "—";

function renderUserName(u) {
  if (!u) return "—";
  return (
    [u.first_name, u.middle_name, u.last_name]
      .filter(Boolean)
      .join(" ") || u.full_name || "—"
  );
}

function renderPatient(entry) {
  if (!entry.patient) return "—";

  const p = entry.patient;

  // ✅ Build name (your original logic)
  const name = [
    p.first_name,
    p.middle_name,
    p.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  // ✅ Add patient number in front
  if (p.pat_no) {
    return `${p.pat_no}${name ? " - " + name : ""}`;
  }

  return name || "—";
}
function renderProvider(entry) {
  return entry.provider?.name || "—";
}

/* ============================================================
   🧩 TABLE VALUE RENDERER
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "policy_number":
      return safe(entry.policy_number);

    case "plan_name":
      return safe(entry.plan_name);

    case "coverage_limit":
      return money(entry.coverage_limit);
    case "currency":
      return safe(entry.currency);

    case "is_primary":
      return entry.is_primary
        ? `<span class="badge bg-success">YES</span>`
        : `<span class="badge bg-secondary">NO</span>`;

    case "status": {
      const s = (entry.status || "").toLowerCase();
      const color =
        s === "active"
          ? "success"
          : s === "inactive"
          ? "secondary"
          : "primary";
      return `<span class="badge bg-${color}">${s.toUpperCase()}</span>`;
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

    case "provider":
    case "provider_id":
      return renderProvider(entry);

    case "valid_from":
    case "valid_to":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    case "notes":
      return safe(entry.notes);

    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default:
      return safe(entry[field]);
  }
}

/* ============================================================
   🗂️ CARD RENDERER
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const status = (entry.status || "").toLowerCase();

  const row = (label, value) => {
    if (!value) return "";
    return `
      <div class="entity-field">
        <span class="entity-label">${label}</span>
        <span class="entity-value">${safe(value)}</span>
      </div>
    `;
  };

  return `
    <div class="entity-card patient-insurance-card">

      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${renderPatient(entry)}</div>
          <div class="entity-primary">${safe(entry.policy_number)}</div>
        </div>
        <span class="entity-status ${status}">${status.toUpperCase()}</span>
      </div>

      <div class="entity-card-body">
        ${row("Provider", renderProvider(entry))}
        ${row("Organization", entry.organization?.name)}
        ${row("Facility", entry.facility?.name)}
        ${row("Plan", entry.plan_name)}
        ${row("Coverage", money(entry.coverage_limit, entry.currency))}
        ${row("Currency", entry.currency)}
        ${row("Primary", entry.is_primary ? "YES" : "NO")}
      </div>

      <details class="entity-section">
        <summary><strong>Validity</strong></summary>
        <div class="entity-card-body">
          ${row("Valid From", entry.valid_from ? formatDateTime(entry.valid_from) : "")}
          ${row("Valid To", entry.valid_to ? formatDateTime(entry.valid_to) : "")}
        </div>
      </details>

      <details class="entity-section">
        <summary><strong>Notes</strong></summary>
        <div class="entity-card-body">
          ${row("Notes", entry.notes)}
        </div>
      </details>

      <details class="entity-section">
        <summary><strong>Audit</strong></summary>
        <div class="entity-card-body">
          ${row("Created By", renderUserName(entry.createdBy))}
          ${row("Created At", entry.created_at ? formatDateTime(entry.created_at) : "")}
          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row("Updated At", entry.updated_at ? formatDateTime(entry.updated_at) : "")}
        </div>
      </details>

      <div class="entity-card-footer export-ignore">
        ${getPatientInsuranceActionButtons(entry, user)}
      </div>

    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("patientInsuranceTableBody");
  const cardContainer = document.getElementById("patientInsuranceList");
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
            No patient insurance found.
          </td>
        </tr>
      `;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");

      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell">${getPatientInsuranceActionButtons(e, user)}</td>`
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
      : `<p class="text-center text-muted">No patient insurance found.</p>`;

    initTooltips(cardContainer);
  }
    setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 EXPORT (MASTER – ENTERPRISE PARITY)
============================================================ */
/* ============================================================
   📤 EXPORT (MASTER – ENTERPRISE PARITY)
============================================================ */
function setupExportHandlers(entries, visibleFields) {
  const title = "Patient Insurance Report";

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
      patient_id: document.getElementById("filterPatientId")?.value,
      provider_id: val("filterProvider"),
      currency: val("filterCurrency"),
      dateRange: val("dateRange"),
    };
  }

  /* =========================================================
     🔥 SHARED ROW MAPPER
  ========================================================= */
  const mapPatientInsuranceRow = (e, fields) => {
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

        case "provider":
        case "provider_id":
          row[f] = renderProvider(e);
          break;

        /* ================= MONEY ================= */

        case "coverage_limit":
          row[f] =
            `${getCurrencySymbol(e.currency || "USD")} ${Number(e.coverage_limit || 0).toFixed(2)}`;
          break;

        case "currency":
          row[f] = e.currency || "";
          break;

        /* ================= STATUS ================= */

        case "status":
          row[f] = (e.status || "").toUpperCase();
          break;

        case "is_primary":
          row[f] = e.is_primary ? "YES" : "NO";
          break;

        /* ================= VALIDITY ================= */

        case "valid_from":
          row[f] = e.valid_from
            ? new Date(e.valid_from).toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "";
          break;

        case "valid_to":
          row[f] = e.valid_to
            ? new Date(e.valid_to).toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "";
          break;

        /* ================= AUDIT USERS ================= */

        case "createdBy":
          row[f] = e.createdBy
            ? `${e.createdBy.first_name || ""} ${e.createdBy.last_name || ""}`.trim()
            : "";
          break;

        case "updatedBy":
          row[f] = e.updatedBy
            ? `${e.updatedBy.first_name || ""} ${e.updatedBy.last_name || ""}`.trim()
            : "";
          break;

        case "deletedBy":
          row[f] = e.deletedBy
            ? `${e.deletedBy.first_name || ""} ${e.deletedBy.last_name || ""}`.trim()
            : "";
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
     🔥 GROUP TOTALS BY CURRENCY
  ========================================================= */
  const groupTotalsByCurrency = (records, field) => {
    const totals = {};

    records.forEach((r) => {
      const currency = r.currency || "USD";

      if (!totals[currency]) {
        totals[currency] = 0;
      }

      totals[currency] += Number(r[field] || 0);
    });

    return totals;
  };

  /* =========================================================
     ✅ CSV EXPORT
  ========================================================= */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,

      data: entries,

      visibleFields,

      fieldLabels: FIELD_LABELS_PATIENT_INSURANCE,

      mapRow: (e, fields) =>
        mapPatientInsuranceRow(e, fields),
    });
  });

  /* =========================================================
     ✅ EXCEL EXPORT
  ========================================================= */
  newExcelBtn.addEventListener("click", () => {
    exportExcelReport({
      endpoint: "/api/patient-insurances",

      title,

      filters: getFiltersFromDOM(),

      visibleFields,

      fieldLabels: FIELD_LABELS_PATIENT_INSURANCE,

      mapRow: (e, fields) =>
        mapPatientInsuranceRow(e, fields),

      computeTotals: (records) => {
        const grouped =
          groupTotalsByCurrency(records, "coverage_limit");

        const result = {
          "Total Records": records.length,
        };

        Object.entries(grouped).forEach(([currency, total]) => {
          result[`Coverage Limit (${currency})`] = total;
        });

        return result;
      },
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
        `/api/patient-insurances?${params.toString()}`
      );

      const json = await res.json();

      const allEntries = json?.data?.records || [];

      const grouped =
        groupTotalsByCurrency(allEntries, "coverage_limit");

      const cleanFields = visibleFields.filter(
        (f) =>
          f !== "actions" &&
          !["deletedBy", "deleted_at"].includes(f)
      );

      printReport({
        title,

        columns: cleanFields.map((f) => ({
          key: f,
          label: FIELD_LABELS_PATIENT_INSURANCE[f] || f,
        })),

        rows: allEntries.map((e) =>
          mapPatientInsuranceRow(e, cleanFields)
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
          },

          ...Object.entries(grouped).map(
            ([currency, total], index, arr) => ({
              label: `Coverage Limit (${currency})`,
              value: `${getCurrencySymbol(currency)} ${total.toFixed(2)}`,
              final: index === arr.length - 1,
            })
          ),
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