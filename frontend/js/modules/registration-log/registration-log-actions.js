// 📁 registrationLog-actions.js – Enterprise Master Pattern (Registration Logs) ✅ FINAL FIXED
// ============================================================================
// 🔹 Permission-driven (superadmin-aware)
// 🔹 FULLY CONSISTENT: view / update / submit / activate / complete / cancel / void / delete
// 🔹 NO toggle-status (enterprise-safe)
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./registration-log-render.js";

export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user,
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("registrationLogTableBody");
  const cardContainer = document.getElementById("registrationLogList");

  window.latestRegistrationLogEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions
  ============================================================ */
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

  const userPerms = new Set(
    normalizePermissions(user?.permissions || []).map((p) =>
      p.toLowerCase().trim()
    )
  );

  const isSuperAdmin =
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(String(key).toLowerCase().trim());

  /* ============================================================
     🎯 Main Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestRegistrationLogEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/registration-logs/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Registration Log not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Registration Log data missing");

    const cls = btn.classList;

    /* ================= VIEW ================= */
    if (cls.contains("view-btn")) {
      if (!hasPerm("registration_logs:view"))
        return showToast("⛔ No permission to view registration logs");
      return handleView(entry);
    }

    /* ================= EDIT ================= */
    if (cls.contains("edit-btn")) {
      if (!hasPerm("registration_logs:update"))
        return showToast("⛔ No permission to edit registration logs");
      return handleEdit(entry);
    }

    /* ================= SUBMIT ================= */
    if (cls.contains("submit-btn")) {
      if (!hasPerm("registration_logs:submit"))
        return showToast("⛔ No permission to submit registration logs");
      return handleLifecycle(id, "submit");
    }

    /* ================= ACTIVATE ================= */
    if (cls.contains("activate-btn")) {
      if (!hasPerm("registration_logs:activate"))
        return showToast("⛔ No permission to activate registration logs");
      return handleLifecycle(id, "activate");
    }

    /* ================= COMPLETE ================= */
    if (cls.contains("complete-btn")) {
      if (!hasPerm("registration_logs:complete"))
        return showToast("⛔ No permission to complete registration logs");
      return handleLifecycle(id, "complete");
    }

    /* ================= CANCEL ================= */
    if (cls.contains("cancel-btn")) {
      if (!hasPerm("registration_logs:cancel"))
        return showToast("⛔ No permission to cancel registration logs");
      return handleLifecycle(id, "cancel");
    }

    /* ================= VOID ================= */
    if (cls.contains("void-btn")) {
      if (!hasPerm("registration_logs:void"))
        return showToast("⛔ No permission to void registration logs");
      return handleLifecycle(id, "void");
    }

    /* ================= DELETE ================= */
    if (cls.contains("delete-btn")) {
      if (!hasPerm("registration_logs:delete"))
        return showToast("⛔ No permission to delete registration logs");
      return handleDelete(id);
    }
  }

  /* ============================================================
     ⚙️ Handlers
  ============================================================ */

  function handleView(entry) {
    openViewModal(
      "Registration Log Info",
      renderCard(entry, visibleFields, user)
    );
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;

    sessionStorage.setItem("registrationLogEditId", entry.id);
    sessionStorage.setItem(
      "registrationLogEditPayload",
      JSON.stringify(entry)
    );

    window.location.href = "add-registration-log.html";
  }

  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(
      `Are you sure you want to ${action} this registration log?`
    );
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(`/api/registration-logs/${id}/${action}`, {
        method: "PATCH",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action}`);

      showToast(`✅ Registration Log ${action} successful`);

      window.latestRegistrationLogEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action}`);
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm(
      "Delete this registration log permanently?"
    );
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(`/api/registration-logs/${id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete");

      showToast("✅ Registration Log deleted");

      window.latestRegistrationLogEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers
  ============================================================ */
  const findEntry = (id) =>
    (window.latestRegistrationLogEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewRegistrationLog = (id) => {
    if (!hasPerm("registration_logs:view"))
      return showToast("⛔ No permission to view");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editRegistrationLog = (id) => {
    if (!hasPerm("registration_logs:update"))
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteRegistrationLog = async (id) => {
    if (!hasPerm("registration_logs:delete"))
      return showToast("⛔ No permission to delete");
    const entry = findEntry(id);
    if (entry) await handleDelete(id);
  };
}