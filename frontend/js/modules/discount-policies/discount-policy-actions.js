// 📁 discount-policy-actions.js
import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./discount-policy-render.js";

/* ============================================================
   📌 Setup Action Handlers – bind events for Discount Policies
============================================================ */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields = [],
}) {
  const tableBody = document.getElementById("discountPolicyTableBody");
  const cardContainer = document.getElementById("discountPolicyList");

  // cache last entries
  window.latestDiscountPolicyEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestDiscountPolicyEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🔄 fallback fetch if not cached
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/discount-policies/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Discount Policy not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Policy data missing");

    const classList = btn.classList;

    if (classList.contains("view-btn")) return handleView(entry);
    if (classList.contains("edit-btn")) return handleEdit(entry);
    if (classList.contains("delete-btn")) return await handleDelete(id);

    if (classList.contains("activate-btn")) return await handleActivate(id);
    if (classList.contains("deactivate-btn")) return await handleDeactivate(id);
    if (classList.contains("expire-btn")) return await handleExpire(id);
  }

  /* ---------------------- handlers ---------------------- */

  function handleView(entry) {
    let role = (localStorage.getItem("userRole") || "").trim().toLowerCase();
    if (role.includes("super") && role.includes("admin")) role = "superadmin";
    else if (role.includes("admin")) role = "admin";
    else role = "staff";

    const html = renderCard(entry, visibleFields, role);
    openViewModal("Discount Policy Info", html || "<p>No details available</p>");
  }

  function handleEdit(entry) {
    sessionStorage.setItem("discountPolicyEditId", entry.id);
    sessionStorage.setItem("discountPolicyEditPayload", JSON.stringify(entry));
    window.location.href = `add-discount-policy.html`;
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm(
      "Are you sure you want to delete this discount policy? This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/discount-policies/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete policy");

      showToast(`✅ Policy deleted successfully`);
      await reloadEntries();
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete policy");
    } finally {
      hideLoading();
    }
  }

  async function handleActivate(id) {
    const confirmed = await showConfirm("Activate this discount policy?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/discount-policies/${id}/activate`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to activate policy");

      showToast("✅ Policy activated");
      await reloadEntries();
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to activate policy");
    } finally {
      hideLoading();
    }
  }

  async function handleDeactivate(id) {
    const confirmed = await showConfirm("Deactivate this discount policy?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/discount-policies/${id}/deactivate`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to deactivate policy");

      showToast("✅ Policy deactivated");
      await reloadEntries();
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to deactivate policy");
    } finally {
      hideLoading();
    }
  }

  async function handleExpire(id) {
    const confirmed = await showConfirm("Expire this discount policy?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/discount-policies/${id}/expire`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to expire policy");

      showToast("✅ Policy expired");
      await reloadEntries();
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to expire policy");
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- helper: reload ---------------------- */
  async function reloadEntries() {
    window.latestDiscountPolicyEntries = [];
    if (typeof loadEntries === "function") {
      await loadEntries(currentPage || 1);
    }
  }

  /* ---------------------- global helpers ---------------------- */
  window.editDiscountPolicy = (id) => {
    const entry = (window.latestDiscountPolicyEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );
    if (entry) handleEdit(entry);
    else showToast("❌ Policy not found for editing");
  };

  window.viewDiscountPolicy = (id) => {
    const btn = document.querySelector(`.view-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ View button not found");
  };

  window.deleteDiscountPolicy = (id) => {
    const btn = document.querySelector(`.delete-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Delete button not found");
  };

  window.activateDiscountPolicy = (id) => {
    const btn = document.querySelector(`.activate-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Activate button not found");
  };

  window.deactivateDiscountPolicy = (id) => {
    const btn = document.querySelector(`.deactivate-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Deactivate button not found");
  };

  window.expireDiscountPolicy = (id) => {
    const btn = document.querySelector(`.expire-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Expire button not found");
  };
}
