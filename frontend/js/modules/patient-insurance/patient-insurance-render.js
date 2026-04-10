// 📦 patient-insurance-render.js – Entity Card System (PATIENT INSURANCE | FINAL FIXED)

import { FIELD_LABELS_PATIENT_INSURANCE } from "./patient-insurance-constants.js";
import { getCurrencySymbol } from "../../utils/currency-utils.js";
import { formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

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
}