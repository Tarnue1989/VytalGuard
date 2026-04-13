// 📁 expenses-actions.js
// ============================================================================
// 💸 Expense Actions – MASTER (Aligned with deposits-actions)
// ============================================================================

import {
  showToast,
  showConfirm,
  showLoading,
  hideLoading,
} from "../../../utils/index.js";

import { authFetch } from "../../../authSession.js";
import { renderExpenseDetail } from "./expenses-render.js";

/* ============================================================ */
export function setupExpenseActionHandlers({
  entries,
  currentPage,
  loadEntries,
}) {
  const tableBody = document.getElementById("expenseTableBody");
  const cardContainer = document.getElementById("expenseList");

  // cache entries
  window.latestExpenseEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestExpenseEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    /* fallback fetch */
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/expenses/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Expense not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Expense data missing");

    const classList = btn.classList;

    if (classList.contains("view-btn")) return handleView(entry);
    if (classList.contains("delete-btn")) return await handleDelete(id);
  }

  /* ---------------------- handlers ---------------------- */

  function handleView(entry) {
    let role = (localStorage.getItem("userRole") || "").trim().toLowerCase();

    if (role.includes("super") && role.includes("admin")) role = "superadmin";
    else if (role.includes("admin")) role = "admin";
    else role = "staff";

    const html = renderExpenseDetail(entry, role);

    const modal = document.getElementById("viewModal");
    modal.querySelector("#viewModalTitle").textContent = "Expense Details";
    modal.querySelector("#viewModalBody").innerHTML = html;
    modal.classList.remove("hidden");
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this expense?");
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(`/api/expenses/${id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "❌ Failed to delete expense");
      }

      showToast("✅ Expense deleted");

      window.latestExpenseEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete expense");
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

  /* ---------------------- form submission ---------------------- */

  function bindFormOnce(formId, handler) {
    const form = document.getElementById(formId);
    if (form && !form.dataset.bound) {
      form.dataset.bound = "true";
      form.addEventListener("submit", handler);
    }
  }

  bindFormOnce("expenseForm", async (e) => {
    e.preventDefault();

    const amount = document.getElementById("expenseAmount").value;
    const category = document.getElementById("expenseCategory").value;
    const account_id = document.getElementById("expenseAccount").value;
    const currency = document.getElementById("expenseCurrency").value;
    const description = document.getElementById("expenseDescription").value;
    const date = document.getElementById("expenseDate").value;

    if (!amount || !category || !account_id || !currency || !date) {
      return showToast("❌ Missing required fields");
    }

    await submitAction("/api/expenses", {
      amount: Number(amount),
      category,
      account_id,
      currency,
      description,
      date,
    });

    closeModal("expenseModal");
  });

  /* ---------------------- submit wrapper ---------------------- */

  async function submitAction(endpoint, payload) {
    try {
      showLoading();

      const res = await authFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "❌ Failed to perform action");
      }

      showToast(`✅ ${data.message || "Action successful"}`);

      window.latestExpenseEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to perform action");
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- global helpers ---------------------- */

  window.viewExpense = (id) => {
    const btn = document.querySelector(`.view-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ View button not found");
  };

  window.deleteExpense = (id) => {
    const btn = document.querySelector(`.delete-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Delete button not found");
  };
}