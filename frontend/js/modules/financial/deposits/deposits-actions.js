// 📁 assets/js/modules/financial/invoices/deposits/deposits-actions.js
import {
  showToast,
  showConfirm,
  showLoading,
  hideLoading,
} from "../../../utils/index.js";
import { authFetch } from "../../../authSession.js";
import { renderDepositCard, renderDepositDetail } from "./deposits-render.js";

// 🔹 Import enums
import { PAYMENT_METHODS } from "../../../utils/constants.js";

export function setupDepositActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
}) {
  const tableBody = document.getElementById("depositTableBody");
  const cardContainer = document.getElementById("depositList");

  // cache last entries
  window.latestDepositEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestDepositEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback: fetch full record if not cached
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

    const classList = btn.classList;

    if (classList.contains("view-btn")) return handleView(entry);
    if (classList.contains("delete-btn")) return await handleDelete(id, entry);
    if (classList.contains("reverse-btn")) return openModal("reverseModal", id, entry);
  }

  /* ---------------------- handlers ---------------------- */

  function handleView(entry) {
    let role = (localStorage.getItem("userRole") || "").trim().toLowerCase();
    if (role.includes("super") && role.includes("admin")) role = "superadmin";
    else if (role.includes("admin")) role = "admin";
    else role = "staff";

    const html = renderDepositDetail(entry, role);
    const modal = document.getElementById("viewModal");
    modal.querySelector("#viewModalTitle").textContent = "Deposit Details";
    modal.querySelector("#viewModalBody").innerHTML = html;
    modal.classList.remove("hidden");
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this deposit? (Admin only)");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/deposits/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete deposit");

      showToast(`✅ Deposit deleted successfully`);
      window.latestDepositEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete deposit");
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- modal helpers ---------------------- */

  async function openModal(modalId, depositId, entry) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.dataset.depositId = depositId;

    // reset form
    const form = modal.querySelector("form");
    if (form) form.reset();

    if (modalId === "depositModal") {
      const select = document.getElementById("depositMethod");
      if (select) {
        select.innerHTML = `<option value="">-- Choose Method --</option>`;
        PAYMENT_METHODS.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m;
          opt.textContent = m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          select.appendChild(opt);
        });
      }
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add("hidden");
    delete modal.dataset.depositId;

    const form = modal.querySelector("form");
    if (form) form.reset();
  }

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  /* ---------------------- form submissions ---------------------- */

  function bindFormOnce(formId, handler) {
    const form = document.getElementById(formId);
    if (form && !form.dataset.bound) {
      form.dataset.bound = "true";
      form.addEventListener("submit", handler);
    }
  }

  // Deposit
  bindFormOnce("depositForm", async (e) => {
    e.preventDefault();
    const modal = document.getElementById("depositModal");
    const invoiceId = modal.dataset.invoiceId;
    const patientId = modal.dataset.patientId;
    const organizationId = modal.dataset.organizationId;
    const facilityId = modal.dataset.facilityId;
    const amount = document.getElementById("depositAmount").value;
    const method = document.getElementById("depositMethod").value;

    if (!patientId || !organizationId) {
      return showToast("❌ Missing patient / organization context");
    }

    await submitAction("/api/deposits", {
      invoice_id: invoiceId,
      patient_id: patientId,
      organization_id: organizationId,
      facility_id: facilityId || null,
      amount: Number(amount),
      method,
    });
    closeModal("depositModal");
  });

  // Reverse
  bindFormOnce("reverseForm", async (e) => {
    e.preventDefault();
    const modal = document.getElementById("reverseModal");
    const id = modal.dataset.depositId;
    const reason = document.getElementById("reverseReason").value;

    if (!id) return showToast("❌ Missing deposit ID for reversal");

    await submitAction(`/api/deposits/${id}/reverse`, { reason });
    closeModal("reverseModal");
  });

  /* ---------------------- submit wrapper ---------------------- */

  async function submitAction(endpoint, payload) {
    try {
      showLoading();
      const res = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `❌ Failed`);

      showToast(`✅ ${data.message || "Action successful"}`);

      window.latestDepositEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to perform action");
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- global helpers ---------------------- */
  window.viewDeposit = (id) => {
    const btn = document.querySelector(`.view-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ View button not found");
  };

  window.deleteDeposit = (id) => {
    const btn = document.querySelector(`.delete-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Delete button not found");
  };

  window.reverseDeposit = (id) => {
    const btn = document.querySelector(`.reverse-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Reverse button not found");
  };
}
