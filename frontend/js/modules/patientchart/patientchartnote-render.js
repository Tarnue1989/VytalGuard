// 📦 patientchartnote-render.js – Renderer for Patient Chart Notes (Inline + Standalone)
// Reusable in chart page sections and in standalone notes list.

import { formatDate } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { initTooltips } from "../../utils/ui-utils.js";
import { FIELD_LABELS_PATIENT_CHART_NOTE } from "./patientchart-constants.js";

/* ============================================================
   🎛️ Action Buttons (permission-aware)
============================================================ */
function getNoteActionButtons(entry, user) {
  return buildActionButtons({
    module: "patientchart_notes",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "patientchart_notes",
  });
}

/* ============================================================
   🔠 Field Value Helper
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "author":
      return entry.author?.full_name || "—";
    case "note_type":
      return (
        entry.note_type?.charAt(0).toUpperCase() + entry.note_type?.slice(1)
      );
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const colorMap = {
        draft: "bg-secondary",
        reviewed: "bg-warning text-dark",
        verified: "bg-success",
        voided: "bg-danger",
      };
      return `<span class="badge ${colorMap[raw] || "bg-light text-dark"}">${label}</span>`;
    }
    case "reviewed_by":
      return entry.reviewed_by?.full_name || "—";
    case "verified_by":
      return entry.verified_by?.full_name || "—";
    case "reviewed_at":
    case "verified_at":
    case "created_at":
    case "updated_at":
      return entry[field] ? formatDate(entry[field]) : "—";
    case "content":
      return `<div class="note-content">${entry.content || "—"}</div>`;
    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🧩 Table Header Renderer
============================================================ */
export function renderDynamicNoteTableHead(visibleFields) {
  const thead = document.getElementById("dynamicNoteTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent =
      FIELD_LABELS_PATIENT_CHART_NOTE[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================
   🗂️ Card Renderer (for chart inline & standalone)
============================================================ */
export function renderNoteCard(entry, visibleFields, user) {
  const details = visibleFields
    .filter((f) => f !== "actions")
    .map(
      (f) => `
      <p>
        <strong>${FIELD_LABELS_PATIENT_CHART_NOTE[f] || f}:</strong>
        ${renderValue(entry, f)}
      </p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getNoteActionButtons(entry, user)}
        </div>
      </div>`
    : "";

  return `
    <div class="record-card card shadow-sm h-100 mb-3">
      <div class="card-body">
        ${details}
      </div>
      ${footer}
    </div>`;
}

/* ============================================================
   📋 Notes List Renderer
============================================================ */
export function renderPatientNotesList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("patientChartNoteTableBody");
  const cardContainer = document.getElementById("patientChartNoteList");
  const tableContainer = document.querySelector(".table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No notes found.</td></tr>`;

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.remove("active");

    renderDynamicNoteTableHead(visibleFields);

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
              ? `<div class="table-actions export-ignore">${getNoteActionButtons(
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

    initTooltips(cardContainer);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.remove("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderNoteCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center py-3">No notes found.</p>`;

    initTooltips(cardContainer);
  }
}

/* ============================================================
   🩺 Inline Note Renderer (Chart Section)
============================================================ */
export async function renderPatientNotes(patientId, user) {
  try {
    showLoading();
    const res = await authFetch(`/api/patient-chart/patient/${patientId}/notes`);
    const data = await res.json().catch(() => ({}));
    hideLoading();

    if (!res.ok) throw new Error(data.message || "Failed to load patient notes");

    const container = document.getElementById("notesListContainer");
    if (!container) return;

    const notes = data.data || [];
    if (!notes.length) {
      container.innerHTML = `<p class="text-muted text-center py-3">No notes recorded.</p>`;
      return;
    }

    container.innerHTML = notes
      .map((n) => {
        const author = n.author?.full_name || "Unknown";
        const statusBadge = renderValue(n, "status");
        const date = formatDate(n.created_at);
        return `
          <div class="note-card border rounded p-3 mb-2 shadow-sm bg-white">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong>${author}</strong>
              <span class="small text-muted">${date}</span>
            </div>
            <div class="note-body">${n.content || "<em>No content</em>"}</div>
            <div class="mt-2 d-flex justify-content-between align-items-center">
              ${statusBadge}
              <div class="table-actions">
                ${getNoteActionButtons(n, user)}
              </div>
            </div>
          </div>`;
      })
      .join("");
  } catch (err) {
    console.error("❌ Error loading notes:", err);
    showToast(err.message || "❌ Failed to load patient notes");
    const container = document.getElementById("notesListContainer");
    if (container)
      container.innerHTML = `<p class="text-muted text-center">Failed to load notes.</p>`;
  } finally {
    hideLoading();
  }
}
