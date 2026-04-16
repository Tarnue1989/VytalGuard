// 📦 payroll-actions.js – FULLY UPDATED (Controller-Aligned)

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./payroll-render.js";

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
  const tableBody = document.getElementById("payrollTableBody");
  const cardContainer = document.getElementById("payrollList");
  const modalBody = document.getElementById("viewModalBody");

  window.latestPayrollEntries = entries;

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
      (window.latestPayrollEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/payrolls/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Payroll not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Payroll data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("payrolls:read"))
        return showToast("⛔ No permission to view payroll");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("payrolls:update") && !hasPerm("payrolls:create"))
        return showToast("⛔ No permission to edit payroll");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("payrolls:delete"))
        return showToast("⛔ No permission to delete payroll");
      return await handleDelete(entry);
    }

    const lifecycleMap = {
      "approve-btn": "approve",
      "pay-btn": "pay",
      "void-btn": "void",
      "restore-btn": "restore",
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (!hasPerm(`payrolls:${action}`) && !hasPerm("payrolls:update"))
          return showToast(`⛔ No permission to ${action} payroll`);

        return await handleLifecycle(entry, action);
      }
    }
  }

  /* ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Payroll Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("payrollEditId", entry.id);
    sessionStorage.setItem("payrollEditPayload", JSON.stringify(entry));
    window.location.href = "add-payroll.html";
  }

  async function handleDelete(entry) {
    if ((entry.status || "").toLowerCase() !== "draft") {
      return showToast("❌ Only draft payroll can be deleted");
    }

    const confirmed = await showConfirm("Delete this payroll?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/payrolls/${entry.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete payroll");

      showToast("✅ Payroll deleted successfully");
      window.latestPayrollEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete payroll");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(entry, action) {
    const status = (entry.status || "").toLowerCase();

    // 🔐 Strict backend alignment
    if (action === "approve" && status !== "draft") {
      return showToast("❌ Only draft payroll can be approved");
    }

    if (action === "pay" && status !== "approved") {
      return showToast("❌ Only approved payroll can be paid");
    }

    const confirmed = await showConfirm(
      `Proceed to ${action} this payroll?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/payrolls/${entry.id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} payroll`);

      showToast(`✅ Payroll ${action} successful`);
      window.latestPayrollEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || `❌ Failed to ${action} payroll`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================ */
  const findEntry = (id) =>
    (window.latestPayrollEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewPayroll = (id) => {
    if (!hasPerm("payrolls:read"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editPayroll = (id) => {
    if (!hasPerm("payrolls:update") && !hasPerm("payrolls:create"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deletePayroll = async (id) => {
    if (!hasPerm("payrolls:delete"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) await handleDelete(entry);
  };

  ["approve", "pay", "void", "restore"].forEach((action) => {
    window[`${action}Payroll`] = async (id) => {
      if (!hasPerm(`payrolls:${action}`) && !hasPerm("payrolls:update"))
        return showToast(`⛔ No permission to ${action}`);
      const entry = findEntry(id);
      if (entry) await handleLifecycle(entry, action);
    };
  });

  window.viewEntry = window.viewPayroll;
  window.editEntry = window.editPayroll;
  window.deleteEntry = window.deletePayroll;

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () =>
      document.getElementById(btn.dataset.close)?.classList.add("hidden")
    );
  });
}