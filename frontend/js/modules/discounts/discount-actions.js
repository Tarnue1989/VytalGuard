// 📦 discount-actions.js – Enterprise Master Pattern (v2.4 Modal Void Reason)
// ============================================================================
// 🔹 Mirrors deposit-actions.js for unified permission-driven flow
// 🔹 Adds modal-based void reason (no browser prompt)
// 🔹 Includes instant post-action refresh (void, restore, finalize, toggle)
// 🔹 Superadmin bypass + unified permission normalization
// 🔹 Fully compatible with discount-filter-main.js
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./discount-render.js";
import { printDiscountSummary } from "./discount-summary.js";

/* ============================================================
   ⚙️ Unified Action Handler – Discount Module
============================================================ */
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
  const tableBody = document.getElementById("discountTableBody");
  const cardContainer = document.getElementById("discountList");
  const modalBody = document.getElementById("viewModalBody");

  // 🗂️ Cache latest entries
  window.latestDiscountEntries = entries;

  [tableBody, cardContainer, modalBody].forEach((el) =>
    el?.addEventListener("click", handleActions)
  );

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
      (window.latestDiscountEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/discounts/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } finally {
        hideLoading();
      }
    }
    if (!entry) return showToast("❌ Discount not found");

    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("discounts:view"))
        return showToast("⛔ No permission to view discounts");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("discounts:edit") && !hasPerm("discounts:create"))
        return showToast("⛔ No permission to edit discounts");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("discounts:delete"))
        return showToast("⛔ No permission to delete discounts");
      return await handleDelete(id);
    }

    // --- Lifecycle Actions ---
    const lifecycleMap = {
      "toggle-status-btn": "toggle-status",
      "finalize-btn": "finalize",
      "void-btn": "void",
      "restore-btn": "restore",
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (!hasPerm(`discounts:${action}`) && !hasPerm("discounts:edit"))
          return showToast(`⛔ No permission to ${action} discounts`);
        if (action === "void") return await handleVoid(entry);
        return await handleLifecycle(id, entry, action);
      }
    }

    // --- Print ---
    if (cls.contains("print-btn")) {
      if (!hasPerm("discounts:view"))
        return showToast("⛔ No permission to print discounts");
      return handlePrint(entry);
    }
  }

  /* ============================================================
     🧩 Core Action Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Discount Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("discountEditId", entry.id);
    sessionStorage.setItem("discountEditPayload", JSON.stringify(entry));
    window.location.href = "add-discount.html";
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("🗑️ Delete this discount?");
    if (!confirmed) return;
    try {
      showLoading();
      const res = await authFetch(`/api/discounts/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete discount");
      showToast("✅ Discount deleted successfully");
      await loadEntries(1);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete discount");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🔄 Lifecycle Handler (Live Refresh)
  ============================================================ */
  async function handleLifecycle(id, entry, action) {
    const confirmMsg =
      action === "restore"
        ? "♻️ Restore this discount?"
        : `Proceed to ${action} this discount?`;
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    const url =
      action === "toggle-status"
        ? `/api/discounts/${id}/toggle-status`
        : `/api/discounts/${id}/${action}`;

    try {
      showLoading();
      const res = await authFetch(url, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.message || `❌ Failed to ${action}`);

      showToast(`✅ Discount ${action} successful`);
      await loadEntries(1); // ✅ Live refresh
    } catch (err) {
      showToast(err.message || `❌ Failed to ${action} discount`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🚫 Void Handler (Modal-Based Reason Input)
  ============================================================ */
  async function handleVoid(entry) {
    const id = entry.id;
    const status = (entry?.status || "").toLowerCase();
    if (status === "voided") return showToast("❌ Already voided");

    const modal = document.getElementById("discountVoidModal");
    const reasonInput = document.getElementById("voidReasonInput");
    const confirmBtn = document.getElementById("confirmVoidBtn");

    reasonInput.value = "";
    modal.classList.remove("hidden");

    confirmBtn.onclick = async () => {
      const reason = reasonInput.value.trim();
      if (!reason) return showToast("❌ Reason is required to void discount");

      const confirmed = await showConfirm("⚠️ Confirm voiding this discount?");
      if (!confirmed) return;

      try {
        showLoading();
        const res = await authFetch(`/api/discounts/${id}/void`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.message || "❌ Failed to void discount");

        showToast("✅ Discount voided successfully");
        modal.classList.add("hidden");

        // ✅ Live refresh
        await loadEntries(1);
      } catch (err) {
        showToast(err.message || "❌ Failed to void discount");
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
      printDiscountSummary(entry);
      showToast("🖨️ Printing discount summary...");
    } catch {
      showToast("❌ Failed to print discount summary");
    }
  }

  /* ============================================================
     🌐 Global Helpers (Enterprise Standard)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestDiscountEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewDiscount = (id) => {
    if (!hasPerm("discounts:view"))
      return showToast("⛔ No permission to view");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editDiscount = (id) => {
    if (!hasPerm("discounts:edit"))
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteDiscount = async (id) => {
    if (!hasPerm("discounts:delete"))
      return showToast("⛔ No permission to delete");
    await handleDelete(id);
  };

  ["toggle-status", "finalize", "void", "restore"].forEach((action) => {
    window[`${action}Discount`] = async (id) => {
      if (!hasPerm(`discounts:${action}`))
        return showToast(`⛔ No permission to ${action}`);
      const entry = findEntry(id);
      if (action === "void") return await handleVoid(entry);
      await handleLifecycle(id, entry, action);
    };
  });

  window.printDiscount = (id) => {
    if (!hasPerm("discounts:view"))
      return showToast("⛔ No permission to print");
    const entry = findEntry(id);
    if (entry) handlePrint(entry);
  };

  // 🔹 Universal modal close behavior
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.close;
      document.getElementById(id)?.classList.add("hidden");
    });
  });
}
