// 📁 accounts-actions.js
// ============================================================================
// 🏦 Account Actions – MASTER (Aligned with deposits-actions)
// ============================================================================

import {
  showToast,
  showConfirm,
  showLoading,
  hideLoading,
} from "../../../utils/index.js";

import { authFetch } from "../../../authSession.js";
import { renderAccountDetail } from "./accounts-render.js";

/* ============================================================ */
export function setupAccountActionHandlers({
  entries,
  currentPage,
  loadEntries,
}) {
  const tableBody = document.getElementById("accountTableBody");
  const cardContainer = document.getElementById("accountList");

  // cache latest
  window.latestAccountEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestAccountEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    /* ================= fallback fetch ================= */
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/accounts/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Account not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Account data missing");

    const classList = btn.classList;

    if (classList.contains("view-btn")) return handleView(entry);
    if (classList.contains("delete-btn")) return await handleDelete(id);
    if (classList.contains("toggle-btn")) return await handleToggle(entry);
  }

  /* ---------------------- handlers ---------------------- */

  function handleView(entry) {
    let role = (localStorage.getItem("userRole") || "").trim().toLowerCase();

    if (role.includes("super") && role.includes("admin")) role = "superadmin";
    else if (role.includes("admin")) role = "admin";
    else role = "staff";

    const html = renderAccountDetail(entry, role);

    const modal = document.getElementById("viewModal");
    modal.querySelector("#viewModalTitle").textContent = "Account Details";
    modal.querySelector("#viewModalBody").innerHTML = html;
    modal.classList.remove("hidden");
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this account?");
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(`/api/accounts/${id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "❌ Failed to delete account");
      }

      showToast("✅ Account deleted");

      window.latestAccountEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete account");
    } finally {
      hideLoading();
    }
  }

  async function handleToggle(entry) {
    const confirmed = await showConfirm(
      entry.is_active
        ? "Deactivate this account?"
        : "Activate this account?"
    );
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(`/api/accounts/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_active: !entry.is_active,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "❌ Failed to update account");
      }

      showToast("✅ Account updated");

      window.latestAccountEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update account");
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- modal helpers ---------------------- */

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add("hidden");

    const form = modal.querySelector("form");
    if (form) form.reset();
  }

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  /* ---------------------- global helpers ---------------------- */

  window.viewAccount = (id) => {
    const btn = document.querySelector(`.view-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ View button not found");
  };

  window.deleteAccount = (id) => {
    const btn = document.querySelector(`.delete-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Delete button not found");
  };
}