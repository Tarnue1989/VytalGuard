// 📦 pharmacy-transaction-actions.js – Enterprise v2 Edition
// ============================================================================
// 🔹 Mirrors payment-actions.js and delivery-record-actions.js for unified flow
// 🔹 Preserves all existing IDs, classNames, API calls, and event wiring
// 🔹 Adds: click-lock safety, lifecycle message map, color-coded feedback
// 🔹 Supports: view, edit, delete, submit, dispense, partial-dispense, cancel,
//   verify, void — all permission-checked and confirmation-protected
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./pharmacy-transaction-render.js";

/* ============================================================
   ⚙️ Unified Action Handler – Pharmacy Transaction Module
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
  const tableBody = document.getElementById("pharmacyTransactionTableBody");
  const cardContainer = document.getElementById("pharmacyTransactionList");
  const modalBody = document.getElementById("viewModalBody");
  window.latestPharmacyTransactionEntries = entries;

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

  const userPerms = new Set(
    normalizePermissions(user?.permissions || []).map((p) => p.toLowerCase().trim())
  );

  const role =
    (user?.role || localStorage.getItem("userRole") || "").toLowerCase().trim();

  const isSuperAdmin =
    role.replace(/\s+/g, "") === "superadmin" ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(key.trim().toLowerCase());

  /* ============================================================
     🧠 Helpers
  ============================================================ */
  function formatTransactionDesc(entry) {
    const patient = entry.patient
      ? `${entry.patient.first_name || ""} ${entry.patient.last_name || ""}`.trim()
      : "Unknown Patient";
    const med =
      entry.prescriptionItem?.billableItem?.name ||
      entry.departmentStock?.name ||
      "Unknown Medication";
    const qty = entry.quantity_dispensed ?? "?";
    const date = entry.fulfillment_date || entry.created_at || null;
    const formattedDate = date
      ? new Date(date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "Unknown Date";
    return `${qty}x ${med} for ${patient} (on ${formattedDate})`;
  }

  // 🔸 Lifecycle messages and color mapping
  const ACTION_MESSAGES = {
    submit: "Submit this pharmacy transaction?",
    dispense: "Mark this transaction as dispensed?",
    "partial-dispense": "Mark this as partially dispensed?",
    cancel: "Cancel this pharmacy transaction?",
    verify: "Verify this pharmacy transaction?",
    void: "Void this pharmacy transaction?",
  };
  const TOAST_COLOR = {
    submit: "info",
    dispense: "success",
    "partial-dispense": "warning",
    verify: "primary",
    cancel: "secondary",
    void: "danger",
    delete: "danger",
  };

  let inAction = false; // click-lock safety

  /* ============================================================
     🎛️ Main Action Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id || inAction) return;
    const id = btn.dataset.id;

    let entry =
      (window.latestPharmacyTransactionEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // Fallback fetch if missing
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/pharmacy-transactions/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Pharmacy Transaction not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Pharmacy Transaction data missing");
    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("pharmacy_transactions:view"))
        return showToast("⛔ No permission to view transactions");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (
        !hasPerm("pharmacy_transactions:edit") &&
        !hasPerm("pharmacy_transactions:create")
      )
        return showToast("⛔ No permission to edit transactions");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("pharmacy_transactions:delete"))
        return showToast("⛔ No permission to delete transactions");
      return await handleDelete(id, entry);
    }

    // --- Lifecycle ---
    const lifecycleMap = {
      "submit-btn": "submit",
      "dispense-btn": "dispense",
      "partial-dispense-btn": "partial-dispense",
      "cancel-btn": "cancel",
      "verify-btn": "verify",
      "void-btn": "void",
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (
          !hasPerm(`pharmacy_transactions:${action}`) &&
          !hasPerm("pharmacy_transactions:edit")
        )
          return showToast(`⛔ No permission to ${action} transactions`);
        return await handleLifecycle(id, entry, action);
      }
    }
  }

  /* ============================================================
     🧩 Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user?.role || "staff");
    openViewModal("Pharmacy Transaction Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    window.location.href = `add-pharmacy-transaction.html?id=${entry.id}`;
  }

  async function handleDelete(id, entry) {
    const desc = formatTransactionDesc(entry);
    const confirmed = await showConfirm(`Delete pharmacy transaction: ${desc}?`);
    if (!confirmed) return;
    inAction = true;
    try {
      showLoading();
      const res = await authFetch(`/api/pharmacy-transactions/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete");
      showToast(`✅ Pharmacy Transaction deleted successfully`, TOAST_COLOR.delete);
      window.latestPharmacyTransactionEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete transaction");
    } finally {
      hideLoading();
      inAction = false;
    }
  }

  async function handleLifecycle(id, entry, action) {
    const desc = formatTransactionDesc(entry);
    const confirmed = await showConfirm(ACTION_MESSAGES[action] || `Proceed to ${action}?`);
    if (!confirmed) return;
    const url = `/api/pharmacy-transactions/${id}/${action}`;
    inAction = true;
    try {
      showLoading();
      const res = await authFetch(url, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} transaction`);
      const skipped = data?.data?.skipped || [];
      const updated = data?.data?.records || [];

      if (skipped.length && updated.length === 0) {
        // ❌ Hard failure (e.g. insufficient stock)
        showToast(
          `❌ ${skipped[0]?.reason || "Action failed"}`,
          "danger"
        );
      } else if (skipped.length) {
        // ⚠️ Partial success
        showToast(
          `⚠️ Completed with warnings: ${skipped[0]?.reason}`,
          "warning"
        );
      } else {
        // ✅ Clean success
        showToast(
          `✅ Pharmacy Transaction ${action} successful`,
          TOAST_COLOR[action] || "success"
        );
      }

      window.latestPharmacyTransactionEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || `❌ Failed to ${action} transaction`);
    } finally {
      hideLoading();
      inAction = false;
    }
  }

  /* ============================================================
     🌐 Global Helpers
  ============================================================ */
  const findEntry = (id) =>
    (window.latestPharmacyTransactionEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewPharmacyTransactionEntry = (id) => {
    if (!hasPerm("pharmacy_transactions:view"))
      return showToast("⛔ No permission to view");
    const entry = findEntry(id);
    entry ? handleView(entry) : showToast("❌ Transaction not found");
  };

  window.editPharmacyTransactionEntry = (id) => {
    if (
      !hasPerm("pharmacy_transactions:edit") &&
      !hasPerm("pharmacy_transactions:create")
    )
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    entry ? handleEdit(entry) : showToast("❌ Transaction not found");
  };

  window.deletePharmacyTransactionEntry = async (id) => {
    if (!hasPerm("pharmacy_transactions:delete"))
      return showToast("⛔ No permission to delete");
    const entry = findEntry(id);
    if (entry) await handleDelete(id, entry);
  };

  ["submit", "dispense", "partial-dispense", "cancel", "verify", "void"].forEach(
    (action) => {
      window[`${action}PharmacyTransactionEntry`] = async (id) => {
        if (
          !hasPerm(`pharmacy_transactions:${action}`) &&
          !hasPerm("pharmacy_transactions:edit")
        )
          return showToast(`⛔ No permission to ${action}`);
        const entry = findEntry(id);
        await handleLifecycle(id, entry, action);
      };
    }
  );
}
