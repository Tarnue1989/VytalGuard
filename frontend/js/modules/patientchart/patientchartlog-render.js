// 📘 patientchartlog-render.js – Renders Patient Chart View Logs (Enterprise Compliance)
import { formatDate } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { initTooltips } from "../../utils/ui-utils.js";
import { FIELD_LABELS_PATIENT_CHART_VIEW_LOG } from "./patientchart-constants.js";

/* ============================================================
   🎛️ Action Buttons (typically none, but placeholder for admin ops)
============================================================ */
function getViewLogActionButtons(entry, user) {
  return buildActionButtons({
    module: "patientchart_view_logs",
    status: entry.status || "logged",
    entryId: entry.id,
    user,
    permissionPrefix: "patientchart_view_logs",
  });
}

/* ============================================================
   🔠 Value Renderer
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "user":
      return entry.user?.full_name || "—";
    case "action":
      return entry.action
        ? entry.action.charAt(0).toUpperCase() + entry.action.slice(1)
        : "—";
    case "ip_address":
      return entry.ip_address || "—";
    case "user_agent":
      return entry.user_agent
        ? `<small class="text-muted">${entry.user_agent.slice(0, 100)}</small>`
        : "—";
    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "patient":
      return entry.patient?.full_name || "—";
    case "viewed_at":
    case "created_at":
      return entry[field] ? formatDate(entry[field]) : "—";
    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🧱 Dynamic Table Head Renderer
============================================================ */
export function renderDynamicLogTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;
  thead.innerHTML = "";

  const tr = document.createElement("tr");
  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent =
      FIELD_LABELS_PATIENT_CHART_VIEW_LOG[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });
  thead.appendChild(tr);
}

/* ============================================================
   🗂️ Card Renderer
============================================================ */
export function renderLogCard(entry, visibleFields, user) {
  const details = visibleFields
    .filter((f) => f !== "actions")
    .map(
      (f) => `
        <p>
          <strong>${FIELD_LABELS_PATIENT_CHART_VIEW_LOG[f] || f}:</strong>
          ${renderValue(entry, f)}
        </p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getViewLogActionButtons(entry, user)}
        </div>
      </div>`
    : "";

  return `
    <div class="record-card card shadow-sm mb-3">
      <div class="card-body">${details}</div>
      ${footer}
    </div>`;
}

/* ============================================================
   📋 Main Renderer (with correct toggle sync)
============================================================ */
export function renderViewLogs({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("patientChartLogTableBody");
  const cardContainer = document.getElementById("patientChartLogList");
  const tableContainer = document.querySelector(".table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No view logs found.</td></tr>`;

  // 🔁 Proper toggle handling
  if (viewMode === "table") {
    // Table view active
    cardContainer.classList.remove("active");
    cardContainer.classList.add("hidden");
    tableContainer.classList.add("active");
    tableContainer.classList.remove("hidden");

    document.getElementById("tableViewBtn")?.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.remove("active");

    renderDynamicLogTableHead(visibleFields);

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
              ? `<div class="table-actions export-ignore">${getViewLogActionButtons(
                  entry,
                  user
                )}</div>`
              : renderValue(entry, f);
          const cls = f === "actions" ? ' class="text-center actions-cell"' : "";
          return `<td${cls}>${val}</td>`;
        })
        .join("");
      tableBody.appendChild(tr);
    });
  } else {
    // Card view active
    tableContainer.classList.remove("active");
    tableContainer.classList.add("hidden");
    cardContainer.classList.add("active");
    cardContainer.classList.remove("hidden");

    document.getElementById("cardViewBtn")?.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.remove("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderLogCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center py-3">No view logs found.</p>`;
  }

  initTooltips(cardContainer);
}
