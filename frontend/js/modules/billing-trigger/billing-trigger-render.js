// 📁 billing-trigger-render.js – Entity Card System (Enterprise Master)
// ============================================================================
// 🧭 Matches patient / appointment entity-card architecture
// 🔹 Table = flat | Card = structured
// 🔹 Field-selector safe
// 🔹 Boolean status handled correctly
// 🔹 FULLY aligned with BillingTrigger controller + permissions
// ============================================================================

import { FIELD_LABELS_BILLING_TRIGGER } from "./billing-trigger-constants.js";
import {
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";

/* ============================================================
   🎛️ Action Buttons
============================================================ */
function getBillingTriggerActionButtons(entry, user) {
  return buildActionButtons({
    module: "billing_trigger",
    status: entry.is_active ? "active" : "inactive",
    entryId: entry.id,
    user,
    permissionPrefix: "billing_trigger", // ✅ FIXED
  });
}

/* ============================================================
   🧱 Dynamic Table Head
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
      FIELD_LABELS_BILLING_TRIGGER[field] || field.replace(/_/g, " ");
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
    col.style.width = "160px";
    colgroup.appendChild(col);
  });

  table.prepend(colgroup);
  enableColumnResize(table);
}

/* ============================================================
   🔠 Helpers
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.email || "—";
}

/* ============================================================
   🧩 Field Value Renderer (TABLE + CARD)
============================================================ */
function renderValue(entry, field, viewMode = "card") {
  switch (field) {
    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    case "is_active":
      return entry.is_active
        ? `<span class="badge bg-success">ACTIVE</span>`
        : `<span class="badge bg-secondary">INACTIVE</span>`;

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default:
      return entry[field] != null && entry[field] !== ""
        ? String(entry[field])
        : "—";
  }
}

/* ============================================================
   🗂️ CARD RENDERER — ENTITY SYSTEM (BILLING TRIGGER)
   Clean / Non-Redundant / Enterprise
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

  /* ================= HEADER ================= */
  const header = `
    <div class="entity-card-header">
      <div>
        <div class="entity-secondary">${safe(entry.module_key)}</div>
        <div class="entity-primary">${safe(entry.trigger_status)}</div>
      </div>
      <span class="entity-status ${entry.is_active ? "active" : "inactive"}">
        ${entry.is_active ? "ACTIVE" : "INACTIVE"}
      </span>
    </div>
  `;

  /* ================= CONTEXT (ORG / FACILITY) ================= */
  const contextItems = [];
  if (has("organization"))
    contextItems.push(`🏢 ${safe(entry.organization?.name)}`);
  if (has("facility"))
    contextItems.push(`🏥 ${safe(entry.facility?.name)}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map(v => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  /* ================= BODY (MINIMAL) ================= */
  const bodyFields = [];

  if (has("module_key"))
    bodyFields.push(fieldRow("Module Key", entry.module_key));

  if (has("trigger_status"))
    bodyFields.push(fieldRow("Trigger Status", entry.trigger_status));

  const body = bodyFields.length
    ? `<div class="entity-card-body">
         <div>${bodyFields.join("")}</div>
       </div>`
    : "";

  /* ================= AUDIT ================= */
  const audit =
    has("created_at") || has("updated_at")
      ? `<details class="entity-notes">
           <summary>Audit</summary>
           <div class="entity-card-body">
             <div>
               ${has("createdBy") ? fieldRow("Created By", renderValue(entry, "createdBy")) : ""}
               ${has("created_at") ? fieldRow("Created At", renderValue(entry, "created_at")) : ""}
             </div>
             <div>
               ${has("updatedBy") ? fieldRow("Updated By", renderValue(entry, "updatedBy")) : ""}
               ${has("updated_at") ? fieldRow("Updated At", renderValue(entry, "updated_at")) : ""}
             </div>
           </div>
         </details>`
      : "";

  /* ================= ACTIONS (ALWAYS SHOW) ================= */
  const actions = `
    <div class="entity-card-footer">
      ${getBillingTriggerActionButtons(entry, user)}
    </div>
  `;

  /* ================= FINAL ================= */
  return `
    <div class="entity-card billing-trigger-card">
      ${header}
      ${context}
      ${body}
      ${audit}
      ${actions}
    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER (TABLE + CARD)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("billingTriggerTableBody");
  const cardContainer = document.getElementById("billingTriggerList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No billing triggers found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((field) =>
          field === "actions"
            ? `<td class="actions-cell text-center export-ignore">
                ${getBillingTriggerActionButtons(entry, user)}
               </td>`
            : `<td>${renderValue(entry, field, "table")}</td>`
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
      : `<p class="text-muted">No billing triggers found.</p>`;

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

  const title = "Billing Triggers Report";

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
      selector: ".table-container.active, #billingTriggerList.active",
      orientation: "landscape",
    });
  });
}
