// 📦 cash-closing-actions.js – FINAL (RECEIPT ENABLED)

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import { renderCard } from "./cash-closing-render.js";
import { printCashClosingReceipt } from "./cash-closing-receipt.js"; // ✅ ADDED

export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user,
}) {
  const tableBody = document.getElementById("cashClosingTableBody");
  const cardContainer = document.getElementById("cashClosingList");
  const modalBody = document.getElementById("viewModalBody");

  window.latestCashClosingEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);
  if (modalBody) modalBody.addEventListener("click", handleActions);

  /* ================= PERMISSIONS ================= */
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

  /* ================= MAIN DISPATCH ================= */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestCashClosingEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/cash-closings/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Closing not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("cash_closings:view"))
        return showToast("⛔ No permission to view");
      return handleView(entry);
    }

    if (cls.contains("reopen-btn")) {
      if (!hasPerm("cash_closings:update"))
        return showToast("⛔ No permission to reopen");
      return await handleReopen(id);
    }

    if (cls.contains("print-btn")) {
      if (!hasPerm("cash_closings:print"))
        return showToast("⛔ No permission to print");
      return handlePrint(entry);
    }
  }

  /* ================= ACTIONS ================= */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Cash Closing", html);
  }

  async function handleReopen(id) {
    const confirmed = await showConfirm("Reopen this closing?");
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(`/api/cash-closings/${id}/reopen`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to reopen");

      showToast("✅ Closing reopened");

      window.latestCashClosingEntries = [];
      await loadEntries(currentPage || 1);
    } catch (err) {
      showToast(err.message || "❌ Failed to reopen");
    } finally {
      hideLoading();
    }
  }

  /* 🔥 FIXED PRINT (ENTERPRISE) */
  function handlePrint(entry) {
    try {
      printCashClosingReceipt(entry); // ✅ USE RECEIPT
    } catch {
      showToast("❌ Failed to print");
    }
  }

  /* ================= GLOBAL HELPERS ================= */
  const findEntry = (id) =>
    (window.latestCashClosingEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewCashClosing = (id) => {
    if (!hasPerm("cash_closings:view"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.reopenCashClosing = async (id) => {
    if (!hasPerm("cash_closings:update"))
      return showToast("⛔ No permission");
    await handleReopen(id);
  };

  window.printCashClosing = (id) => {
    if (!hasPerm("cash_closings:print"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) handlePrint(entry);
  };

  window.viewEntry = window.viewCashClosing;

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add("hidden");
  }
}