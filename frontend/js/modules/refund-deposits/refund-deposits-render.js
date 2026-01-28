// 📦 refund-deposits-render.js – Entity Card System (REFUND DEPOSIT | ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH deposit-render.js
// 🔹 Table = flat | Card = RICH + structured (ALL fields supported)
// 🔹 Field-selector safe
// 🔹 Status-action-matrix driven actions
// 🔹 Full lifecycle + audit visibility
// 🔹 Export-safe (no object leaks)
// ============================================================================

import { FIELD_LABELS_REFUND_DEPOSIT } from "./refund-deposits-constants.js";
import { formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";

/* ============================================================
   🎛️ ACTIONS
============================================================ */
function getRefundDepositActionButtons(entry, user) {
  return buildActionButtons({
    module: "refund_deposit",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "refund-deposits",
  });
}

/* ============================================================
   🧱 TABLE HEAD (FIELD-SELECTOR SAFE)
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
      FIELD_LABELS_REFUND_DEPOSIT[field] || field.replace(/_/g, " ");

    if (field === "actions") {
      th.textContent = "Actions";
      th.classList.add("actions-cell");
      tr.appendChild(th);
      return;
    }

    th.innerHTML = `<span>${label}</span>`;
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================
   🔠 HELPERS
============================================================ */
const safe = (v) =>
  v !== null && v !== undefined && v !== "" ? v : "—";

function renderUserName(u) {
  if (!u) return "—";
  if (typeof u === "string") return u;
  return (
    [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ") ||
    u.full_name ||
    "—"
  );
}

function renderPatient(entry) {
  const p = entry.patient;
  if (!p) return "—";
  if (typeof p === "string") return p;
  return `${p.pat_no || "—"} - ${[p.first_name, p.middle_name, p.last_name]
    .filter(Boolean)
    .join(" ")}`;
}

function renderDeposit(entry) {
  const d = entry.deposit;
  if (!d) return "—";
  if (typeof d === "string") return d;

  const ref = d.transaction_ref || "—";
  const amt = Number(d.amount || 0).toFixed(2);
  const bal = Number(d.remaining_balance ?? d.balance ?? 0).toFixed(2);
  const method = (d.method || "").toUpperCase();

  return `
    ${ref}
    <br><small>$${amt} | Bal: $${bal} | ${method}</small>
  `;
}

/* ============================================================
   🧩 VALUE RENDERER (OBJECT-SAFE)
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const s = (entry.status || "").toLowerCase();
      const map = {
        pending: "bg-warning text-dark",
        reviewed: "bg-info text-dark",
        approved: "bg-primary",
        processed: "bg-success",
        reversed: "bg-danger text-white",
        rejected: "bg-danger text-white",
        cancelled: "bg-secondary",
        voided: "bg-dark text-light",
        restored: "bg-secondary",
      };
      return `<span class="badge ${map[s] || "bg-secondary"}">${s.toUpperCase()}</span>`;
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
    case "reason":
      return safe(entry[field]);

    // --- USERS ---
    case "createdBy":
    case "updatedBy":
    case "deletedBy":
    case "approvedBy":
    case "processedBy":
    case "reversedBy":
    case "voidedBy":
    case "restoredBy":
    case "reviewedBy":
    case "rejectedBy":
    case "cancelledBy":
      return renderUserName(entry[field]);

    // --- DATES ---
    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "approved_at":
    case "processed_at":
    case "reversed_at":
    case "voided_at":
    case "restored_at":
    case "reviewed_at":
    case "rejected_at":
    case "cancelled_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    default: {
      const v = entry[field];
      if (v == null) return "—";
      if (typeof v === "object") return "—";
      return v;
    }
  }
}

/* ============================================================
   🗂️ CARD RENDERER — RICH (ALL FIELDS LIKE TABLE)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const row = (label, value) => {
    if (value === undefined || value === null || value === "") return "";
    return `
      <div class="entity-field">
        <span class="entity-label">${label}</span>
        <span class="entity-value">${value}</span>
      </div>
    `;
  };

  return `
    <div class="entity-card refund-deposit-card">
      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${renderPatient(entry)}</div>
          <div class="entity-primary">
            $${Number(entry.refund_amount || 0).toFixed(2)}
          </div>
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
        ${entry.method ? `<div>💳 ${entry.method}</div>` : ""}
      </div>

      <div class="entity-card-body">
        ${visibleFields
          .filter(
            (f) =>
              ![
                "actions",
                "createdBy",
                "created_at",
                "updatedBy",
                "updated_at",
                "deletedBy",
                "deleted_at",
              ].includes(f)
          )
          .map(
            (f) =>
              row(
                FIELD_LABELS_REFUND_DEPOSIT[f] || f,
                renderValue(entry, f)
              )
          )
          .join("")}
      </div>

      <details class="entity-notes">
        <summary>Audit</summary>
        <div class="entity-card-body">
          ${row("Created By", renderUserName(entry.createdBy))}
          ${row("Created At", formatDate(entry.created_at))}
          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row("Updated At", formatDate(entry.updated_at))}
        </div>
      </details>

      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getRefundDepositActionButtons(entry, user)}
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
  const tableBody = document.getElementById("refundDepositTableBody");
  const cardContainer = document.getElementById("refundDepositList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");
    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No deposit refunds found.</td></tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">${getRefundDepositActionButtons(
                e,
                user
              )}</td>`
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
      : `<p class="text-center text-muted">No deposit refunds found.</p>`;
    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📤 EXPORT
============================================================ */
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
      selector: ".table-container.active, #refundDepositList.active",
      orientation: "landscape",
    })
  );
}
