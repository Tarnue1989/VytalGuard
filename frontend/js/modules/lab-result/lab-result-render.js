// 📁 lab-result-render.js – Entity Card System (LAB RESULT | ENTERPRISE MASTER)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH patient-render.js
// 🔹 Table = flat | Card = RICH + structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize + drag enabled
// 🔹 FULL audit section (entered / reviewed / verified / created / updated / deleted)
// 🔹 Permission-driven actions
// 🔹 Export-safe (no object leaks)
// 🔹 Attachment preview supported
// ============================================================================

import { FIELD_LABELS_LAB_RESULT } from "./lab-result-constants.js";

import {
  formatDate,
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE FIELDS (MASTER PARITY)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "result_date",
  "status",
  "created_at",
  "updated_at",
  "organization",
  "facility",
  "patient",
  "doctor",
]);

let sortBy = localStorage.getItem("labResultSortBy") || "";
let sortDir = localStorage.getItem("labResultSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("labResultSortBy", sortBy);
  localStorage.setItem("labResultSortDir", sortDir);

  window.setLabResultSort?.(sortBy, sortDir);
  window.loadLabResultPage?.(1);
}

/* ============================================================
   🎛️ ACTIONS (MASTER)
============================================================ */
function getLabResultActionButtons(entry, user) {
  return buildActionButtons({
    module: "lab_result",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "lab_results",
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

    const label =
      FIELD_LABELS_LAB_RESULT[field] || field.replace(/_/g, " ");

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

  // MASTER: colgroup for width control
  let colgroup = table.querySelector("colgroup");
  if (colgroup) colgroup.remove();

  colgroup = document.createElement("colgroup");
  visibleFields.forEach(() => {
    const col = document.createElement("col");
    col.style.width = "170px";
    colgroup.appendChild(col);
  });
  table.prepend(colgroup);

  enableColumnResize(table);
  enableColumnDrag({
    table,
    visibleFields,
    onReorder: () => window.loadLabResultPage?.(1),
  });
}

/* ============================================================
   🔠 HELPERS
============================================================ */
const safe = (v) =>
  v !== null && v !== undefined && v !== "" ? v : "—";

function renderUserName(u) {
  if (!u) return "—";
  return (
    [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ") ||
    u.full_name ||
    u.email ||
    "—"
  );
}

function renderAttachment(url) {
  if (!url) return "—";
  return `
    <a href="${url}" target="_blank" rel="noopener noreferrer"
       data-bs-toggle="tooltip" data-bs-title="Open attachment">
      <i class="ri-file-2-line me-1"></i>Attachment
    </a>
  `;
}

/* ============================================================
   🧩 VALUE RENDERER (OBJECT SAFE)
============================================================ */
function renderValue(entry, field, viewMode = "card") {
  switch (field) {
    case "status": {
      const s = (entry.status || "").toLowerCase();
      const colorMap = {
        draft: "bg-secondary",
        pending: "bg-info text-dark",
        in_progress: "bg-warning text-dark",
        started: "bg-warning text-dark",
        completed: "bg-primary",
        reviewed: "bg-success-subtle text-dark",
        verified: "bg-success",
        cancelled: "bg-danger",
        voided: "bg-dark",
      };
      return s
        ? `<span class="badge ${colorMap[s] || "bg-secondary"}">${s.toUpperCase()}</span>`
        : "—";
    }

    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "department":
      return entry.department?.name || "—";

    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no || ""} ${entry.patient.full_name || ""}`.trim()
        : "—";

    case "doctor":
      return renderUserName(entry.doctor);

    case "labRequest":
      return entry.labRequest?.request_no || "—";

    case "labRequestItem":
      return entry.labRequestItem?.labTest?.name || "—";

    case "labTest":
      return (
        entry.labRequest?.labTest?.name ||
        entry.labRequestItem?.labTest?.name ||
        "—"
      );

    case "result_date":
      return entry.result_date
        ? formatDate(entry.result_date)
        : "—";

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field]
        ? formatDateTime(entry[field])
        : "—";

    case "attachment_url":
      return renderAttachment(entry.attachment_url);

    case "enteredBy":
    case "reviewedBy":
    case "verifiedBy":
    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    default: {
      const v = entry[field];
      if (v === null || v === undefined || v === "") return "—";
      if (typeof v === "object") return "—";
      return v;
    }
  }
}

/* ============================================================
   🗂️ CARD RENDERER — RICH + FULL AUDIT (MASTER)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  return `
    <div class="entity-card lab-result-card">

      <div class="entity-card-header d-flex justify-content-between align-items-center">
        <div>
          <div class="entity-primary">
            ${safe(entry.labRequestItem?.labTest?.name || entry.labTest?.name || "Lab Result")}
          </div>
          ${
            entry.patient
              ? `<div class="entity-secondary">${entry.patient.full_name || ""}</div>`
              : ""
          }
        </div>
        ${
          has("status")
            ? `<span class="entity-status ${status}">${status.toUpperCase()}</span>`
            : ""
        }
      </div>

      <div class="entity-card-context">
        ${entry.organization ? `<div>🏥 ${entry.organization.name}</div>` : ""}
        ${entry.facility ? `<div>📍 ${entry.facility.name}</div>` : ""}
        ${
          entry.result_date
            ? `<div>🗓 ${formatDate(entry.result_date)}</div>`
            : ""
        }
      </div>

      <div class="entity-card-body">
        ${has("result") ? `<div class="entity-field"><span class="entity-label">Result</span><span class="entity-value">${safe(entry.result)}</span></div>` : ""}
        ${has("notes") ? `<div class="entity-field"><span class="entity-label">Notes</span><span class="entity-value">${safe(entry.notes)}</span></div>` : ""}
        ${has("doctor_notes") ? `<div class="entity-field"><span class="entity-label">Doctor Notes</span><span class="entity-value">${safe(entry.doctor_notes)}</span></div>` : ""}
        ${has("attachment_url") ? `<div class="entity-field"><span class="entity-label">Attachment</span><span class="entity-value">${renderAttachment(entry.attachment_url)}</span></div>` : ""}
      </div>

      <details class="entity-notes">
        <summary>Audit</summary>
        <div class="entity-card-body">
          <div class="entity-field"><span class="entity-label">Entered By</span><span class="entity-value">${renderUserName(entry.enteredBy)}</span></div>
          <div class="entity-field"><span class="entity-label">Reviewed By</span><span class="entity-value">${renderUserName(entry.reviewedBy)}</span></div>
          <div class="entity-field"><span class="entity-label">Verified By</span><span class="entity-value">${renderUserName(entry.verifiedBy)}</span></div>
          <div class="entity-field"><span class="entity-label">Created By</span><span class="entity-value">${renderUserName(entry.createdBy)}</span></div>
          <div class="entity-field"><span class="entity-label">Created At</span><span class="entity-value">${formatDateTime(entry.created_at)}</span></div>
          <div class="entity-field"><span class="entity-label">Updated By</span><span class="entity-value">${renderUserName(entry.updatedBy)}</span></div>
          <div class="entity-field"><span class="entity-label">Updated At</span><span class="entity-value">${formatDateTime(entry.updated_at)}</span></div>
          <div class="entity-field"><span class="entity-label">Deleted By</span><span class="entity-value">${renderUserName(entry.deletedBy)}</span></div>
          <div class="entity-field"><span class="entity-label">Deleted At</span><span class="entity-value">${formatDateTime(entry.deleted_at)}</span></div>
        </div>
      </details>

      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getLabResultActionButtons(entry, user)}
             </div>`
          : ""
      }
    </div>
  `;
}
function renderGroupedCard(results, visibleFields, user) {
  const base = results[0];

  const requestLabel = base.labRequest?.request_date
    ? `Request on ${formatDate(base.labRequest.request_date)}`
    : "Lab Request";

  const requestStatus =
    (base.labRequest?.status || "").toUpperCase();
  const patientName =
    base.patient
      ? `${base.patient.pat_no || ""} ${base.patient.first_name || ""} ${base.patient.last_name || ""}`.trim()
      : "—";

  const badge = (s) => {
    const map = {
      draft: "bg-secondary",
      pending: "bg-info text-dark",
      in_progress: "bg-warning text-dark",
      completed: "bg-primary",
      reviewed: "bg-success-subtle text-dark",
      verified: "bg-success",
      cancelled: "bg-danger",
      voided: "bg-dark"
    };
    return s
      ? `<span class="badge ${map[s] || "bg-secondary"} ms-2">${s.toUpperCase()}</span>`
      : "";
  };

  return `
    <div class="entity-card lab-result-card">

    <div class="entity-card-header d-flex justify-content-between align-items-center">
      <div>
        <div class="entity-primary">
          ${requestLabel}
        </div>
        <div class="entity-secondary">
          ${patientName}
        </div>
      </div>

      ${
        requestStatus
          ? `<span class="badge bg-secondary">
              ${requestStatus}
            </span>`
          : ""
      }
    </div>

      <div class="entity-card-body">

        ${results.map(r => {

          const resultStatus = (r.status || "").toLowerCase();
          const itemStatus = (r.labRequestItem?.status || "").toLowerCase();
          const requestStatus = (r.labRequest?.status || "").toLowerCase();

          return `
            <div class="result-block mb-4 p-3 border rounded">

              <div class="d-flex justify-content-between align-items-start flex-wrap">

                <div>
                  <strong>
                    ${r.labRequestItem?.labTest?.name || "Test"}
                  </strong>

                  <span class="badge bg-dark me-1">
                    RESULT: ${resultStatus.toUpperCase()}
                  </span>

                  ${itemStatus ? `
                    <span class="badge bg-light text-dark border me-1">
                      ITEM: ${itemStatus.toUpperCase()}
                    </span>
                  ` : ""}

                  ${requestStatus ? `
                    <span class="badge bg-secondary">
                      REQUEST: ${requestStatus.toUpperCase()}
                    </span>
                  ` : ""}
                </div>

                <div class="export-ignore ms-auto text-end">
                  ${getLabResultActionButtons(r, user)}
                </div>

              </div>

              <div class="mt-3">

                <div><strong>Result:</strong> ${safe(r.result)}</div>

                ${r.notes ? `<div><strong>Notes:</strong> ${safe(r.notes)}</div>` : ""}
                ${r.doctor_notes ? `<div><strong>Doctor Notes:</strong> ${safe(r.doctor_notes)}</div>` : ""}

                ${r.department?.name ? `<div><strong>Department:</strong> ${r.department.name}</div>` : ""}
                ${r.doctor ? `<div><strong>Doctor:</strong> ${renderUserName(r.doctor)}</div>` : ""}

                ${r.result_date ? `<div><strong>Result Date:</strong> ${formatDate(r.result_date)}</div>` : ""}
                ${r.reviewed_at ? `<div><strong>Reviewed At:</strong> ${formatDateTime(r.reviewed_at)}</div>` : ""}
                ${r.verified_at ? `<div><strong>Verified At:</strong> ${formatDateTime(r.verified_at)}</div>` : ""}

                ${r.attachment_url ? `<div><strong>Attachment:</strong> ${renderAttachment(r.attachment_url)}</div>` : ""}

              </div>

              <details class="mt-3">
                <summary>Audit Trail</summary>
                <div class="mt-2 small row">

                  <div class="col-12 col-lg-6">
                    <strong>Entered By:</strong> ${renderUserName(r.enteredBy)}
                  </div>

                  <div class="col-12 col-lg-6">
                    <strong>Reviewed By:</strong> ${renderUserName(r.reviewedBy)}
                  </div>

                  <div class="col-12 col-lg-6">
                    <strong>Verified By:</strong> ${renderUserName(r.verifiedBy)}
                  </div>

                  <div class="col-12 col-lg-6">
                    <strong>Created By:</strong> ${renderUserName(r.createdBy)}
                  </div>

                  <div class="col-12 col-lg-6">
                    <strong>Updated By:</strong> ${renderUserName(r.updatedBy)}
                  </div>

                  <div class="col-12 col-lg-6">
                    <strong>Created At:</strong> ${formatDateTime(r.created_at)}
                  </div>

                  <div class="col-12 col-lg-6">
                    <strong>Updated At:</strong> ${formatDateTime(r.updated_at)}
                  </div>

                </div>
              </details>

            </div>
          `;
        }).join("")}

      </div>

    </div>
  `;
}
function groupByLabRequest(entries) {
  const map = new Map();

  entries.forEach((e) => {
    const key = e.lab_request_id || e.labRequest?.id || "unknown";

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(e);
  });

  return Array.from(map.values());
}
/* ============================================================
   📋 LIST RENDERER
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("labResultTableBody");
  const cardContainer = document.getElementById("labResultList");
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
            No lab results found.
          </td>
        </tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">${getLabResultActionButtons(e, user)}</td>`
            : `<td>${renderValue(e, f, "table")}</td>`
        )
        .join("");
      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");
    const grouped = groupByLabRequest(entries);

    cardContainer.innerHTML = grouped.length
      ? grouped.map(group =>
          renderGroupedCard(group, visibleFields, user)
        ).join("")
      : `<p class="text-center text-muted">No lab results found.</p>`;
    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📤 EXPORT (MASTER)
============================================================ */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Lab Results Report";

  document.getElementById("exportCSVBtn")?.addEventListener("click", () =>
    exportData({ type: "csv", data: entries, title })
  );
  document.getElementById("exportExcelBtn")?.addEventListener("click", () =>
    exportData({ type: "xlsx", data: entries, title })
  );
  document.getElementById("exportPDFBtn")?.addEventListener("click", () =>
    exportData({
      type: "pdf",
      title,
      selector: ".table-container.active, #labResultList.active",
      orientation: "landscape",
    })
  );
}