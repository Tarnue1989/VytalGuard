// 📁 registrationLog-render.js – Permission-Driven, Unified Master Pattern (SuperAdmin-Aware)

import { FIELD_LABELS_REGISTRATION_LOG } from "./registration-log-constants.js";
import { formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";

/* ============================================================
   🎛️ Action Buttons (centralized, permission-driven, superadmin-aware)
============================================================ */
function getRegistrationLogActionButtons(entry, user) {
  // 🧠 Detect superadmin role
  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // 🚀 Build buttons with or without permission filtering
  return buildActionButtons({
    module: "registration_log", // 👈 consistent with backend module key
    status: (entry.log_status || "").toLowerCase(),
    entryId: entry.id,
    user: {
      ...user,
      // If superadmin → inject full override
      permissions: isSuperAdmin
        ? [
            "registration_logs:view",
            "registration_logs:create",
            "registration_logs:edit",
            "registration_logs:delete",
            "registration_logs:void",
          ]
        : user.permissions,
    },
    permissionPrefix: "registration_logs", // 👈 matches backend permission naming
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
      FIELD_LABELS_REGISTRATION_LOG[field] || field.replace(/_/g, " ");
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
  return parts.length ? parts.join(" ") : user.full_name || "—";
}

function renderValue(entry, field) {
  switch (field) {
    /* ============================================================
       🩺 Registration Log Status
    ============================================================ */
    case "log_status": {
      const raw = (entry.log_status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const colorMap = {
        draft: "bg-secondary",
        pending: "bg-info",
        active: "bg-success",
        completed: "bg-primary",
        cancelled: "bg-warning text-dark",
        voided: "bg-danger",
      };
      return raw
        ? `<span class="badge ${colorMap[raw] || "bg-secondary"}">${label}</span>`
        : "—";
    }

    /* ============================================================
       🏢 Relational / Reference Fields
    ============================================================ */
    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no || ""} ${entry.patient.first_name || ""} ${entry.patient.last_name || ""}`.trim() || "—"
        : "—";
    case "registrar":
      return renderUserName(entry.registrar);
    case "registrationType":
      return entry.registrationType?.name || "—";
    case "invoice":
      return entry.invoice
        ? `${entry.invoice.invoice_number} (${entry.invoice.status})`
        : "—";
    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    /* ============================================================
       🕓 Date / Time Fields (AUDIT — ALWAYS SHOW TIME)
    ============================================================ */
    case "registration_time":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    /* ============================================================
       ⚙️ Boolean / Flag Fields (human-readable)
    ============================================================ */
    case "is_emergency":
      return entry[field]
        ? `<span class="badge bg-danger">Yes</span>`
        : `<span class="badge bg-secondary">No</span>`;

    case "is_insured":
      return entry[field] ? "Yes" : "No";

    case "is_referred":
    case "requires_followup":
    case "is_new_patient":
    case "has_invoice":
      return entry[field] ? "Yes" : "No";

    /* ============================================================
       🧩 Default Fallback
    ============================================================ */
    default: {
      const val = entry[field];
      if (typeof val === "boolean") return val ? "Yes" : "No";
      if (val === null || val === undefined || val === "") return "—";
      return val;
    }
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
        <p>
          <strong>${FIELD_LABELS_REGISTRATION_LOG[f] || f}:</strong>
          ${renderValue(entry, f)}
        </p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getRegistrationLogActionButtons(entry, user)}
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
  const tableBody = document.getElementById("registrationLogTableBody");
  const cardContainer = document.getElementById("registrationLogList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No registration logs found.</td></tr>`;

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
              ? `<div class="table-actions export-ignore">${getRegistrationLogActionButtons(entry, user)}</div>`
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
      : `<p class="text-muted text-center py-3">No registration logs found.</p>`;

    initTooltips(cardContainer);
  }
}
