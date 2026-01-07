// 📁 newborn-record-render.js – Newborn Record table & card renderers

import { FIELD_LABELS_NEWBORN_RECORD } from "./newborn-record-constants.js";
import { formatDate } from "../../utils/ui-utils.js";
import { exportData } from "../../utils/export-utils.js";  // ⬅️ enterprise export engine

/* ----------------------------- helpers ----------------------------- */

// ▶️ Bootstrap tooltips (safe no-op if bootstrap not loaded)
function initTooltips(scope = document) {
  if (!window.bootstrap) return;
  const triggers = [].slice.call(scope.querySelectorAll("[data-bs-toggle='tooltip']"));
  triggers.forEach((el) => {
    if (!bootstrap.Tooltip.getInstance(el)) {
      new bootstrap.Tooltip(el);
    }
  });
}

/* --------------------------- action buttons --------------------------- */
function getNewbornActionButtons(entry, userRole) {
  // 🔑 Normalize role
  let role = (userRole || "").trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  const status = (entry.status || "").toLowerCase();
  const canDelete = role === "admin" || role === "superadmin";
  const canVoid   = role === "admin" || role === "superadmin";

  // 🧩 Core actions (view/edit/delete)
  const coreBtns = [];

  // 👁 Always allow view
  coreBtns.push(`
    <button class="btn btn-outline-primary btn-sm view-btn" data-id="${entry.id}"
      data-bs-toggle="tooltip" data-bs-title="View" aria-label="View newborn record">
      <i class="fas fa-eye"></i>
    </button>
  `);

  // ✏️ Allow edit only if record is not in terminal state
  if (status === "alive") {
    coreBtns.push(`
      <button class="btn btn-outline-success btn-sm edit-btn" data-id="${entry.id}"
        data-bs-toggle="tooltip" data-bs-title="Edit" aria-label="Edit newborn record">
        <i class="fas fa-pen"></i>
      </button>
    `);
  }

  // 🛠 Lifecycle actions
  let lifecycleBtns = "";

  if (status === "alive") {
    lifecycleBtns += lifecycleBtn(entry.id, "deceased", "Mark Deceased", "fa-skull-crossbones", "danger");
    lifecycleBtns += lifecycleBtn(entry.id, "transfer", "Transfer", "fa-ambulance", "warning");
  }

  // 🚫 Void allowed for admin/superadmin unless already voided/deleted
  if (canVoid && !["voided", "deleted"].includes(status)) {
    lifecycleBtns += lifecycleBtn(entry.id, "void", "Void Record", "fa-times-circle", "secondary");
  }

  // 🗑 Delete only for admin/superadmin, and only in non-locked states
  if (canDelete && ["alive", "transferred"].includes(status)) {
    lifecycleBtns += lifecycleBtn(entry.id, "delete", "Delete", "fa-trash", "danger");
  }

  return `<div class="d-inline-flex gap-1">${coreBtns.join("")}${lifecycleBtns}</div>`;
}

function lifecycleBtn(id, action, title, icon, color) {
  return `
    <button class="btn btn-outline-${color} btn-sm ${action}-btn" data-id="${id}"
      data-bs-toggle="tooltip" data-bs-title="${title}" aria-label="${title}">
      <i class="fas ${icon}"></i>
    </button>
  `;
}

/* ------------------------- dynamic table head ------------------------- */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = FIELD_LABELS_NEWBORN_RECORD[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ---------------------------- field render ---------------------------- */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.full_name || user.email || "—";
}

function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const map = {
        alive: "bg-success",
        deceased: "bg-danger",
        transferred: "bg-warning text-dark",
        voided: "bg-dark",
      };
      return raw ? `<span class="badge ${map[raw] || "bg-secondary"}">${label}</span>` : "—";
    }

    case "organization": return entry.organization?.name || "—";
    case "facility": return entry.facility?.name || "—";
    case "mother":
      return entry.mother
        ? `${entry.mother.pat_no || ""} ${entry.mother.first_name || ""} ${entry.mother.last_name || ""}`
        : "—";

    case "deliveryRecord":
      if (entry.deliveryRecord) {
        const date = entry.deliveryRecord.delivery_date
          ? formatDate(entry.deliveryRecord.delivery_date)
          : null;
        const status = entry.deliveryRecord.status || "";
        return `${date || "—"} ${status ? `(${status})` : ""}`;
      }
      return "—";

    case "transferFacility": return entry.transferFacility?.name || "—";
    case "createdBy": return renderUserName(entry.createdBy);
    case "updatedBy": return renderUserName(entry.updatedBy);
    case "deletedBy": return renderUserName(entry.deletedBy);
    case "voidedBy": return renderUserName(entry.voidedBy);

    // 🕒 lifecycle + audit timestamps
    case "death_time": return entry.death_time ? formatDate(entry.death_time) : "—";
    case "transfer_time": return entry.transfer_time ? formatDate(entry.transfer_time) : "—";
    case "voided_at": return entry.voided_at ? formatDate(entry.voided_at) : "—";
    case "created_at": return entry.created_at ? formatDate(entry.created_at) : "—";
    case "updated_at": return entry.updated_at ? formatDate(entry.updated_at) : "—";
    case "deleted_at": return entry.deleted_at ? formatDate(entry.deleted_at) : "—";

    default:
      return entry[field] != null ? String(entry[field]) : "—";
  }
}

/* ---------------------------- card renderer --------------------------- */
export function renderCard(entry, visibleFields, userRole) {
  let html = "";

  visibleFields.forEach((field) => {
    if (field === "actions") return;
    const label = FIELD_LABELS_NEWBORN_RECORD[field] || field.replace(/_/g, " ");
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getNewbornActionButtons(entry, userRole)}
        </div>
      </div>
    </div>
  `;
}

/* ----------------------------- list render ---------------------------- */
export function renderList({ entries, visibleFields, viewMode, userRole }) {
  const tableBody = document.getElementById("newbornRecordTableBody");
  const cardContainer = document.getElementById("newbornRecordList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No newborn records found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      let rowHTML = "";
      visibleFields.forEach((field) => {
        const value =
          field === "actions"
            ? `<div class="table-actions export-ignore">${getNewbornActionButtons(entry, userRole)}</div>`
            : renderValue(entry, field);

        const tdClass = field === "actions"
          ? ' class="actions-cell text-center"'
          : "";

        rowHTML += `<td${tdClass}>${value}</td>`;
      });
      row.innerHTML = rowHTML;
      tableBody.appendChild(row);
    });

    initTooltips(tableBody);

  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.remove("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, userRole)).join("")
      : `<p class="text-muted">No newborn records found.</p>`;

    initTooltips(cardContainer);
  }

  // ⚡ Setup Export Buttons (bind once)
  setupExportHandlers(entries);
}

/* -------------------------- export handlers --------------------------- */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return; // prevent duplicate binding
  exportHandlersBound = true;

  const title = "Newborn Records Report";

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

/* ----------------------------- modal helper ---------------------------- */
export function showNewbornModal(title, bodyHtml, size = "lg") {
  let modalEl = document.getElementById("newbornActionModal");

  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "newbornActionModal";
    modalEl.className = "modal fade";
    modalEl.tabIndex = -1;
    modalEl.setAttribute("aria-hidden", "true");

    modalEl.innerHTML = `
      <div class="modal-dialog modal-${size} modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"></h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
  } else {
    // update dialog size dynamically
    const dialog = modalEl.querySelector(".modal-dialog");
    dialog.className = `modal-dialog modal-${size} modal-dialog-centered`;
  }

  modalEl.querySelector(".modal-title").innerHTML = title;
  modalEl.querySelector(".modal-body").innerHTML = bodyHtml;

  // Create bootstrap modal instance
  const modal = new bootstrap.Modal(modalEl, { backdrop: "static" });
  modal.show();

  return {
    modal,
    el: modalEl,
    close: () => modal.hide(),
  };
}
