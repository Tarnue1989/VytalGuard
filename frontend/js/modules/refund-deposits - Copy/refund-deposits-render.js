// 📦 refundDeposit-render.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors refund-render.js, but for DEPOSIT REFUNDS
// 🔹 Supports role-based visibility, tooltips, exports, and STATUS_ACTION_MATRIX
// 🔹 Clean human-readable deposit display (transaction_ref, NOT UUID)
// ============================================================================

import { FIELD_LABELS_REFUND_DEPOSIT } from "./refund-deposits-constants.js";
import { formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";

/* ============================================================================
   🎛️ Action Buttons (centralized + permission-driven)
============================================================================ */
function getDepositRefundActionButtons(entry, user) {
  return buildActionButtons({
    module: "refund_deposit",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "refund-deposits",
  });
}

/* ============================================================================
   🧱 Dynamic Table Head Renderer
============================================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent =
      FIELD_LABELS_REFUND_DEPOSIT[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================================
   🔠 Render Helpers
============================================================================ */

function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : (user.full_name || "—");
}

function renderPatient(entry) {
  const p = entry.patient;
  if (!p) return "—";

  const name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
  return `${p.pat_no || "—"} - ${name || "Unnamed"}`;
}

/* ============================================================================
   ⭐ NEW — Proper human-readable deposit renderer
============================================================================ */
function renderDeposit(entry) {
  const d = entry.deposit;
  if (!d) return "—";

  const ref = d.transaction_ref || "—";
  const amt = Number(d.amount || 0).toFixed(2);
  const bal = Number(d.remaining_balance ?? d.balance ?? 0).toFixed(2);
  const method = (d.method || "").toUpperCase();

  return `
    Deposit ${ref}
    <br><small>Amount: $${amt} — Balance: $${bal} — ${method}</small>
  `;
}

/* ============================================================================
   🔍 Main Field Renderer
============================================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);

      const colorMap = {
        pending: "bg-warning text-dark",
        approved: "bg-primary",
        processed: "bg-success",
        reversed: "bg-danger text-white",
        voided: "bg-dark text-light",
        restored: "bg-info text-dark",
      };

      return `<span class="badge ${colorMap[raw] || "bg-secondary"}">${label}</span>`;
    }

    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    case "patient":
      return renderPatient(entry);

    case "deposit":
      return renderDeposit(entry);

    case "refund_amount":
      return `$${Number(entry.refund_amount || 0).toFixed(2)}`;

    case "method":
      return entry.method || "—";

    case "reason":
      return entry.reason || "—";

    /* --- Audit / Lifecycle Users --- */
    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);
    case "approvedBy":
      return renderUserName(entry.approvedBy);
    case "processedBy":
      return renderUserName(entry.processedBy);
    case "reversedBy":
      return renderUserName(entry.reversedBy);

    /* --- Dates --- */
    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "approved_at":
    case "processed_at":
    case "reversed_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================================
   🗂️ Card Renderer
============================================================================ */
export function renderCard(entry, visibleFields, user) {
  const details = visibleFields
    .filter((f) => f !== "actions")
    .map(
      (f) => `
        <p><strong>${FIELD_LABELS_REFUND_DEPOSIT[f] || f}:</strong>
        ${renderValue(entry, f)}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getDepositRefundActionButtons(entry, user)}
        </div>
      </div>`
    : "";

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${details}</div>
      ${footer}
    </div>`;
}

/* ============================================================================
   📋 Main List Renderer (Table + Card)
============================================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("refundDepositTableBody");
  const cardContainer = document.getElementById("refundDepositList");
  const tableContainer = document.querySelector(".table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  document.getElementById("tableViewBtn")?.classList.toggle("active", viewMode === "table");
  document.getElementById("cardViewBtn")?.classList.toggle("active", viewMode === "card");

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No deposit refunds found.</td></tr>`;

  /* -------------------- TABLE VIEW -------------------- */
  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = noData;
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");

      tr.innerHTML = visibleFields
        .map((f) => {
          const cell =
            f === "actions"
              ? `<div class="table-actions export-ignore">${getDepositRefundActionButtons(entry, user)}</div>`
              : renderValue(entry, f);

          return `<td class="${f === "actions" ? "actions-cell text-center" : ""}">${cell}</td>`;
        })
        .join("");

      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);
  }

  /* -------------------- CARD VIEW -------------------- */
  else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center py-3">No deposit refunds found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================================
   📤 Export Handlers
============================================================================ */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Deposit Refunds Report";

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
      selector: ".table-container",
      orientation: "landscape",
    })
  );
}
