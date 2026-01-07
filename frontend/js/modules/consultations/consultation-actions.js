// 📁 consultation-actions.js – Full Permission-Driven Action Handlers for Consultations
import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./consultation-render.js";

/**
 * Unified, permission-driven action handler
 * Mirrors centralstock-actions.js (superadmin-aware, normalized permissions)
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // ✅ { role, permissions }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("consultationTableBody");
  const cardContainer = document.getElementById("consultationList");

  // cache latest entries
  window.latestConsultationEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ---------------------- Normalize permissions ---------------------- */
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

  // ✅ Super Admin bypass
  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // ✅ Unified permission checker
  const hasPerm = (key) => {
    const normalizedKey = key.trim().toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  /* ---------------------- Handler dispatcher ---------------------- */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestConsultationEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback fetch if missing
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/consultations/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Consultation not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Consultation data missing");
    const cls = btn.classList;

    // --- Basic view ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("consultations:view"))
        return showToast("⛔ You don't have permission to view");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("consultations:edit"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("consultations:delete"))
        return showToast("⛔ You don't have permission to delete");
      return await handleDelete(id, entry);
    }

    // --- Lifecycle ---
    if (cls.contains("start-btn")) {
      if (!hasPerm("consultations:start"))
        return showToast("⛔ No permission to start consultation");
      return await handleLifecycle(id, "start", "Start this consultation?");
    }

    if (cls.contains("complete-btn")) {
      if (!hasPerm("consultations:complete"))
        return showToast("⛔ No permission to complete consultation");
      return await handleLifecycle(
        id,
        "complete",
        "Mark this consultation as completed?"
      );
    }

    if (cls.contains("verify-btn")) {
      if (!hasPerm("consultations:verify"))
        return showToast("⛔ No permission to verify consultation");
      return await handleLifecycle(id, "verify", "Verify this consultation?");
    }

    if (cls.contains("cancel-btn")) {
      if (!hasPerm("consultations:cancel"))
        return showToast("⛔ No permission to cancel consultation");
      return await handleLifecycle(id, "cancel", "Cancel this consultation?");
    }

    if (cls.contains("void-btn")) {
      if (!hasPerm("consultations:void"))
        return showToast("⛔ No permission to void consultation");
      return await handleLifecycle(
        id,
        "void",
        "Void this consultation? (Admin/Superadmin only)"
      );
    }
  }

  /* ---------------------- Handlers ---------------------- */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Consultation Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("consultationEditId", entry.id);
    sessionStorage.setItem("consultationEditPayload", JSON.stringify(entry));
    window.location.href = `add-consultation.html`;
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this consultation?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/consultations/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete consultation");

      showToast(`✅ Consultation deleted successfully`);
      window.latestConsultationEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete consultation");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action, confirmMsg) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/consultations/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `❌ Failed to ${action} consultation`);

      showToast(`✅ Consultation ${action} successful`);
      window.latestConsultationEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} consultation`);
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- Global helpers ---------------------- */
  const findEntry = (id) =>
    (window.latestConsultationEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("consultations:view"))
      return showToast("⛔ No permission to view consultation");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Consultation not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("consultations:edit"))
      return showToast("⛔ No permission to edit consultation");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Consultation not found for editing");
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("consultations:delete"))
      return showToast("⛔ No permission to delete consultation");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  // lifecycle globals
  ["start", "complete", "verify", "cancel", "void"].forEach((action) => {
    window[`${action}Entry`] = async (id) => {
      if (!hasPerm(`consultations:${action}`))
        return showToast(`⛔ No permission to ${action} consultation`);
      const entry = findEntry(id);
      await handleLifecycle(id, action, `Proceed to ${action} this consultation?`);
    };
  });
}
