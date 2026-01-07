// 📦 patientchartnote-actions.js – Full Permission-Driven Action Handlers for Patient Chart Notes
import {
  showToast,
  showConfirm,
  showLoading,
  hideLoading,
  openViewModal,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderNoteCard } from "./patientchartnote-render.js";
import { openNoteFormModal } from "./patientchartnote-form.js";

/**
 * Handles all Patient Chart Note actions: view, edit, delete, review, verify
 * Enterprise pattern consistent with consultation-actions.js
 */
export function setupNoteActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, permissions }
}) {
  const tableBody = document.getElementById("patientChartNoteTableBody");
  const cardContainer = document.getElementById("patientChartNoteList");
  window.latestPatientChartNotes = entries || [];

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ---------------------- Permission Helpers ---------------------- */
  function normalizePermissions(perms) {
    if (!perms) return [];
    if (typeof perms === "string") {
      try {
        return JSON.parse(perms);
      } catch {
        return perms.split(",").map((p) => p.trim());
      }
    }
    return Array.isArray(perms) ? perms : [];
  }

  const userPerms = new Set(normalizePermissions(user?.permissions || []));
  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) => isSuperAdmin || userPerms.has(key.toLowerCase());

  /* ---------------------- Main Dispatcher ---------------------- */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const noteId = btn.dataset.id;
    let entry =
      (window.latestPatientChartNotes || []).find(
        (x) => String(x.id) === String(noteId)
      ) || null;

    // fallback load
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/patient-chart/notes/${noteId}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Note not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Note data missing");
    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("patientchart_notes:view"))
        return showToast("⛔ No permission to view note");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("patientchart_notes:edit"))
        return showToast("⛔ No permission to edit note");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("patientchart_notes:delete"))
        return showToast("⛔ No permission to delete note");
      return await handleDelete(entry.id);
    }

    if (cls.contains("review-btn")) {
      if (!hasPerm("patientchart_notes:review"))
        return showToast("⛔ No permission to review note");
      return await handleReview(entry.id, "review");
    }

    if (cls.contains("verify-btn")) {
      if (!hasPerm("patientchart_notes:verify"))
        return showToast("⛔ No permission to verify note");
      return await handleReview(entry.id, "verify");
    }
  }

  /* ---------------------- Handlers ---------------------- */
  function handleView(entry) {
    const html = renderNoteCard(entry, visibleFields, user);
    openViewModal("Patient Chart Note", html);
  }

  function handleEdit(entry) {
    openNoteFormModal({
      patient_id: entry.patient_id,
      note: entry,
      onSuccess: () => loadEntries(currentPage),
    });
  }

  async function handleDelete(noteId) {
    const confirmed = await showConfirm("Delete this note?");
    if (!confirmed) return;
    try {
      showLoading();
      const res = await authFetch(`/api/patient-chart/notes/${noteId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete note");

      showToast("✅ Note deleted successfully");
      await loadEntries(currentPage);
    } catch (err) {
      console.error("❌ Delete error:", err);
      showToast(err.message || "❌ Delete failed");
    } finally {
      hideLoading();
    }
  }

  async function handleReview(noteId, mode = "review") {
    const actionLabel = mode === "verify" ? "Verify" : "Review";
    const confirmed = await showConfirm(`${actionLabel} this note?`);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(
        `/api/patient-chart/notes/${noteId}/review?mode=${mode}`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${actionLabel.toLowerCase()} note`);

      showToast(`✅ Note ${actionLabel.toLowerCase()}ed successfully`);
      await loadEntries(currentPage);
    } catch (err) {
      console.error(`❌ ${actionLabel} error:`, err);
      showToast(err.message || `❌ Failed to ${actionLabel.toLowerCase()} note`);
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- Global Utilities ---------------------- */
  const findNote = (id) =>
    (window.latestPatientChartNotes || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewNote = (id) => {
    if (!hasPerm("patientchart_notes:view"))
      return showToast("⛔ No permission to view note");
    const entry = findNote(id);
    if (entry) handleView(entry);
  };

  window.editNote = (id) => {
    if (!hasPerm("patientchart_notes:edit"))
      return showToast("⛔ No permission to edit note");
    const entry = findNote(id);
    if (entry) handleEdit(entry);
  };

  window.deleteNote = async (id) => {
    if (!hasPerm("patientchart_notes:delete"))
      return showToast("⛔ No permission to delete note");
    await handleDelete(id);
  };

  window.reviewNote = async (id) => {
    if (!hasPerm("patientchart_notes:review"))
      return showToast("⛔ No permission to review note");
    await handleReview(id, "review");
  };

  window.verifyNote = async (id) => {
    if (!hasPerm("patientchart_notes:verify"))
      return showToast("⛔ No permission to verify note");
    await handleReview(id, "verify");
  };
}
