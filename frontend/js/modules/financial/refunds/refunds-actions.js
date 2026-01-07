// 📁 assets/js/modules/financial/invoices/refunds/refunds-actions.js
import {
  showToast,
  showConfirm,
  showLoading,
  hideLoading,
} from "../../../utils/index.js";
import { authFetch } from "../../../authSession.js";
import { renderCard as renderRefundCard, renderRefundDetail } from "./refunds-render.js";

export function setupRefundActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
}) {
  const tableBody = document.getElementById("refundTableBody");
  const cardContainer = document.getElementById("refundList");

  // cache last entries
  window.latestRefundEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestRefundEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback: fetch full record if not cached
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/refunds/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Refund not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Refund data missing");

    const classList = btn.classList;

    if (classList.contains("view-btn")) return handleView(entry);
    if (classList.contains("delete-btn")) return await handleDelete(id);
    if (classList.contains("reverse-btn")) return await handleReverse(id);
  }

  /* ---------------------- handlers ---------------------- */

  function handleView(entry) {
    let role = (localStorage.getItem("userRole") || "").trim().toLowerCase();
    if (role.includes("super") && role.includes("admin")) role = "superadmin";
    else if (role.includes("admin")) role = "admin";
    else role = "staff";

    const html = renderRefundDetail(entry, role);
    const modal = document.getElementById("viewModal");
    modal.querySelector("#viewModalTitle").textContent = "Refund Details";
    modal.querySelector("#viewModalBody").innerHTML = html;
    modal.classList.remove("hidden");
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this refund? (Admin only)");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/refunds/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete refund");

      showToast(`✅ Refund deleted successfully`);
      window.latestRefundEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete refund");
    } finally {
      hideLoading();
    }
  }

  async function handleReverse(id) {
    const reason = prompt("Enter reason for reversal:");
    if (!reason) return;

    try {
      showLoading();
      const res = await authFetch(`/api/refunds/${id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to reverse refund");

      showToast(`✅ Refund reversed successfully`);
      window.latestRefundEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to reverse refund");
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- global helpers ---------------------- */

  window.viewRefund = (id) => {
    const btn = document.querySelector(`.view-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ View button not found");
  };

  window.deleteRefund = (id) => {
    const btn = document.querySelector(`.delete-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Delete button not found");
  };

  window.reverseRefund = (id) => {
    const btn = document.querySelector(`.reverse-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Reverse button not found");
  };
}
