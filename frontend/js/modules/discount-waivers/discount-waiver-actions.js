// 📦 discount-waiver-actions.js – Enterprise MASTER–ALIGNED (Deposit Actions Parity)
// ============================================================================
// 🔹 Pattern Source: deposit-actions.js (Enterprise MASTER)
// 🔹 Permission-driven + superadmin-aware (role + roleNames)
// 🔹 Unified lifecycle dispatcher (view / edit / delete / approve / reject / finalize / void / restore)
// 🔹 Safe fallback fetch (MASTER safety)
// 🔹 Modal-based void + reject reason (NO browser prompt)
// 🔹 Instant post-action refresh
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
import { renderCard } from "./discount-waiver-render.js";
import { printDiscountWaiverSummary } from "./discount-waiver-summary.js";

/**
 * Unified permission-aware action handler for Discount Waiver module
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
  const tableBody = document.getElementById("discountWaiverTableBody");
  const cardContainer = document.getElementById("discountWaiverList");
  const modalBody = document.getElementById("viewModalBody");

  // 🗂️ Cache latest entries
  window.latestDiscountWaiverEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);
  if (modalBody) modalBody.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Permissions
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
     🎯 Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestDiscountWaiverEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/discount-waivers/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Discount waiver not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Discount waiver data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("discount-waivers:view"))
        return showToast("⛔ No permission to view waivers");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (
        !hasPerm("discount-waivers:edit") &&
        !hasPerm("discount-waivers:create")
      )
        return showToast("⛔ No permission to edit waivers");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("discount-waivers:delete"))
        return showToast("⛔ No permission to delete waivers");
      return handleDelete(id);
    }

    if (cls.contains("reject-btn")) {
      if (!hasPerm("discount-waivers:reject"))
        return showToast("⛔ No permission to reject waivers");
      return handleReject(entry);
    }

    const lifecycleMap = {
      "approve-btn": "approve",
      "finalize-btn": "finalize",
      "void-btn": "void",
      "restore-btn": "restore",
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (!hasPerm(`discount-waivers:${action}`))
          return showToast(`⛔ No permission to ${action} waivers`);
        if (action === "void") return handleVoid(entry);
        return handleLifecycle(id, action);
      }
    }

    if (cls.contains("print-btn")) {
      if (!hasPerm("discount-waivers:view"))
        return showToast("⛔ No permission to print waivers");
      return handlePrint(entry);
    }
  }

  /* ============================================================
     ⚙️ Core Handlers
  ============================================================ */
  function handleView(entry) {
    openViewModal(
      "Discount Waiver Info",
      renderCard(entry, visibleFields, user)
    );
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("discountWaiverEditId", entry.id);
    sessionStorage.setItem("discountWaiverEditPayload", JSON.stringify(entry));
    window.location.href = "add-discount-waiver.html";
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this discount waiver?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/discount-waivers/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete waiver");

      showToast("✅ Waiver deleted");
      window.latestDiscountWaiverEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete waiver");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(`Proceed to ${action} this waiver?`);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(
        `/api/discount-waivers/${id}/${action}`,
        { method: "PATCH" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} waiver`);

      showToast(`✅ Waiver ${action} successful`);
      window.latestDiscountWaiverEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || `❌ Failed to ${action} waiver`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🚫 Reject (MODAL)
  ============================================================ */
  async function handleReject(entry) {
    const id = entry.id;

    const modal = document.getElementById("discountWaiverRejectModal");
    const reasonInput = document.getElementById("rejectReasonInput");
    const confirmBtn = document.getElementById("confirmRejectBtn");

    reasonInput.value = "";
    modal.classList.remove("hidden");

    confirmBtn.onclick = async () => {
      const reason = reasonInput.value.trim();
      if (!reason)
        return showToast("❌ Rejection reason is required");

      const confirmed = await showConfirm("Reject this discount waiver?");
      if (!confirmed) return;

      try {
        showLoading();
        const res = await authFetch(
          `/api/discount-waivers/${id}/reject`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.message || "❌ Failed to reject waiver");

        showToast("✅ Waiver rejected");
        modal.classList.add("hidden");
        window.latestDiscountWaiverEntries = [];
        await loadEntries(currentPage);
      } catch (err) {
        showToast(err.message || "❌ Failed to reject waiver");
      } finally {
        hideLoading();
      }
    };
  }

  /* ============================================================
     🚫 Void (MODAL)
  ============================================================ */
  async function handleVoid(entry) {
    const id = entry.id;

    const modal = document.getElementById("discountWaiverVoidModal");
    const reasonInput = document.getElementById("voidReasonInput");
    const confirmBtn = document.getElementById("confirmVoidBtn");

    reasonInput.value = "";
    modal.classList.remove("hidden");

    confirmBtn.onclick = async () => {
      const reason = reasonInput.value.trim();
      if (!reason)
        return showToast("❌ Reason is required to void waiver");

      const confirmed = await showConfirm("Void this discount waiver?");
      if (!confirmed) return;

      try {
        showLoading();
        const res = await authFetch(
          `/api/discount-waivers/${id}/void`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ void_reason: reason }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.message || "❌ Failed to void waiver");

        showToast("✅ Waiver voided");
        modal.classList.add("hidden");
        window.latestDiscountWaiverEntries = [];
        await loadEntries(currentPage);
      } catch (err) {
        showToast(err.message || "❌ Failed to void waiver");
      } finally {
        hideLoading();
      }
    };
  }

  /* ============================================================
     🖨️ Print
  ============================================================ */
  function handlePrint(entry) {
    printDiscountWaiverSummary(entry);
    showToast("🖨️ Printing waiver summary...");
  }

  /* ============================================================
     🌍 Global helpers
  ============================================================ */
  const findEntry = (id) =>
    (window.latestDiscountWaiverEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.rejectDiscountWaiver = async (id) => {
    if (!hasPerm("discount-waivers:reject"))
      return showToast("⛔ No permission to reject waivers");
    const entry = findEntry(id);
    if (entry) await handleReject(entry);
  };

  /* ============================================================
     ❌ MASTER MODAL CLOSE SUPPORT (FIX)
  ============================================================ */
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modalId = btn.dataset.close;
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.add("hidden");
    });
  });
}
