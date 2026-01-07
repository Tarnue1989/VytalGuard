// 📁 patientchart-render.js – Patient Chart table & card renderers (Enterprise Master Pattern)
// ============================================================================
// 🔹 Unified table + card renderer for Patient Chart modules
// 🔹 Fully aligned with Consultation / Vital / Pharmacy master patterns
// 🔹 Supports org/facility/patient display, table-card toggle, tooltips & actions
// ============================================================================

import {
  FIELD_LABELS_PATIENT_CHART_CACHE,
  FIELD_LABELS_PATIENT_CHART_NOTE,
  FIELD_LABELS_PATIENT_CHART_VIEW_LOG,
} from "./patientchart-constants.js";

import { formatDate } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { initTooltips } from "../../utils/ui-utils.js";

/* ============================================================
   🎛️ Action Buttons (centralized per section)
============================================================ */
function getPatientChartActionButtons(entry, user, section = "cache") {
  const prefixMap = {
    cache: "patientcharts",
    note: "patientchart_notes",
    viewlog: "patientchart_view_logs",
  };

  const moduleKey = section === "cache" ? "patientchart_cache" : section;
  const permissionPrefix = prefixMap[section] || "patientcharts";

  return buildActionButtons({
    module: moduleKey,
    status: (entry.status || "").toLowerCase(),
    entryId: entry.patient_id || entry.id,
    user,
    permissionPrefix,
  });
}

/* ============================================================
   🧱 Dynamic Table Head Renderer
============================================================ */
export function renderDynamicTableHead(visibleFields, section = "cache") {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;

  const labelMap =
    section === "note"
      ? FIELD_LABELS_PATIENT_CHART_NOTE
      : section === "viewlog"
      ? FIELD_LABELS_PATIENT_CHART_VIEW_LOG
      : FIELD_LABELS_PATIENT_CHART_CACHE;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = labelMap[field] || field.replace(/_/g, " ");
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

function renderValue(entry, field, section = "cache") {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const colorMap = {
        active: "bg-success",
        stale: "bg-warning text-dark",
        invalid: "bg-danger",
        draft: "bg-secondary",
        verified: "bg-primary",
        voided: "bg-dark",
      };
      return raw
        ? `<span class="badge ${colorMap[raw] || "bg-secondary"}">${label}</span>`
        : "—";
    }

    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no || ""} ${entry.patient.full_name || ""}`.trim() || "—"
        : "—";

    case "author":
    case "revalidated_by":
    case "createdBy":
    case "updatedBy":
    case "deletedBy":
    case "reviewed_by":
    case "verified_by":
    case "user":
      return renderUserName(entry[field]);

    case "generated_at":
    case "viewed_at":
    case "revalidated_at":
    case "reviewed_at":
    case "verified_at":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    case "content":
      return entry.content
        ? `<div class="text-wrap" style="white-space: pre-line;">${entry.content}</div>`
        : "—";

    case "ip_address":
      return entry.ip_address || "—";

    case "user_agent":
      return entry.user_agent
        ? `<small class="text-muted">${entry.user_agent.slice(0, 80)}</small>`
        : "—";

    case "chart_snapshot": {
      const snap = entry.chart_snapshot;
      if (!snap) return "—";

      // ✅ Summarize only top-level keys and counts
      const keys = Object.keys(snap);
      const summary = keys
        .map(k => {
          const v = snap[k];
          const count =
            Array.isArray(v) ? `(${v.length})` :
            typeof v === "object" && v ? "(1)" : "";
          return `${k}${count}`;
        })
        .join(", ");

      return `<small class="text-muted">${summary || "[Empty Snapshot]"}</small>`;
    }

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🗂️ Card Renderer (for card mode / modal preview)
============================================================ */
export function renderCard(entry, visibleFields, user, section = "cache") {
  const labelMap =
    section === "note"
      ? FIELD_LABELS_PATIENT_CHART_NOTE
      : section === "viewlog"
      ? FIELD_LABELS_PATIENT_CHART_VIEW_LOG
      : FIELD_LABELS_PATIENT_CHART_CACHE;

  const details = visibleFields
    .filter((f) => f !== "actions")
    .map(
      (f) => `
        <p><strong>${labelMap[f] || f}:</strong> ${renderValue(entry, f, section)}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getPatientChartActionButtons(entry, user, section)}
        </div>
      </div>`
    : "";

  return `
    <div class="record-card card shadow-sm h-100 mb-3">
      <div class="card-body">${details}</div>
      ${footer}
    </div>`;
}

/* ============================================================
   📋 Main List Renderer (supports table & card view)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user, section = "cache" }) {
  const tableBody = document.getElementById("patientChartTableBody");
  const cardContainer = document.getElementById("patientChartList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No records found.</td></tr>`;

  renderDynamicTableHead(visibleFields, section);

  // 🧭 Handle View Modes
  if (viewMode === "table") {
    cardContainer.classList.add("hidden");
    tableContainer.classList.remove("hidden");

    document.getElementById("tableViewBtn")?.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.remove("active");

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
              ? `<div class="table-actions export-ignore">${getPatientChartActionButtons(
                  entry,
                  user,
                  section
                )}</div>`
              : renderValue(entry, f, section);
          const cls = f === "actions" ? ' class="text-center actions-cell"' : "";
          return `<td${cls}>${val}</td>`;
        })
        .join("");
      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);
  } else {
    tableContainer.classList.add("hidden");
    cardContainer.classList.remove("hidden");

    document.getElementById("cardViewBtn")?.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.remove("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, user, section)).join("")
      : `<p class="text-muted text-center py-3">No records found.</p>`;

    initTooltips(cardContainer);
  }
}
