// 📦 deposit-actions.js – Enterprise MASTER–ALIGNED (Consultation Parity)
// ============================================================================
// 🔹 Pattern Source: consultation-actions.js (Enterprise Master)
// 🔹 Permission-driven + superadmin-aware (role + roleNames)
// 🔹 Unified lifecycle dispatcher (view / edit / delete / toggle / cancel / reverse / apply / verify / void / restore)
// 🔹 Safe fallback fetch + modal-based apply preserved
// 🔹 100% API preservation (NO endpoint changes)
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./deposit-render.js";
import { printDepositReceipt } from "./deposit-receipt.js";

/**
 * Unified permission-aware action handler for Deposit module
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, roleNames, permissions }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("depositTableBody");
  const cardContainer = document.getElementById("depositList");
  const modalBody = document.getElementById("viewModalBody");

  // 🗂️ Cache latest entries (MASTER PATTERN)
  window.latestDepositEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);
  if (modalBody) modalBody.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions (MASTER PATTERN)
  ============================================================ */
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

  // 🧠 Superadmin bypass (role OR roleNames)
  const isSuperAdmin =
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(String(key).toLowerCase().trim());

  /* ============================================================
     🎯 Main Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestDepositEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch (MASTER SAFETY)
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/deposits/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Deposit not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Deposit data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("deposits:view"))
        return showToast("⛔ No permission to view deposits");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("deposits:edit") && !hasPerm("deposits:create"))
        return showToast("⛔ No permission to edit deposits");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("deposits:delete"))
        return showToast("⛔ No permission to delete deposits");
      return await handleDelete(id);
    }

    // 🔄 Lifecycle map (MASTER STYLE)
    const lifecycleMap = {
      "toggle-status-btn": "toggle-status",
      "clear-btn": "toggle-status",
      "revert-btn": "toggle-status",
      "cancel-btn": "cancel",
      "reverse-btn": "reverse",
      "apply-btn": "apply",
      "verify-btn": "verify",
      "void-btn": "voided",
      "restore-btn": "restore",
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (!hasPerm(`deposits:${action}`) && !hasPerm("deposits:edit"))
          return showToast(`⛔ No permission to ${action} deposits`);

        if (action === "apply") return await handleApply(entry);
        return await handleLifecycle(id, action);
      }
    }

    if (cls.contains("print-btn")) {
      if (!hasPerm("deposits:view"))
        return showToast("⛔ No permission to print deposits");
      return handlePrint(entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Deposit Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("depositEditId", entry.id);
    sessionStorage.setItem("depositEditPayload", JSON.stringify(entry));
    window.location.href = "add-deposit.html";
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this deposit?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/deposits/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete deposit");

      showToast("✅ Deposit deleted successfully");
      window.latestDepositEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete deposit");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(
      `Proceed to ${action} this deposit?`
    );
    if (!confirmed) return;

    const url =
      action === "toggle-status"
        ? `/api/deposits/${id}/toggle-status`
        : `/api/deposits/${id}/${action}`;

    try {
      showLoading();
      const res = await authFetch(url, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} deposit`);

      showToast(`✅ Deposit ${action} successful`);
      window.latestDepositEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || `❌ Failed to ${action} deposit`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     💳 Apply Deposit (Modal – PRESERVED)
  ============================================================ */
  async function handleApply(entry) {
    const depositIdInput = document.getElementById("applyDepositId");
    const invoiceSelect = document.getElementById("applyInvoiceSelect");
    const amountInput = document.getElementById("applyAmount");

    depositIdInput.value = entry.id;
    amountInput.value = entry.remaining_balance || 0;

    try {
      showLoading();
      const res = await authFetch(
        `/api/invoices?patient_id=${entry.patient_id}&status=unpaid,partial`
      );
      const data = await res.json();
      hideLoading();

      invoiceSelect.innerHTML = "";
      if (data?.data?.records?.length) {
        invoiceSelect.innerHTML = `<option value="">-- Select Invoice --</option>`;
        data.data.records.forEach((inv) => {
          invoiceSelect.innerHTML += `
            <option value="${inv.id}" data-balance="${inv.balance}">
              ${inv.invoice_number} (Bal: ${inv.balance})
            </option>`;
        });
      } else {
        invoiceSelect.innerHTML = `<option value="">No unpaid/partial invoices</option>`;
      }
    } catch {
      hideLoading();
      showToast("❌ Failed to load invoices");
    }

    openModal("depositApplyModal");

    invoiceSelect.onchange = () => {
      const selected = invoiceSelect.options[invoiceSelect.selectedIndex];
      const invoiceBalance = parseFloat(selected?.dataset.balance || 0);
      const depositRemaining = parseFloat(entry.remaining_balance || 0);
      amountInput.max = Math.min(depositRemaining, invoiceBalance);
    };

    document.getElementById("depositApplyForm").onsubmit = async (e) => {
      e.preventDefault();
      const invoiceId = invoiceSelect.value;
      const amount = parseFloat(amountInput.value);

      if (!invoiceId) return showToast("❌ Please select an invoice");
      if (!amount || amount <= 0) return showToast("❌ Invalid amount");

      const selected = invoiceSelect.options[invoiceSelect.selectedIndex];
      const invoiceBalance = parseFloat(selected?.dataset.balance || 0);
      const depositRemaining = parseFloat(entry.remaining_balance || 0);

      if (amount > invoiceBalance)
        return showToast("❌ Amount exceeds invoice balance");
      if (amount > depositRemaining)
        return showToast("❌ Amount exceeds deposit remaining balance");

      try {
        showLoading();
        const res = await authFetch(
          `/api/deposits/${depositIdInput.value}/apply-to-invoice`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoice_id: invoiceId, amount }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        showToast("✅ Deposit applied successfully");
        closeModal("depositApplyModal");
        await loadEntries(currentPage);
      } catch (err) {
        showToast(err.message || "❌ Failed to apply deposit");
      } finally {
        hideLoading();
      }
    };
  }

  /* ============================================================
     🖨️ Print
  ============================================================ */
  function handlePrint(entry) {
    try {
      printDepositReceipt(entry);
      showToast("🖨️ Printing deposit receipt...");
    } catch {
      showToast("❌ Failed to print deposit receipt");
    }
  }

  /* ============================================================
     🪟 Modal Helpers
  ============================================================ */
  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove("hidden");
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.add("hidden");
      const f = m.querySelector("form");
      if (f) f.reset();
    }
  }

  /* ============================================================
     🌍 Global Helpers (MASTER + Backward Compatible)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestDepositEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewDeposit = (id) => {
    if (!hasPerm("deposits:view"))
      return showToast("⛔ No permission to view deposits");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editDeposit = (id) => {
    if (!hasPerm("deposits:edit") && !hasPerm("deposits:create"))
      return showToast("⛔ No permission to edit deposits");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteDeposit = async (id) => {
    if (!hasPerm("deposits:delete"))
      return showToast("⛔ No permission to delete deposits");
    await handleDelete(id);
  };

  ["toggle-status", "cancel", "reverse", "apply", "verify", "voided", "restore"].forEach(
    (action) => {
      window[`${action}Deposit`] = async (id) => {
        if (!hasPerm(`deposits:${action}`) && !hasPerm("deposits:edit"))
          return showToast(`⛔ No permission to ${action} deposits`);
        const entry = findEntry(id);
        if (action === "apply") return await handleApply(entry);
        await handleLifecycle(id, action);
      };
    }
  );

  window.printDeposit = (id) => {
    if (!hasPerm("deposits:view"))
      return showToast("⛔ No permission to print deposits");
    const entry = findEntry(id);
    if (entry) handlePrint(entry);
  };

  // 🔹 Backward compatibility
  window.viewEntry = window.viewDeposit;
  window.editEntry = window.editDeposit;
  window.deleteEntry = window.deleteDeposit;

  // 🔹 Close modal buttons
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });
}
