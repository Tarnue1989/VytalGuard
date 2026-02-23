// 📁 patient-actions.js – Enterprise MASTER–ALIGNED Action Handlers (Patient)
// ============================================================================
// 🧭 Pattern Source: consultation-actions.js (Enterprise MASTER)
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Unified lifecycle: view / edit / toggle-status / delete
// 🔹 Safe fallback fetch + global helpers
// 🔹 100% API preservation (NO endpoint changes)
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./patient-render.js";

/**
 * Unified permission-aware action handler for Patient module
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, permissions, roleNames }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("patientTableBody");
  const cardContainer = document.getElementById("patientList");

  // 🗂️ Cache latest entries
  window.latestPatientEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions (MASTER PATTERN)
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
      String(p).toLowerCase().trim()
    )
  );

  // 🧠 Superadmin bypass (MASTER PATTERN)
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
      (window.latestPatientEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/patients/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Patient not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Patient data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("patients:view"))
        return showToast("⛔ You don't have permission to view patients");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("patients:edit"))
        return showToast("⛔ You don't have permission to edit patients");
      return handleEdit(entry);
    }

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("patients:toggle_status"))
        return showToast("⛔ No permission to change patient status");
      return await handleToggleStatus(id, entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("patients:delete"))
        return showToast("⛔ You don't have permission to delete patients");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Patient Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("patientEditId", entry.id);
    sessionStorage.setItem("patientEditPayload", JSON.stringify(entry));
    window.location.href = "add-patient.html";
  }

  async function handleToggleStatus(id, entry) {
    const currentStatus = String(entry?.registration_status || "").toUpperCase();
    const isActive = currentStatus === "ACTIVE";

    const confirmed = await showConfirm(
      isActive
        ? "Deactivate this patient?"
        : "Activate this patient?"
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/patients/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.message || "❌ Failed to toggle patient status"
        );

      const newStatus = String(
        data?.data?.registration_status || ""
      ).toUpperCase();

      const patName =
        entry?.full_name ||
        `${entry?.first_name || ""} ${entry?.last_name || ""}`.trim() ||
        "Patient";

      showToast(
        `✅ Patient "${patName}" status changed to ${newStatus || "UPDATED"}`
      );

      window.latestPatientEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update patient status");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this patient?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/patients/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete patient");

      const patName =
        entry?.full_name ||
        `${entry?.first_name || ""} ${entry?.last_name || ""}`.trim() ||
        "Patient";

      showToast(`✅ Patient "${patName}" deleted successfully`);
      window.latestPatientEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete patient");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (MASTER + Backward Compatible)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestPatientEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewPatient = (id) => {
    if (!hasPerm("patients:view"))
      return showToast("⛔ No permission to view patient");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editPatient = (id) => {
    if (!hasPerm("patients:edit"))
      return showToast("⛔ No permission to edit patient");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.togglePatientStatus = async (id) => {
    if (!hasPerm("patients:toggle_status"))
      return showToast("⛔ No permission to toggle patient status");
    const entry = findEntry(id);
    if (entry) await handleToggleStatus(id, entry);
  };

  window.deletePatient = async (id) => {
    if (!hasPerm("patients:delete"))
      return showToast("⛔ No permission to delete patient");
    const entry = findEntry(id);
    if (entry) await handleDelete(id, entry);
  };

  // 🔹 Backward compatibility aliases
  window.viewEntry = window.viewPatient;
  window.editEntry = window.editPatient;
  window.deleteEntry = window.deletePatient;
}
