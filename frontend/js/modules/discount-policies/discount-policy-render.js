// 📁 discount-policy-render.js – Discount Policy table & card renderers
import { FIELD_LABELS_DISCOUNT_POLICY } from "./discount-policy-constants.js";
import { formatDate } from "../../utils/ui-utils.js";
import { exportData } from "../../utils/export-utils.js";

/* ----------------------------- helpers ----------------------------- */
function initTooltips(scope = document) {
  if (!window.bootstrap) return;
  const triggers = [].slice.call(scope.querySelectorAll("[data-bs-toggle='tooltip']"));
  triggers.forEach((el) => {
    if (!bootstrap.Tooltip.getInstance(el)) new bootstrap.Tooltip(el);
  });
}

function lifecycleBtn(id, action, title, icon, color) {
  return `
    <button class="btn btn-outline-${color} btn-sm ${action}-btn" data-id="${id}"
      data-bs-toggle="tooltip" data-bs-title="${title}" aria-label="${title}">
      <i class="fas ${icon}"></i>
    </button>`;
}

/* --------------------------- action buttons --------------------------- */
function getPolicyActionButtons(entry, userRole) {
  let role = (userRole || "").trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  const canDelete = ["admin", "superadmin"].includes(role);
  const canLifecycle = ["admin", "superadmin"].includes(role);
  const status = (entry.status || "").toLowerCase();

  const btns = [];

  // Always: View
  btns.push(`
    <button class="btn btn-outline-primary btn-sm view-btn" data-id="${entry.id}"
      data-bs-toggle="tooltip" data-bs-title="View policy details" aria-label="View policy">
      <i class="fas fa-eye"></i>
    </button>`);

  // Always: Edit (if not expired)
  if (status !== "expired") {
    btns.push(`
      <button class="btn btn-outline-success btn-sm edit-btn" data-id="${entry.id}"
        data-bs-toggle="tooltip" data-bs-title="Edit policy" aria-label="Edit policy">
        <i class="fas fa-pen"></i>
      </button>`);
  }

  if (canLifecycle) {
    if (status === "active") {
      btns.push(lifecycleBtn(entry.id, "deactivate", "Deactivate policy", "fa-toggle-off", "warning"));
    } else if (status === "inactive") {
      btns.push(lifecycleBtn(entry.id, "activate", "Activate policy", "fa-toggle-on", "success"));
    }
    if (status !== "expired") {
      btns.push(lifecycleBtn(entry.id, "expire", "Expire policy", "fa-hourglass-end", "secondary"));
    }
  }

  if (canDelete && status !== "active") {
    btns.push(`
      <button class="btn btn-outline-danger btn-sm delete-btn" data-id="${entry.id}"
        data-bs-toggle="tooltip" data-bs-title="Delete policy" aria-label="Delete policy">
        <i class="fas fa-trash"></i>
      </button>`);
  }

  return `<div class="d-inline-flex gap-1">${btns.join("")}</div>`;
}

/* ------------------------- dynamic table head ------------------------- */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;
  thead.innerHTML = "";
  const tr = document.createElement("tr");
  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = FIELD_LABELS_DISCOUNT_POLICY[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });
  thead.appendChild(tr);
}

/* ---------------------------- field render ---------------------------- */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const badgeClass = {
        active: "bg-success",
        inactive: "bg-dark",
        expired: "bg-secondary",
      }[raw] || "bg-warning";
      return raw ? `<span class="badge ${badgeClass}">${label}</span>` : "—";
    }
    case "organization": return entry.organization?.name || "—";
    case "facility": return entry.facility?.name || "—";
    case "code": return entry.code || "—";
    case "name": return entry.name || "—";
    case "description": return entry.description || "—";
    case "discount_type": return entry.discount_type || "—";
    case "discount_value":
      if (entry.discount_type === "percentage")
        return `${parseFloat(entry.discount_value) || 0}%`;
      try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: entry.organization?.currency || "USD" })
          .format(entry.discount_value);
      } catch {
        return Number(entry.discount_value).toFixed(2);
      }
    case "applies_to": return entry.applies_to || "—";
    case "condition_json":
      return entry.condition_json ? `<code>${JSON.stringify(entry.condition_json)}</code>` : "—";
    case "effective_from": return entry.effective_from ? formatDate(entry.effective_from) : "—";
    case "effective_to": return entry.effective_to ? formatDate(entry.effective_to) : "—";

    // 🛡️ Audit fields
    case "createdBy": return entry.createdBy ? `${entry.createdBy.first_name} ${entry.createdBy.last_name}` : "—";
    case "updatedBy": return entry.updatedBy ? `${entry.updatedBy.first_name} ${entry.updatedBy.last_name}` : "—";
    case "deletedBy": return entry.deletedBy ? `${entry.deletedBy.first_name} ${entry.deletedBy.last_name}` : "—";
    case "activatedBy": return entry.activatedBy ? `${entry.activatedBy.first_name} ${entry.activatedBy.last_name}` : "—";
    case "deactivatedBy": return entry.deactivatedBy ? `${entry.deactivatedBy.first_name} ${entry.deactivatedBy.last_name}` : "—";
    case "expiredBy": return entry.expiredBy ? `${entry.expiredBy.first_name} ${entry.expiredBy.last_name}` : "—";

    // 🕑 Timestamps
    case "created_at": return entry.created_at ? formatDate(entry.created_at) : "—";
    case "updated_at": return entry.updated_at ? formatDate(entry.updated_at) : "—";
    case "deleted_at": return entry.deleted_at ? formatDate(entry.deleted_at) : "—";
    case "activated_at": return entry.activated_at ? formatDate(entry.activated_at) : "—";
    case "deactivated_at": return entry.deactivated_at ? formatDate(entry.deactivated_at) : "—";
    case "expired_at": return entry.expired_at ? formatDate(entry.expired_at) : "—";

    default: return entry[field] != null ? String(entry[field]) : "—";
  }
}

/* ---------------------------- card renderer --------------------------- */
export function renderCard(entry, visibleFields, userRole) {
  let html = "";
  visibleFields.forEach((field) => {
    if (field === "actions") return;
    const label = FIELD_LABELS_DISCOUNT_POLICY[field] || field.replace(/_/g, " ");
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });
  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      <div class="card-footer text-end">
        <div class="table-actions">${getPolicyActionButtons(entry, userRole)}</div>
      </div>
    </div>`;
}

/* ----------------------------- list render ---------------------------- */
export function renderList({ entries, visibleFields, viewMode, userRole }) {
  const tableBody = document.getElementById("discountPolicyTableBody");
  const cardContainer = document.getElementById("discountPolicyList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;
  tableBody.innerHTML = ""; cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active"); tableContainer.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.remove("active");
    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No discount policies found.</td></tr>`;
      return initTooltips(tableBody);
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      row.innerHTML = visibleFields.map((f) => {
        const v = f === "actions"
          ? `<div class="table-actions export-ignore">${getPolicyActionButtons(entry, userRole)}</div>`
          : renderValue(entry, f);
        const tdClass = f === "actions" ? ' class="actions-cell text-center"' : "";
        return `<td${tdClass}>${v}</td>`;
      }).join("");
      tableBody.appendChild(row);
    });
    initTooltips(tableBody);
  } else {
    tableContainer.classList.remove("active"); cardContainer.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.remove("active");
    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, userRole)).join("")
      : `<p class="text-muted">No discount policies found.</p>`;
    initTooltips(cardContainer);
  }
  setupExportHandlers(entries);
}

/* -------------------------- export handlers --------------------------- */
let exportHandlersBound = false;
function setupExportHandlers(entries) {
  if (exportHandlersBound) return; exportHandlersBound = true;
  const title = "Discount Policies Report";
  document.getElementById("exportCSVBtn")?.addEventListener("click", () => exportData({ type: "csv", data: entries, title }));
  document.getElementById("exportExcelBtn")?.addEventListener("click", () => exportData({ type: "xlsx", data: entries, title }));
  document.getElementById("exportPDFBtn")?.addEventListener("click", () =>
    exportData({ type: "pdf", title, selector: ".table-container", orientation: "landscape" })
  );
}
