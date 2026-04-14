// 📦 accounts-actions.js – Enterprise MASTER (LIGHT VERSION)

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import { renderCard } from "./accounts-render.js";

/**
 * Simple action handler for Accounts module
 */
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

  const tableBody = document.getElementById("accountTableBody");
  const cardContainer = document.getElementById("accountList");
  const modalBody = document.getElementById("viewModalBody");

  // Cache entries
  window.latestAccountEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);
  if (modalBody) modalBody.addEventListener("click", handleActions);

  /* ============================================================
     🎯 MAIN ACTION HANDLER
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestAccountEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback fetch
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

    if (!entry) return showToast("❌ Account missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) return handleView(entry);
    if (cls.contains("edit-btn")) return handleEdit(entry);
    if (cls.contains("delete-btn")) return await handleDelete(id);
  }

  /* ============================================================
     ⚙️ ACTIONS
  ============================================================ */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Account Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;

    sessionStorage.setItem("accountEditId", entry.id);
    sessionStorage.setItem("accountEditPayload", JSON.stringify(entry));

    window.location.href = "add-accounts.html";
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
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete account");

      showToast("✅ Account deleted");
      window.latestAccountEntries = [];

      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Delete failed");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 GLOBAL HELPERS
  ============================================================ */

  const findEntry = (id) =>
    (window.latestAccountEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewAccount = (id) => {
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editAccount = (id) => {
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteAccount = async (id) => {
    await handleDelete(id);
  };

  // backward compatibility
  window.viewEntry = window.viewAccount;
  window.editEntry = window.editAccount;
  window.deleteEntry = window.deleteAccount;
}