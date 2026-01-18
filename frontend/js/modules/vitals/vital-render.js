// 📁 vital-render.js – Entity Card System (Vital | MASTER)
// ============================================================================
// 🧭 Mirrors department-render.js architecture exactly
// 🔹 Table = flat | Card = structured
// 🔹 Field-selector safe
// 🔹 Resizable table columns
// 🔹 Permission-driven actions (STATUS_ACTION_MATRIX)
// 🔹 OBJECT-SAFE (no [object Object] leaks)
// ============================================================================

import { FIELD_LABELS_VITAL } from "./vital-constants.js";
import { formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";

/* ============================================================
   🎛️ Action Buttons
============================================================ */
function getVitalActionButtons(entry, user) {
  return buildActionButtons({
    module: "vital",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "vitals",
  });
}

/* ============================================================
   🧱 Dynamic Table Head (RESIZABLE — MASTER)
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  const table = thead?.closest("table");
  if (!thead || !table) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent =
      FIELD_LABELS_VITAL[field] || field.replace(/_/g, " ");
    th.dataset.key = field;
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);

  let colgroup = table.querySelector("colgroup");
  if (colgroup) colgroup.remove();

  colgroup = document.createElement("colgroup");
  visibleFields.forEach(() => {
    const col = document.createElement("col");
    col.style.width = "150px";
    colgroup.appendChild(col);
  });

  table.prepend(colgroup);
  enableColumnResize(table);
}

/* ============================================================
   🔠 Helpers (OBJECT SAFE)
============================================================ */
function renderUserName(user) {
  if (!user || typeof user !== "object") return "—";
  return [user.first_name, user.middle_name, user.last_name]
    .filter(Boolean)
    .join(" ") || "—";
}

function renderPatient(entry) {
  const p = entry.patient;
  if (!p || typeof p !== "object") return "—";
  const no = p.pat_no || "—";
  const name = [p.first_name, p.middle_name, p.last_name]
    .filter(Boolean)
    .join(" ");
  return `${no} - ${name || "Unnamed"}`;
}

function renderConsultation(entry) {
  const c = entry.consultation;
  if (!c || typeof c !== "object") return "—";
  if (c.diagnosis) return `${c.status || "—"} · ${c.diagnosis}`;
  return c.status || "—";
}

function renderAdmission(entry) {
  const a = entry.admission;
  if (!a || typeof a !== "object") return "—";
  return a.status || "—";
}

function renderTriage(entry) {
  const t = entry.triageRecord;
  if (!t || typeof t !== "object") return "—";
  return t.triage_status || "—";
}

function renderStatusBadge(status) {
  const raw = (status || "").toLowerCase();
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);

  let cls = "bg-secondary";
  if (raw === "open") cls = "bg-info";
  if (raw === "in_progress") cls = "bg-warning text-dark";
  if (raw === "completed") cls = "bg-primary";
  if (raw === "verified") cls = "bg-success";
  if (raw === "cancelled") cls = "bg-danger";
  if (raw === "voided") cls = "bg-dark";

  return `<span class="badge ${cls}">${label}</span>`;
}

/* ============================================================
   🧩 Field Value Renderer (NO OBJECT LEAKS)
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status":
      return renderStatusBadge(entry.status);

    case "patient":
      return renderPatient(entry);

    case "nurse":
      return renderUserName(entry.nurse);

    case "consultation":
      return renderConsultation(entry);

    case "admission":
      return renderAdmission(entry);

    case "triageRecord":
    case "triage_record":
      return renderTriage(entry);

    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "recorded_at":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default:
      return entry[field] !== null &&
        entry[field] !== undefined &&
        typeof entry[field] !== "object"
        ? String(entry[field])
        : "—";
  }
}

/* ============================================================
   🗂️ CARD RENDERER — ENTITY SYSTEM (VITAL)
   - Mirrors APPOINTMENT renderer 1:1
   - 2-column body
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = f => visibleFields.includes(f);
  const safe = v => (v !== null && v !== undefined && v !== "" ? v : "—");

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
        ${has("recorded_at")
          ? `<div class="entity-secondary">${formatDateTime(entry.recorded_at)}</div>`
          : ""}
        ${has("patient")
          ? `<div class="entity-primary">${renderPatient(entry)}</div>`
          : ""}
      </div>
      ${
        has("status")
          ? `<span class="entity-status ${status}">
               ${status.replace(/_/g, " ").toUpperCase()}
             </span>`
          : ""
      }
    </div>
  `;

  /* ================= CONTEXT ================= */
  const contextItems = [];
  if (has("organization")) contextItems.push(`🏥 ${safe(entry.organization?.name)}`);
  if (has("facility")) contextItems.push(`📍 ${safe(entry.facility?.name)}`);
  if (has("nurse")) contextItems.push(`👤 ${renderUserName(entry.nurse)}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map(v => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  /* ================= BODY (2 COL — SAME AS APPOINTMENT) ================= */
  const left = [];
  const right = [];

  /* LEFT */
  if (has("bp")) left.push(fieldRow("Blood Pressure", entry.bp));
  if (has("pulse")) left.push(fieldRow("Pulse", entry.pulse));
  if (has("temp")) left.push(fieldRow("Temperature", entry.temp));
  if (has("oxygen")) left.push(fieldRow("SpO₂", entry.oxygen));
  if (has("weight")) left.push(fieldRow("Weight", entry.weight));

  /* RIGHT */
  if (has("height")) right.push(fieldRow("Height", entry.height));
  if (has("rr")) right.push(fieldRow("Resp. Rate", entry.rr));
  if (has("position")) right.push(fieldRow("Position", entry.position));
  if (has("pain_score")) right.push(fieldRow("Pain Score", entry.pain_score));
  if (has("rbg")) right.push(fieldRow("RBG", entry.rbg));

  const body = `
    <div class="entity-card-body">
      <div>${left.join("")}</div>
      <div>${right.join("")}</div>
    </div>
  `;

  /* ================= AUTO EXTRA (NON-AUDIT) ================= */
  const usedFields = new Set([
    "recorded_at","status","patient","organization","facility","nurse",
    "bp","pulse","temp","oxygen","weight",
    "height","rr","position","pain_score","rbg",
    "createdBy","updatedBy","deletedBy",
    "created_at","updated_at","deleted_at",
    "notes","actions"
  ]);

  const extras = visibleFields
    .filter(f => !usedFields.has(f))
    .map(f =>
      fieldRow(
        FIELD_LABELS_VITAL[f] || f,
        renderValue(entry, f)
      )
    );

  const mid = Math.ceil(extras.length / 2);

  const extrasSection = extras.length
    ? `<details class="entity-notes">
         <summary>More Details</summary>
         <div class="entity-card-body">
           <div>${extras.slice(0, mid).join("")}</div>
           <div>${extras.slice(mid).join("")}</div>
         </div>
       </details>`
    : "";

  /* ================= AUDIT ================= */
  const audit =
    has("created_at") || has("updated_at")
      ? `<details class="entity-notes">
           <summary>Audit</summary>
           <div class="entity-card-body">
             <div>
               ${has("createdBy")
                 ? fieldRow("Created By", renderValue(entry, "createdBy"))
                 : ""}
               ${has("created_at")
                 ? fieldRow("Created At", renderValue(entry, "created_at"))
                 : ""}
             </div>
             <div>
               ${has("updatedBy")
                 ? fieldRow("Updated By", renderValue(entry, "updatedBy"))
                 : ""}
               ${has("updated_at")
                 ? fieldRow("Updated At", renderValue(entry, "updated_at"))
                 : ""}
             </div>
           </div>
         </details>`
      : "";

  /* ================= NOTES ================= */
  const notes =
    has("notes") && entry.notes
      ? `<details class="entity-notes">
           <summary>Notes</summary>
           <p>${entry.notes}</p>
         </details>`
      : "";

  /* ================= ACTIONS ================= */
  const actions = has("actions")
    ? `<div class="entity-card-footer">
         ${getVitalActionButtons(entry, user)}
       </div>`
    : "";

  return `
    <div class="entity-card vital-card">
      ${header}
      ${context}
      ${body}
      ${extrasSection}
      ${audit}
      ${notes}
      ${actions}
    </div>
  `;
}


/* ============================================================
   📋 LIST RENDERER
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("vitalTableBody");
  const cardContainer = document.getElementById("vitalList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");
    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No vitals found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((field) =>
          field === "actions"
            ? `<td class="actions-cell text-center export-ignore">
                 ${getVitalActionButtons(entry, user)}
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
      ? entries.map(e => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted">No vitals found.</p>`;
    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📤 Export Handlers
============================================================ */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Vitals Report";

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
      selector: ".table-container.active, #vitalList.active",
      orientation: "landscape",
    })
  );
}
