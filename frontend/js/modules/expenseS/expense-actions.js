// 📦 expense-actions.js – Enterprise MASTER–ALIGNED (FINAL)
// ============================================================================
// 🔹 Full lifecycle + permission-driven
// 🔹 Expense-safe
// 🔹 Controller-aligned
// 🔹 Includes REJECT support (optional full enterprise flow)
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./expense-render.js";

/**
 * Unified permission-aware action handler for Expense module
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
  const tableBody = document.getElementById("expenseTableBody");
  const cardContainer = document.getElementById("expenseList");
  const modalBody = document.getElementById("viewModalBody");

  window.latestExpenseEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);
  if (modalBody) modalBody.addEventListener("click", handleActions);

  /* ============================================================ */
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

  const isSuperAdmin =
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(String(key).toLowerCase().trim());

  /* ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestExpenseEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

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

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("expenses:view"))
        return showToast("⛔ No permission to view expenses");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("expenses:update") && !hasPerm("expenses:create"))
        return showToast("⛔ No permission to edit expenses");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("expenses:delete"))
        return showToast("⛔ No permission to delete expenses");
      return await handleDelete(id);
    }

    /* 🔄 Lifecycle */
    const lifecycleMap = {
      "submit-btn": "submit",
      "approve-btn": "approve",
      "post-btn": "post",
      "void-btn": "void",
      "reverse-btn": "reverse",
      "restore-btn": "restore",
      "cancel-btn": "cancel",
      "reject-btn": "reject", // optional (only if backend supports)
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (!hasPerm(`expenses:${action}`) && !hasPerm("expenses:update"))
          return showToast(`⛔ No permission to ${action} expenses`);

        return await handleLifecycle(id, action);
      }
    }
  }

  /* ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Expense Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("expenseEditId", entry.id);
    sessionStorage.setItem("expenseEditPayload", JSON.stringify(entry));
    window.location.href = "add-expense.html";
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
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete expense");

      showToast("✅ Expense deleted");
      window.latestExpenseEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete expense");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(
      `Proceed to ${action.toUpperCase()} this expense?`
    );
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(`/api/expenses/${id}/${action}`, {
        method: "PATCH",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} expense`);

      showToast(`✅ Expense ${action} successful`);
      window.latestExpenseEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || `❌ Failed to ${action} expense`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================ */
  const findEntry = (id) =>
    (window.latestExpenseEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewExpense = (id) => {
    if (!hasPerm("expenses:view"))
      return showToast("⛔ No permission to view expenses");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editExpense = (id) => {
    if (!hasPerm("expenses:update") && !hasPerm("expenses:create"))
      return showToast("⛔ No permission to edit expenses");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteExpense = async (id) => {
    if (!hasPerm("expenses:delete"))
      return showToast("⛔ No permission to delete expenses");
    await handleDelete(id);
  };

  ["submit","approve","post","void","reverse","restore","cancel","reject"].forEach(
    (action) => {
      window[`${action}Expense`] = async (id) => {
        if (!hasPerm(`expenses:${action}`) && !hasPerm("expenses:update"))
          return showToast(`⛔ No permission to ${action} expenses`);

        await handleLifecycle(id, action);
      };
    }
  );

  // backward compatibility
  window.viewEntry = window.viewExpense;
  window.editEntry = window.editExpense;
  window.deleteEntry = window.deleteExpense;

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () =>
      document.getElementById(btn.dataset.close)?.classList.add("hidden")
    );
  });
}