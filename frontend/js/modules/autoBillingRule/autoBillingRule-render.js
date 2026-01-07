// 📁 autoBillingRule-render.js – Auto Billing Rule Table & Card Renderers (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: billableitem-render.js / vital-render.js
// 🔹 Full enterprise consistency: permissions, UI logic, tooltips, exports
// 🔹 Integrates STATUS_ACTION_MATRIX + buildActionButtons
// 🔹 Supports trigger_feature_module (Feature Module linkage)
// 🔹 100% ID-safe (autoBillingRuleTableBody / autoBillingRuleList / tableViewBtn, etc.)
// ============================================================================

import { FIELD_LABELS_AUTO_BILLING_RULE } from "./autoBillingRule-constants.js";
import { formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";

/* ============================================================
   🎛️ Action Buttons (Centralized)
============================================================ */
function getAutoBillingRuleActionButtons(entry, user) {
  return buildActionButtons({
    module: "auto_billing_rule",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "auto_billing_rules",
  });
}

/* ============================================================
   🧱 Dynamic Table Head Renderer
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent =
      FIELD_LABELS_AUTO_BILLING_RULE[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================
   🔠 Field Render Helpers
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.full_name || user.username || "—";
}

function renderBoolean(value) {
  if (value === true) return `<span class="text-success">Yes</span>`;
  if (value === false) return `<span class="text-danger">No</span>`;
  return "—";
}

function renderValue(entry, field) {
  switch (field) {
    /* ---------- Status ---------- */
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const colorMap = {
        active: "bg-success",
        inactive: "bg-warning text-dark",
        deleted: "bg-danger",
        voided: "bg-dark",
      };
      return raw
        ? `<span class="badge ${colorMap[raw] || "bg-secondary"}">${label}</span>`
        : "—";
    }

    /* ---------- Boolean ---------- */
    case "auto_generate":
      return renderBoolean(entry.auto_generate);

    /* ---------- Relations ---------- */
    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    /* ---------- Feature Module ---------- */
    case "trigger_feature_module":
      return (
        entry.trigger_feature_module?.name ||
        entry.featureModule?.name ||
        entry.feature_module?.name ||
        "—"
      );

    case "trigger_module":
      return entry.trigger_module || "—";

    case "billableItem":
      if (entry.billableItem)
        return entry.billableItem.code
          ? `${entry.billableItem.name} (${entry.billableItem.code})`
          : entry.billableItem.name;
      return "—";

    /* ---------- Numeric / Pricing ---------- */
    case "charge_mode":
      return entry.charge_mode || "—";

    case "default_price":
      return entry.default_price != null
        ? `$${Number(entry.default_price).toFixed(2)}`
        : "—";

    /* ---------- Users ---------- */
    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    /* ---------- Timestamps ---------- */
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    /* ---------- Fallback ---------- */
    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🗂️ Card Renderer
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const details = visibleFields
    .filter((f) => f !== "actions")
    .map(
      (f) => `
        <p><strong>${FIELD_LABELS_AUTO_BILLING_RULE[f] || f}:</strong> 
        ${renderValue(entry, f)}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getAutoBillingRuleActionButtons(entry, user)}
        </div>
      </div>`
    : "";

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${details}</div>
      ${footer}
    </div>`;
}

/* ============================================================
   📋 Main List Renderer
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("autoBillingRuleTableBody");
  const cardContainer = document.getElementById("autoBillingRuleList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No auto billing rules found.</td></tr>`;

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = noData;
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) => {
          const val =
            f === "actions"
              ? `<div class="table-actions export-ignore">${getAutoBillingRuleActionButtons(entry, user)}</div>`
              : renderValue(entry, f);
          const cls = f === "actions" ? ' class="text-center actions-cell"' : "";
          return `<td${cls}>${val}</td>`;
        })
        .join("");
      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.remove("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center py-3">No auto billing rules found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📤 Export Handlers (CSV, Excel, PDF)
============================================================ */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Auto Billing Rules Report";

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
      selector: ".table-container",
      orientation: "landscape",
    });
  });
}
