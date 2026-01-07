// 📦 discount-waiver-actions.js – Enterprise Master Pattern (v2.4 Modal Void Reason)
// ============================================================================
// 🔹 Mirrors discount-actions.js for unified permission-driven flow
// 🔹 Adds modal-based void reason (no browser prompt)
// 🔹 Includes instant post-action refresh (approve, reject, finalize, void, restore)
// 🔹 Superadmin bypass + unified permission normalization
// 🔹 Fully compatible with discount-waiver-filter-main.js
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./discount-waiver-render.js";
import { printDiscountWaiverSummary } from "./discount-waiver-summary.js";

/* ============================================================
   ⚙️ Unified Action Handler – Discount Waiver Module
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
  const tableBody = document.getElementById("discountWaiverTableBody");
  const cardContainer = document.getElementById("discountWaiverList");
  const modalBody = document.getElementById("viewModalBody");

  // 🗂️ Cache latest entries
  window.latestDiscountWaiverEntries = entries;

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
      (window.latestDiscountWaiverEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/discount-waivers/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Discount Waiver not found");

    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("discount-waivers:view"))
        return showToast("⛔ No permission to view waivers");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("discount-waivers:edit") && !hasPerm("discount-waivers:create"))
        return showToast("⛔ No permission to edit waivers");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("discount-waivers:delete"))
        return showToast("⛔ No permission to delete waivers");
      return await handleDelete(id);
    }

    // --- Lifecycle Actions ---
    const lifecycleMap = {
      "approve-btn": "approve",
      "reject-btn": "reject",
      "finalize-btn": "finalize",
      "void-btn": "void",
      "restore-btn": "restore",
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (!hasPerm(`discount-waivers:${action}`))
          return showToast(`⛔ No permission to ${action} waivers`);
        if (action === "void") return await handleVoid(entry);
        return await handleLifecycle(id, entry, action);
      }
    }

    // --- Print ---
    if (cls.contains("print-btn")) {
      if (!hasPerm("discount-waivers:view"))
        return showToast("⛔ No permission to print waivers");
      return handlePrint(entry);
    }
  }

  /* ============================================================
     🧩 Core Action Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Discount Waiver Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("discountWaiverEditId", entry.id);
    sessionStorage.setItem("discountWaiverEditPayload", JSON.stringify(entry));
    window.location.href = "add-discount-waiver.html";
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("🗑️ Delete this discount waiver?");
    if (!confirmed) return;
    try {
      showLoading();
      const res = await authFetch(`/api/discount-waivers/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete waiver");
      showToast("✅ Waiver deleted successfully");
      await loadEntries(1);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete waiver");
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
        ? "♻️ Restore this discount waiver?"
        : `Proceed to ${action} this waiver?`;
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    const url = `/api/discount-waivers/${id}/${action}`;

    try {
      showLoading();
      const res = await authFetch(url, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `❌ Failed to ${action}`);
      showToast(`✅ Waiver ${action} successful`);
      await loadEntries(1);
    } catch (err) {
      showToast(err.message || `❌ Failed to ${action} waiver`);
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

    const modal = document.getElementById("discountWaiverVoidModal");
    const reasonInput = document.getElementById("voidReasonInput");
    const confirmBtn = document.getElementById("confirmVoidBtn");

    reasonInput.value = "";
    modal.classList.remove("hidden");

    confirmBtn.onclick = async () => {
      const reason = reasonInput.value.trim();
      if (!reason) return showToast("❌ Reason is required to void waiver");

      const confirmed = await showConfirm("⚠️ Confirm voiding this waiver?");
      if (!confirmed) return;

      try {
        showLoading();
        const res = await authFetch(`/api/discount-waivers/${id}/void`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ void_reason: reason }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.message || "❌ Failed to void waiver");
        showToast("✅ Waiver voided successfully");
        modal.classList.add("hidden");
        await loadEntries(1);
      } catch (err) {
        showToast(err.message || "❌ Failed to void waiver");
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
      printDiscountWaiverSummary(entry);
      showToast("🖨️ Printing waiver summary...");
    } catch {
      showToast("❌ Failed to print waiver summary");
    }
  }

  /* ============================================================
     🌐 Global Helpers (Enterprise Standard)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestDiscountWaiverEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewDiscountWaiver = (id) => {
    if (!hasPerm("discount-waivers:view"))
      return showToast("⛔ No permission to view");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editDiscountWaiver = (id) => {
    if (!hasPerm("discount-waivers:edit"))
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteDiscountWaiver = async (id) => {
    if (!hasPerm("discount-waivers:delete"))
      return showToast("⛔ No permission to delete");
    await handleDelete(id);
  };

  ["approve", "reject", "finalize", "void", "restore"].forEach((action) => {
    window[`${action}DiscountWaiver`] = async (id) => {
      if (!hasPerm(`discount-waivers:${action}`))
        return showToast(`⛔ No permission to ${action}`);
      const entry = findEntry(id);
      if (action === "void") return await handleVoid(entry);
      await handleLifecycle(id, entry, action);
    };
  });

  window.printDiscountWaiver = (id) => {
    if (!hasPerm("discount-waivers:view"))
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
