// 📁 recommendation-actions.js
import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./recommendation-render.js";

export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
}) {
  const tableBody = document.getElementById("recommendationTableBody");
  const cardContainer = document.getElementById("recommendationList");

  // cache last entries
  window.latestRecommendationEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestRecommendationEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback: fetch full record if not cached
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/recommendations/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Recommendation not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Recommendation data missing");

    const classList = btn.classList;

    if (classList.contains("view-btn")) return handleView(entry);
    if (classList.contains("edit-btn")) return handleEdit(entry);
    if (classList.contains("delete-btn")) return await handleDelete(id, entry);

    // lifecycle buttons
    if (classList.contains("confirm-btn"))
      return await handleLifecycle(id, "confirm", "Confirm this recommendation?");
    if (classList.contains("decline-btn"))
      return await handleLifecycle(id, "decline", "Decline this recommendation?");
    if (classList.contains("void-btn"))
      return await handleLifecycle(
        id,
        "void",
        "Void this recommendation? (Admin/Superadmin only)"
      );
  }

  /* ---------------------- handlers ---------------------- */

  function handleView(entry) {
    let role = (localStorage.getItem("userRole") || "").trim().toLowerCase();
    if (role.includes("super") && role.includes("admin")) role = "superadmin";
    else if (role.includes("admin")) role = "admin";
    else role = "staff";

    const html = renderCard(entry, visibleFields, role);
    openViewModal("Recommendation Info", html);
  }

  function handleEdit(entry) {
    sessionStorage.setItem("recommendationEditId", entry.id);
    sessionStorage.setItem("recommendationEditPayload", JSON.stringify(entry));
    window.location.href = `add-recommendation.html`;
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this recommendation?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/recommendations/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete recommendation");

      showToast(`✅ Recommendation deleted successfully`);
      window.latestRecommendationEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete recommendation");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action, confirmMsg) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/recommendations/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} recommendation`);

      showToast(`✅ Recommendation ${action} successful`);
      window.latestRecommendationEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} recommendation`);
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- global helpers ---------------------- */
  window.editEntry = (id) => {
    const entry = (window.latestRecommendationEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );
    if (entry) handleEdit(entry);
    else showToast("❌ Recommendation not found for editing");
  };

  window.viewEntry = (id) => {
    const btn = document.querySelector(`.view-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ View button not found");
  };

  window.deleteEntry = (id) => {
    const btn = document.querySelector(`.delete-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Delete button not found");
  };

  // lifecycle globals
  ["confirm", "decline", "void"].forEach((action) => {
    window[`${action}Entry`] = (id) => {
      const btn = document.querySelector(`.${action}-btn[data-id="${id}"]`);
      if (btn) btn.click();
      else showToast(`❌ ${action} button not found`);
    };
  });
}
