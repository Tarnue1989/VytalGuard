// 📁 delivery-record-render.js – Entity Card System (DELIVERY RECORD | ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH ekg-record-render.js
// 🔹 Table = flat | Card = structured (entity-card system)
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize enabled
// 🔹 Column drag reorder enabled
// 🔹 Full audit section (created / updated / deleted / verified / finalized / voided)
// 🔹 Permission-driven actions (superadmin-aware)
// 🔹 Export-safe
// ============================================================================

import { FIELD_LABELS_DELIVERY_RECORD } from "./delivery-record-constants.js";

import {
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE FIELDS (TABLE ONLY – BACKEND SAFE)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "delivery_date",
  "status",
  "created_at",
  "updated_at",
]);

/* ============================================================
   🔃 SORT STATE (UI ONLY – MAIN OWNS BACKEND)
============================================================ */
let sortBy = localStorage.getItem("deliveryRecordSortBy") || "";
let sortDir = localStorage.getItem("deliveryRecordSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("deliveryRecordSortBy", sortBy);
  localStorage.setItem("deliveryRecordSortDir", sortDir);

  window.setDeliveryRecordSort?.(sortBy, sortDir);
  window.loadDeliveryRecordPage?.(1);
}

/* ============================================================
   🎛️ ACTION BUTTONS (PERMISSION-DRIVEN)
============================================================ */
function getDeliveryRecordActionButtons(entry, user) {
  return buildActionButtons({
    module: "delivery_record",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "delivery_records",
  });
}

/* ============================================================
   🧱 DYNAMIC TABLE HEAD (SORT + RESIZE + DRAG)
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
      FIELD_LABELS_DELIVERY_RECORD[field] || field.replace(/_/g, " ");

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
        icon = sortDir === "asc" ? "ri-arrow-up-line" : "ri-arrow-down-line";
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
      window.loadDeliveryRecordPage?.(1);
    },
  });
}

/* ============================================================
   🔠 HELPERS
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.full_name || "—";
}

/* ============================================================
   🧩 FIELD VALUE RENDERER
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      let cls = "bg-secondary";
      if (raw === "scheduled") cls = "bg-info";
      if (raw === "in_progress") cls = "bg-warning text-dark";
      if (raw === "completed") cls = "bg-primary";
      if (raw === "verified") cls = "bg-success";
      if (raw === "cancelled") cls = "bg-danger";
      if (raw === "voided") cls = "bg-secondary";

      return `<span class="badge ${cls}">
        ${raw ? raw.toUpperCase() : "—"}
      </span>`;
    }

    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no || ""} ${entry.patient.first_name || ""} ${entry.patient.last_name || ""}`.trim() || "—"
        : "—";

    case "doctor":
      return renderUserName(entry.doctor);

    case "midwife":
      return renderUserName(entry.midwife);

    case "department":
      return entry.department?.name || "—";

    case "consultation":
      return entry.consultation
        ? `${formatDateTime(entry.consultation.consultation_date)} (${entry.consultation.status})`
        : "—";

    case "billableItem":
      return entry.billableItem?.name || "—";

    case "invoice":
      return entry.invoice
        ? `${entry.invoice.invoice_number} (${entry.invoice.status})`
        : "—";

    case "is_emergency":
      return entry.is_emergency
        ? `<span class="badge bg-danger">YES</span>`
        : `<span class="badge bg-secondary">NO</span>`;

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
    case "verifiedBy":
    case "finalizedBy":
    case "voidedBy":
      return renderUserName(entry[field]);

    case "delivery_date":
    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "verified_at":
    case "finalized_at":
    case "voided_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default: {
      const val = entry[field];

      if (val === null || val === undefined) return "—";

      if (typeof val === "object") {
        if (val.name) return val.name;
        if (val.label) return val.label;
        if (val.code) return val.code;
        return "—";
      }

      return val;
    }

  }
}

/* ============================================================
   🧱 CARD RENDERER (ENTITY CARD SYSTEM – DELIVERY RECORD)
   ------------------------------------------------------------
   - Mirrors ekg-record-render.js structure exactly
   - Header / Context / Core Body / Notes / Audit / Actions
   - No object rendering
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

  const status = (entry.status || "").toLowerCase();

  /* ================= HEADER ================= */
  const header = `
    <div class="entity-card-header">
      <div>
        <div class="entity-secondary">
          ${safe(entry.patient?.pat_no)}
        </div>
        <div class="entity-primary">
          ${safe(entry.patient?.first_name)} ${safe(entry.patient?.last_name)}
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
  const context = `
    <div class="entity-card-context">
      <div>🏥 ${safe(entry.organization?.name)}</div>
      <div>📍 ${safe(entry.facility?.name)}</div>
      <div>💳 ${safe(entry.billableItem?.name)}</div>
      ${
        entry.invoice
          ? `<div>🧾 ${safe(entry.invoice.invoice_number)}
              (${safe(entry.invoice.status)})</div>`
          : ""
      }
    </div>
  `;

  /* ================= CORE BODY ================= */
  const body = `
    <div class="entity-card-body">
      <div>
        ${fieldRow(
          "Delivery Date",
          entry.delivery_date ? formatDateTime(entry.delivery_date) : "—"
        )}
        ${fieldRow("Department", entry.department?.name)}
        ${fieldRow("Doctor", renderUserName(entry.doctor))}
        ${fieldRow("Midwife", renderUserName(entry.midwife))}
      </div>
      <div>
        ${fieldRow("Baby Count", entry.baby_count)}
        ${fieldRow("Delivery Mode", entry.delivery_mode)}
        ${fieldRow(
          "Emergency",
          entry.is_emergency
            ? `<span class="badge bg-danger">YES</span>`
            : `<span class="badge bg-secondary">NO</span>`
        )}
        ${fieldRow("Status", entry.status?.toUpperCase())}
      </div>
    </div>
  `;

  /* ================= MORE DETAILS ================= */
  const moreDetails =
    entry.notes || entry.complications || entry.outcome
      ? `
      <details class="entity-notes">
        <summary>Delivery Notes</summary>
        <div class="entity-card-body">
          <div>
            ${fieldRow("Outcome", entry.outcome)}
            ${fieldRow("Complications", entry.complications)}
          </div>
          <div>
            ${fieldRow("Notes", entry.notes)}
          </div>
        </div>
      </details>
    `
      : "";

  /* ================= AUDIT ================= */
  const audit = `
    <details class="entity-notes">
      <summary>Audit</summary>
      <div class="entity-card-body">
        <div>
          ${fieldRow("Created By", renderUserName(entry.createdBy))}
          ${fieldRow(
            "Created At",
            entry.created_at ? formatDateTime(entry.created_at) : "—"
          )}
        </div>
        <div>
          ${fieldRow("Updated By", renderUserName(entry.updatedBy))}
          ${fieldRow(
            "Updated At",
            entry.updated_at ? formatDateTime(entry.updated_at) : "—"
          )}
        </div>
      </div>
    </details>
  `;

  /* ================= ACTIONS ================= */
  const actions = has("actions")
    ? `<div class="entity-card-footer export-ignore">
         ${getDeliveryRecordActionButtons(entry, user)}
       </div>`
    : "";

  return `
    <div class="entity-card delivery-record-card">
      ${header}
      ${context}
      ${body}
      ${moreDetails}
      ${audit}
      ${actions}
    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER (TABLE + CARD)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("deliveryRecordTableBody");
  const cardContainer = document.getElementById("deliveryRecordList");
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
            No delivery records found.
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
                 ${getDeliveryRecordActionButtons(entry, user)}
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
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center">No delivery records found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 EXPORT HANDLERS
============================================================ */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Delivery Records Report";

  document.getElementById("exportCSVBtn")?.addEventListener("click", () => {
    exportData({ type: "csv", data: entries, title });
  });

  document.getElementById("exportExcelBtn")?.addEventListener("click", () => {
    exportData({ type: "xlsx", data: entries, title });
  });

  document.getElementById("exportPDFBtn")?.addEventListener("click", () => {
    exportData({
      type: "pdf",
      title,
      selector: ".table-container.active, #deliveryRecordList.active",
      orientation: "landscape",
    });
  });
}
