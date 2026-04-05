// 📦 discount-actions.js – Enterprise MASTER–ALIGNED (Deposit Parity)
// ============================================================================
// 🔹 Pattern Source: deposit-actions.js (Enterprise MASTER)
// 🔹 Permission-driven + superadmin-aware (role + roleNames)
// 🔹 Unified lifecycle dispatcher (view / edit / delete / toggle / finalize / void / restore)
// 🔹 Safe fallback fetch (MASTER safety)
// 🔹 Modal-based void reason preserved (NO browser prompt)
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
import { renderCard } from "./discount-render.js";
import { printDiscountSummary } from "./discount-summary.js";

/**
 * Unified permission-aware action handler for Discount module
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
  const tableBody = document.getElementById("discountTableBody");
  const cardContainer = document.getElementById("discountList");
  const modalBody = document.getElementById("viewModalBody");

  // 🗂️ Cache latest entries (MASTER PATTERN)
  window.latestDiscountEntries = entries;

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
      (window.latestDiscountEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch (MASTER SAFETY)
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/discounts/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Discount not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Discount data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("discounts:view"))
        return showToast("⛔ No permission to view discounts");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("discounts:edit") && !hasPerm("discounts:create"))
        return showToast("⛔ No permission to edit discounts");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("discounts:delete"))
        return showToast("⛔ No permission to delete discounts");
      return await handleDelete(id);
    }

    // 🔄 Lifecycle map (MASTER STYLE)
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
        return await handleLifecycle(id, action);
      }
    }

    if (cls.contains("print-btn")) {
      if (!hasPerm("discounts:print"))
        return showToast("⛔ No permission to print discounts");
      return handlePrint(entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
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
    const confirmed = await showConfirm("Delete this discount?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/discounts/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete discount");

      showToast("✅ Discount deleted successfully");
      window.latestDiscountEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete discount");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(
      `Proceed to ${action} this discount?`
    );
    if (!confirmed) return;

    const url =
      action === "toggle-status"
        ? `/api/discounts/${id}/toggle-status`
        : `/api/discounts/${id}/${action}`;

    try {
      showLoading();
      const res = await authFetch(url, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} discount`);

      showToast(`✅ Discount ${action} successful`);
      window.latestDiscountEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || `❌ Failed to ${action} discount`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🚫 Void Discount (Modal – MASTER-STYLE)
  ============================================================ */
  async function handleVoid(entry) {
    const id = entry.id;
    const status = (entry?.status || "").toLowerCase();
    if (status === "voided") return showToast("❌ Already voided");

    const modal = document.getElementById("discountVoidModal");
    const reasonInput = document.getElementById("voidReasonInput");
    const confirmBtn = document.getElementById("confirmVoidBtn");

    if (!modal || !reasonInput || !confirmBtn)
      return showToast("❌ Void modal not available");

    reasonInput.value = "";
    openModal("discountVoidModal");

    confirmBtn.onclick = async () => {
      const reason = reasonInput.value.trim();
      if (!reason)
        return showToast("❌ Reason is required to void discount");

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
        closeModal("discountVoidModal");
        window.latestDiscountEntries = [];
        await loadEntries(currentPage);
      } catch (err) {
        showToast(err.message || "❌ Failed to void discount");
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
      printDiscountSummary(entry);
      showToast("🖨️ Printing discount summary...");
    } catch {
      showToast("❌ Failed to print discount summary");
    }
  }

  /* ============================================================
     🪟 Modal Helpers (MASTER)
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
    (window.latestDiscountEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewDiscount = (id) => {
    if (!hasPerm("discounts:view"))
      return showToast("⛔ No permission to view discounts");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editDiscount = (id) => {
    if (!hasPerm("discounts:edit") && !hasPerm("discounts:create"))
      return showToast("⛔ No permission to edit discounts");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteDiscount = async (id) => {
    if (!hasPerm("discounts:delete"))
      return showToast("⛔ No permission to delete discounts");
    await handleDelete(id);
  };

  ["toggle-status", "finalize", "void", "restore"].forEach((action) => {
    window[`${action}Discount`] = async (id) => {
      if (!hasPerm(`discounts:${action}`) && !hasPerm("discounts:edit"))
        return showToast(`⛔ No permission to ${action} discounts`);
      const entry = findEntry(id);
      if (action === "void") return await handleVoid(entry);
      await handleLifecycle(id, action);
    };
  });

  window.printDiscount = (id) => {
    if (!hasPerm("discounts:print"))
      return showToast("⛔ No permission to print discounts");
    const entry = findEntry(id);
    if (entry) handlePrint(entry);
  };

  // 🔹 Backward compatibility
  window.viewEntry = window.viewDiscount;
  window.editEntry = window.editDiscount;
  window.deleteEntry = window.deleteDiscount;

  // 🔹 Close modal buttons
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });
}
