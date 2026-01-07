// 📁 feature-module-actions.js
import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";

import { renderCard } from "./feature-module-render.js";

/* ============================================================
   📌 SETUP ACTION HANDLERS (table + card containers)
   ============================================================ */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
}) {
  const tableBody = document.getElementById("featureModuleTableBody");
  const cardContainer = document.getElementById("featureModuleList");

  // 🔄 Keep last-loaded entries globally accessible
  window.latestFeatureModuleEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ------------------------------------------------------------
     🔧 Main Action Dispatcher
     ------------------------------------------------------------ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    const allRows = window.latestFeatureModuleEntries || entries || [];
    let entry = allRows.find((x) => String(x.id) === String(id));

    // ⛔ Fallback fetch if entry missing
    if (!entry) {
      try {
        const res = await fetch(`/api/features/feature-modules/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        entry = data.data;
      } catch {
        return showToast("❌ Feature Module not found");
      }
    }

    if (!entry) return showToast("❌ Feature Module data missing");

    const classList = btn.classList;

    if (classList.contains("view-btn")) return handleView(entry);
    if (classList.contains("edit-btn")) return handleEdit(entry);
    if (classList.contains("toggle-status-btn")) return handleToggleStatus(id, entry);
    if (classList.contains("toggle-enabled-btn")) return handleToggleEnabled(id, entry);
    if (classList.contains("delete-btn")) return handleDelete(id, entry);
  }

  /* ------------------------------------------------------------
     👁️ VIEW
     ------------------------------------------------------------ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, localStorage.getItem("userRole"));
    openViewModal("Feature Module Info", html);
  }

  /* ------------------------------------------------------------
     ✏️ EDIT
     ------------------------------------------------------------ */
  function handleEdit(entry) {
    sessionStorage.setItem("featureModuleEditId", entry.id);
    sessionStorage.setItem("featureModuleEditPayload", JSON.stringify(entry));
    window.location.href = `add-feature-module.html`;
  }

  /* ------------------------------------------------------------
     🔄 TOGGLE STATUS
     ------------------------------------------------------------ */
  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      `Are you sure you want to ${isActive ? "❌ deactivate" : "✅ activate"} this module?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await fetch(`/api/features/feature-modules/${id}/toggle-status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "❌ Failed to update module status");

      const newStatus = data?.data?.status || entry?.status;
      const moduleName = data?.data?.name || entry?.name || "Module";

      showToast(`✅ Module "${moduleName}" is now ${newStatus}`);
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update module status");
    } finally {
      hideLoading();
    }
  }

  /* ------------------------------------------------------------
     🔄 TOGGLE ENABLED
     ------------------------------------------------------------ */
  async function handleToggleEnabled(id, entry) {
    const isEnabled = !!entry.enabled;
    const confirmed = await showConfirm(
      `Are you sure you want to ${isEnabled ? "❌ disable" : "✅ enable"} this module?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await fetch(`/api/features/feature-modules/${id}/toggle-enabled`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "❌ Failed to update module enabled state");

      const newEnabled = data?.data?.enabled ? "enabled" : "disabled";
      const moduleName = data?.data?.name || entry?.name || "Module";

      showToast(`✅ Module "${moduleName}" is now ${newEnabled}`);
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update module enabled state");
    } finally {
      hideLoading();
    }
  }

  /* ------------------------------------------------------------
     🗑️ DELETE
     ------------------------------------------------------------ */
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Are you sure you want to permanently ❌ delete module "${entry?.name || "Module"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await fetch(`/api/features/feature-modules/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete module");

      const moduleName = entry?.name || data?.data?.name || "Module";
      showToast(`✅ Module "${moduleName}" deleted successfully`);
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete module");
    } finally {
      hideLoading();
    }
  }

  /* ------------------------------------------------------------
     🌍 GLOBAL SHORTCUT HELPERS
     ------------------------------------------------------------ */
  window.editEntry = (id) => {
    const entry = entries.find((x) => String(x.id) === String(id));
    return entry ? handleEdit(entry) : showToast("❌ Feature Module not found for editing");
  };

  window.viewEntry = (id) => {
    const btn = document.querySelector(`.view-btn[data-id="${id}"]`);
    return btn ? btn.click() : showToast("❌ View button not found");
  };

  window.toggleStatusEntry = (id) => {
    const btn = document.querySelector(`.toggle-status-btn[data-id="${id}"]`);
    return btn ? btn.click() : showToast("❌ Toggle status button not found");
  };

  window.toggleEnabledEntry = (id) => {
    const btn = document.querySelector(`.toggle-enabled-btn[data-id="${id}"]`);
    return btn ? btn.click() : showToast("❌ Toggle enabled button not found");
  };

  window.deleteEntry = (id) => {
    const btn = document.querySelector(`.delete-btn[data-id="${id}"]`);
    return btn ? btn.click() : showToast("❌ Delete button not found");
  };
}
