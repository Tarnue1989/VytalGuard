// 📦 deposit-actions.js – Enterprise Master Pattern Aligned 
// ============================================================================
// 🔹 Mirrors appointments-actions.js for unified permission-driven flow
// 🔹 Preserves modal-based apply logic, all deposit-specific buttons, and lifecycle handlers
// 🔹 Adds role-based permission checks, superadmin bypass, unified globals
// 🔹 Now supports: toggle, cancel, reverse, apply, verify, void, restore
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

/* ============================================================
   ⚙️ Unified Action Handler – Deposit Module
============================================================ */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // ✅ { role, permissions }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("depositTableBody");
  const cardContainer = document.getElementById("depositList");
  const modalBody = document.getElementById("viewModalBody");

  // 🗂️ Cache latest entries
  window.latestDepositEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);
  if (modalBody) modalBody.addEventListener("click", handleActions);

  /* ============================================================
     🔐 Permission + Role Normalization
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

  const userPerms = new Set(normalizePermissions(user?.permissions || []));
  const isSuperAdmin =
    (user?.role || "").toLowerCase().replace(/\s+/g, "") === "superadmin";

  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(key.trim().toLowerCase());

  /* ============================================================
     🎛️ Main Action Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestDepositEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

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

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("deposits:view"))
        return showToast("⛔ No permission to view deposits");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("deposits:edit") && !hasPerm("deposits:create"))
        return showToast("⛔ No permission to edit deposits");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("deposits:delete"))
        return showToast("⛔ No permission to delete deposits");
      return await handleDelete(id);
    }

    // --- Lifecycle Actions ---
    const lifecycleMap = {
      "clear-btn": "toggle-status",   
      "revert-btn": "toggle-status",     
      "toggle-status-btn": "toggle-status",
      "cancel-btn": "cancel",
      "reverse-btn": "reverse",
      "apply-btn": "apply",
      "verify-btn": "verify",
      "void-btn": "void",
      "restore-btn": "restore",
    };


    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (!hasPerm(`deposits:${action}`) && !hasPerm("deposits:edit"))
          return showToast(`⛔ No permission to ${action} deposits`);

        // ⚙️ Use modal flow for "apply"
        if (action === "apply") return await handleApply(entry);
        return await handleLifecycle(id, entry, action);
      }
    }

    // --- Print ---
    if (cls.contains("print-btn")) {
      if (!hasPerm("deposits:view"))
        return showToast("⛔ No permission to print deposits");
      return handlePrint(entry);
    }
  }

  /* ============================================================
     🧩 Action Handlers
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
      const res = await authFetch(`/api/deposits/${id}`, { method: "DELETE" });
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

  async function handleLifecycle(id, entry, action) {
    const confirmMsg = `Proceed to ${action} this deposit?`;
    const confirmed = await showConfirm(confirmMsg);
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
     💳 Modal-Based Apply (Preserved)
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
     🖨️ Print Handler
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
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("hidden");
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("hidden");
      const form = modal.querySelector("form");
      if (form) form.reset();
    }
  }

  /* ============================================================
     🌐 Global Helpers (Enterprise Standard)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestDepositEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("deposits:view"))
      return showToast("⛔ No permission to view deposits");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Deposit not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("deposits:edit") && !hasPerm("deposits:create"))
      return showToast("⛔ No permission to edit deposits");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Deposit not found for editing");
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("deposits:delete"))
      return showToast("⛔ No permission to delete deposits");
    await handleDelete(id);
  };

  // 🔄 Unified lifecycle globals (enterprise pattern)
  ["toggle-status", "cancel", "reverse", "apply", "verify", "void", "restore"].forEach(
    (action) => {
      window[`${action}Deposit`] = async (id) => {
        if (!hasPerm(`deposits:${action}`) && !hasPerm("deposits:edit"))
          return showToast(`⛔ No permission to ${action} deposits`);
        const entry = findEntry(id);
        if (action === "apply") return await handleApply(entry);
        await handleLifecycle(id, entry, action);
      };
    }
  );

  window.printDeposit = (id) => {
    if (!hasPerm("deposits:view"))
      return showToast("⛔ No permission to print deposits");
    const entry = findEntry(id);
    if (entry) handlePrint(entry);
    else showToast("❌ Deposit not found for printing");
  };

  // ============================================================
  // 🔹 Close modal buttons (Cancel / X)
  // ============================================================
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });
}
