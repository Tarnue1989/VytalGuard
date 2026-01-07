// 📁 feature-access-actions.js
import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";

import { renderCard } from "./feature-access-render.js";

export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
}) {
  const tableBody = document.getElementById("featureAccessTableBody");
  const cardContainer = document.getElementById("featureAccessList");

  window.latestFeatureAccessEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    const allRows = window.latestFeatureAccessEntries || entries || [];
    let entry = allRows.find((x) => String(x.id) === String(id));

    // Fallback: fetch if entry not found locally
    if (!entry) {
      try {
        const res = await fetch(`/api/features/feature-access/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        entry = data.data;
      } catch {
        return showToast("❌ Feature Access not found");
      }
    }

    if (!entry) return showToast("❌ Feature Access data missing");

    const classList = btn.classList;

    // 👁️ View
    if (classList.contains("view-btn")) {
      const html = renderCard(entry, visibleFields, localStorage.getItem("userRole"));
      return openViewModal("Feature Access Info", html);
    }

    // ✏️ Edit
    if (classList.contains("edit-btn")) {
      sessionStorage.setItem("featureAccessEditId", entry.id);
      sessionStorage.setItem("featureAccessEditPayload", JSON.stringify(entry));
      window.location.href = `add-feature-access.html`;
      return;
    }

    // 🔄 Toggle status
    if (classList.contains("toggle-status-btn")) return await handleToggleStatus(id, entry);

    // 🗑️ Delete
    if (classList.contains("delete-btn")) return await handleDelete(id, entry);
  }

  async function handleToggleStatus(id, entry) {
    const confirmed = await showConfirm("Toggle this access entry's status (Active/Inactive)?");
    if (!confirmed) return;

    try {
      showLoading();

      const res = await fetch(`/api/features/feature-access/${id}/toggle-status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "❌ Failed to toggle Feature Access status");

      const newStatus = data?.data?.status || entry?.status;
      const roleName = data?.data?.role?.name || entry?.role?.name || "Role";
      const moduleName = data?.data?.module?.name || entry?.module?.name || "Module";
      const orgName = data?.data?.organization?.name || entry?.organization?.name || "Organization";
      const facilityName = data?.data?.facility?.name || entry?.facility?.name || "Facility";

      showToast(
        `✅ Access for role "${roleName}" on module "${moduleName}" at facility "${facilityName}" (org: ${orgName}) updated to ${newStatus}`
      );

      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to toggle Feature Access status");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this access entry?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await fetch(`/api/features/feature-access/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete Feature Access");

      const roleName = entry?.role?.name || data?.data?.role?.name || "Role";
      const moduleName = entry?.module?.name || data?.data?.module?.name || "Module";
      const orgName = entry?.organization?.name || data?.data?.organization?.name || "Organization";
      const facilityName = entry?.facility?.name || data?.data?.facility?.name || "Facility";

      showToast(
        `✅ Access for role "${roleName}" on module "${moduleName}" at facility "${facilityName}" (org: ${orgName}) deleted successfully`
      );

      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete Feature Access");
    } finally {
      hideLoading();
    }
  }

  // ✅ Global helpers
  window.editEntry = (id) => {
    const entry = entries.find((x) => String(x.id) === String(id));
    if (entry) {
      sessionStorage.setItem("featureAccessEditId", entry.id);
      sessionStorage.setItem("featureAccessEditPayload", JSON.stringify(entry));
      window.location.href = `add-feature-access.html`;
    } else {
      showToast("❌ Feature Access not found for editing");
    }
  };

  window.viewEntry = (id) => {
    const btn = document.querySelector(`.view-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ View button not found");
  };

  window.toggleStatusEntry = (id) => {
    const btn = document.querySelector(`.toggle-status-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Toggle button not found");
  };

  window.deleteEntry = (id) => {
    const btn = document.querySelector(`.delete-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Delete button not found");
  };
}
