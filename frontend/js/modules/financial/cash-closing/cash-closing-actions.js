// 📁 cash-closing-actions.js
// ============================================================================
// 💰 Cash Closing Actions – MASTER (Aligned with deposits-actions)
// ============================================================================

import {
  showToast,
  showConfirm,
  showLoading,
  hideLoading,
} from "../../../utils/index.js";

import { authFetch } from "../../../authSession.js";
import { renderCashClosingDetail } from "./cash-closing-render.js";

/* ============================================================ */
export function setupCashClosingActionHandlers({
  entries,
  currentPage,
  loadEntries,
}) {
  const tableBody = document.getElementById("cashClosingTableBody");
  const cardContainer = document.getElementById("cashClosingList");

  // cache entries
  window.latestCashClosingEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestCashClosingEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    /* fallback fetch */
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/cash-closing/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Record not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Data missing");

    const classList = btn.classList;

    if (classList.contains("view-btn")) return handleView(entry);
    if (classList.contains("reopen-btn")) return await handleReopen(entry);
  }

  /* ---------------------- handlers ---------------------- */

  function handleView(entry) {
    let role = (localStorage.getItem("userRole") || "").trim().toLowerCase();

    if (role.includes("super") && role.includes("admin")) role = "superadmin";
    else if (role.includes("admin")) role = "admin";
    else role = "staff";

    const html = renderCashClosingDetail(entry, role);

    const modal = document.getElementById("viewModal");
    modal.querySelector("#viewModalTitle").textContent = "Cash Closing Details";
    modal.querySelector("#viewModalBody").innerHTML = html;
    modal.classList.remove("hidden");
  }

  async function handleReopen(entry) {
    const confirmed = await showConfirm(
      "Reopen this closing record? (Admin only)"
    );
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(
        `/api/cash-closing/${entry.id}/reopen`,
        {
          method: "POST",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "❌ Failed to reopen");
      }

      showToast("✅ Closing reopened");

      window.latestCashClosingEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to reopen");
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

  window.viewCashClosing = (id) => {
    const btn = document.querySelector(`.view-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ View button not found");
  };
}