// 📦 invoice-actions.js – Enterprise MASTER ENGINE (PART 1 UPGRADE)
// ============================================================================
// 🔹 Adds: permission normalization + roleNames superadmin
// 🔹 Adds: lifecycle map (Deposit parity)
// 🔹 Improves dispatcher structure
// 🔹 Keeps ALL modals 100% untouched
// 🔹 NO endpoint changes
// ============================================================================

import {
  showToast,
  showConfirm,
  showLoading,
  hideLoading,
  openViewModal,
} from "../../../utils/index.js";
import { authFetch } from "../../../authSession.js";
import { renderCard } from "./invoice-render.js";
import { buildInvoiceReceiptHTML } from "./invoice-receipt.js";
import { printDocument } from "../../../templates/printTemplate.js";
import {
  PAYMENT_METHODS,
  DISCOUNT_TYPE,
  REVERSE_TYPES,
} from "../../../utils/constants.js";

/* ============================================================
   ⚙️ Unified Action Handler – Invoice Module
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
  const tableBody = document.getElementById("invoiceTableBody");
  const cardContainer = document.getElementById("invoiceList");
  const modalBody = document.getElementById("viewModalBody");

  // 🔥 MASTER cache
  window.latestInvoiceEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);
  if (modalBody) modalBody.addEventListener("click", handleActions);

  /* ============================================================
     🔐 Permission + Role Normalization (MASTER FIXED)
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

  // 🔥 SUPERADMIN FIX (role + roleNames)
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
     🔄 Lifecycle Map (MASTER STYLE)
  ============================================================ */
  const lifecycleMap = {
    "toggle-status": "toggle-status",
    void: "void",
    restore: "restore",
  };

  /* ============================================================
     🎛️ MAIN DISPATCHER (UPGRADED)
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    let entry =
      (window.latestInvoiceEntries || entries || []).find(
        (x) =>
          String(x.id) === String(id) ||
          String(x.invoice_id) === String(id)
      ) || null;

    // 🔥 Fallback fetch (MASTER SAFETY)
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/invoices/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Invoice not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Invoice data missing");

    /* =========================
       👁️ VIEW
    ========================= */
    if (action === "view") {
      if (!hasPerm("invoices:view") && !hasPerm("invoices:print"))
        return showToast("⛔ No permission to view invoices");
      return handleView(entry);
    }

    /* =========================
       🗑️ DELETE
    ========================= */
    if (action === "delete") {
      if (!hasPerm("invoices:delete"))
        return showToast("⛔ No permission to delete invoices");
      return await handleDelete(id);
    }

    /* =========================
       🔁 LIFECYCLE (MASTER)
    ========================= */
    if (lifecycleMap[action]) {
      const normalizedAction = lifecycleMap[action];

      if (
        !hasPerm(`invoices:${normalizedAction}`) &&
        !hasPerm("invoices:edit")
      )
        return showToast(`⛔ No permission to ${normalizedAction}`);

      if (normalizedAction === "toggle-status") {
        return await handleToggleStatus(id, entry);
      }

      return await handleLifecycleAction(id, normalizedAction);
    }

    /* =========================
       💰 MODALS (UNCHANGED)
    ========================= */
    const actionModalMap = {
      collect: "paymentModal",
      refund: "refundModal",
      deposit: "depositModal",
      waiver: "waiverModal",
      reverse: "reverseModal",
    };

    if (actionModalMap[action]) {
      if (!hasPerm(`invoices:${action}`))
        return showToast(`⛔ No permission to ${action} invoices`);

      const extra = {
        transId: btn.dataset.transId || "",
        type: btn.dataset.type || "",
      };

      return openModal(actionModalMap[action], id, entry, extra);
    }

    /* =========================
       🖨️ PRINT
    ========================= */
    if (action === "print") {
      if (!hasPerm("invoices:print"))
        return showToast("⛔ No permission to print invoices");
      return handlePrint(entry);
    }
  }

  /* ============================================================
     🧩 CORE HANDLERS (UNCHANGED)
  ============================================================ */
  function handleView(entry) {
    const html = renderInvoiceDetail
      ? renderInvoiceDetail(entry, user)
      : renderCard(entry, visibleFields, user);
    openViewModal("Invoice Details", html);
  }

  async function handleToggleStatus(id, entry) {
    const confirmed = await showConfirm(
      `Toggle status for this invoice?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/invoices/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed");

      showToast(`✅ Status updated`);
      window.latestInvoiceEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this invoice?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/invoices/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed");

      showToast("✅ Deleted");
      window.latestInvoiceEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycleAction(id, action) {
    const confirmed = await showConfirm(
      `Proceed to ${action} this invoice?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/invoices/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed");

      showToast(`✅ ${action} successful`);
      window.latestInvoiceEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed");
    } finally {
      hideLoading();
    }
  }

  async function handlePrint(entry) {
    if (!entry?.id) return showToast("❌ Invalid invoice");

    try {
      showLoading();
      const res = await authFetch(`/api/invoices/${entry.id}?print=true`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.data)
        throw new Error("❌ Failed to load invoice");

      const html = buildInvoiceReceiptHTML(data.data);

      await printDocument(html, {
        title: "Invoice Receipt",
        invoice: data.data,
        branding: JSON.parse(localStorage.getItem("branding") || "{}"),
      });

      showToast("🖨️ Printing...");
    } catch (err) {
      showToast(err.message || "❌ Failed");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🪟 MODALS (UNTOUCHED)
  ============================================================ */
  // 🔥 YOUR MODAL SYSTEM REMAINS EXACTLY AS IS
}

/* ============================================================
   🪟 MODALS (PRESERVED + MASTER POLISH)
============================================================ */
async function openModal(modalId, invoiceId, entry, extra = {}) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.remove("hidden");

  // 🔥 DATA BIND (MASTER SAFE)
  modal.dataset.invoiceId = invoiceId;
  modal.dataset.patientId = entry?.patient_id || entry?.patient?.id || "";
  modal.dataset.organizationId = entry?.organization_id || "";
  modal.dataset.facilityId = entry?.facility_id || "";
  modal.dataset.currency = entry?.currency || "USD";
  modal.dataset.type = extra.type || "";

  const form = modal.querySelector("form");
  if (form) form.reset();

  /* ============================================================
     💰 PAYMENT MODAL (ENHANCED BUT SAFE)
  ============================================================ */
  if (modalId === "paymentModal") {
    const amountInput = document.getElementById("paymentAmount");
    const fullCheck = document.getElementById("payFullBalance");

    const balance = Number(
      entry?.balance ?? entry?.amount_due ?? entry?.total_due ?? 0
    );

    if (balance <= 0) {
      showToast("⚠️ No balance due");
      return closeModal("paymentModal");
    }

    if (amountInput && fullCheck) {
      amountInput.value = balance.toFixed(2);
      amountInput.max = balance.toFixed(2);
      amountInput.min = "0.01";
      amountInput.readOnly = true;
      fullCheck.checked = true;

      fullCheck.onchange = () => {
        if (fullCheck.checked) {
          amountInput.value = balance.toFixed(2);
          amountInput.readOnly = true;
        } else {
          amountInput.readOnly = false;
          amountInput.focus();
          amountInput.select();
        }
      };
    }
  }

  /* ============================================================
     🔁 REVERSE
  ============================================================ */
  if (modalId === "reverseModal" && extra.transId) {
    const el = document.getElementById("reverseTransId");
    if (el) el.value = extra.transId;
  }

  /* ============================================================
     🔽 DROPDOWN POPULATION (MASTER SAFE)
  ============================================================ */
  const dropdownMap = {
    paymentModal: PAYMENT_METHODS,
    depositModal: PAYMENT_METHODS,
    waiverModal: DISCOUNT_TYPE,
    reverseModal: REVERSE_TYPES,
  };

  if (dropdownMap[modalId]) {
    const selectIdMap = {
      paymentModal: "paymentMethod",
      depositModal: "depositMethod",
      waiverModal: "waiverType",
      reverseModal: "reverseType",
    };

    const select = document.getElementById(selectIdMap[modalId]);
    if (select) {
      select.innerHTML = `<option value="">-- Choose --</option>`;
      dropdownMap[modalId].forEach((optVal) => {
        const opt = document.createElement("option");
        opt.value = optVal;
        opt.textContent =
          optVal.charAt(0).toUpperCase() +
          optVal.slice(1).replace(/_/g, " ");
        select.appendChild(opt);
      });
    }
  }

  /* ============================================================
     💸 REFUND LOAD (MASTER SAFE)
  ============================================================ */
  if (modalId === "refundModal") {
    const select = document.getElementById("refundPaymentSelect");
    if (!select) return;

    select.innerHTML = `<option value="">-- Choose Payment --</option>`;

    try {
      showLoading();
      const res = await authFetch(`/api/payments?invoice_id=${invoiceId}`);
      const { data } = await res.json();

      const payments = data?.records || [];

      if (!payments.length) {
        select.innerHTML = `<option value="">No payments found</option>`;
      } else {
        payments.forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.id;

          const currency = p.currency || entry.currency || "USD";

          opt.textContent = `${p.method} · ${currency} ${Number(
            p.amount
          ).toFixed(2)} · ${p.status}`;

          select.appendChild(opt);
        });
      }
    } catch {
      showToast("❌ Failed to load payments");
    } finally {
      hideLoading();
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.add("hidden");

  ["invoiceId", "patientId", "organizationId", "facilityId", "type"].forEach(
    (k) => delete modal.dataset[k]
  );

  const form = modal.querySelector("form");
  if (form) form.reset();
}

/* ============================================================
   🧾 FORM HANDLERS (STANDARDIZED)
============================================================ */
function bindFormOnce(formId, handler) {
  const form = document.getElementById(formId);
  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", handler);
  }
}

async function submitAction(endpoint, payload) {
  try {
    showLoading();

    const res = await authFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.message || "❌ Failed");

    showToast(`✅ ${data.message || "Success"}`);
    window.latestInvoiceEntries = [];
    await loadEntries(currentPage);
  } catch (err) {
    showToast(err.message || "❌ Failed");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🔹 FORM BINDINGS (UNCHANGED BUT CLEAN)
============================================================ */
bindFormOnce("paymentForm", async (e) => {
  e.preventDefault();
  const m = document.getElementById("paymentModal");

  await submitAction("/api/invoices/apply-payment", {
    invoice_id: m.dataset.invoiceId,
    patient_id: m.dataset.patientId,
    amount: Number(document.getElementById("paymentAmount").value),
    method: document.getElementById("paymentMethod").value,
    transaction_ref: document.getElementById("paymentRef").value,
    currency: m.dataset.currency,
  });

  closeModal("paymentModal");
});

bindFormOnce("refundForm", async (e) => {
  e.preventDefault();

  const paymentId = document.getElementById("refundPaymentSelect")?.value;
  if (!paymentId) return showToast("❌ Select payment");

  await submitAction("/api/invoices/apply-refund", {
    payment_id: paymentId,
    amount: Number(document.getElementById("refundAmount").value),
    reason: document.getElementById("refundReason").value,
  });

  closeModal("refundModal");
});

bindFormOnce("depositForm", async (e) => {
  e.preventDefault();
  const m = document.getElementById("depositModal");

  await submitAction("/api/invoices/apply-deposit", {
    invoice_id: m.dataset.invoiceId,
    patient_id: m.dataset.patientId,
    organization_id: m.dataset.organizationId,
    facility_id: m.dataset.facilityId || null,
    amount: Number(document.getElementById("depositAmount").value),
    method: document.getElementById("depositMethod").value,
    currency: m.dataset.currency,
  });

  closeModal("depositModal");
});

bindFormOnce("waiverForm", async (e) => {
  e.preventDefault();
  const m = document.getElementById("waiverModal");

  await submitAction("/api/invoices/apply-waiver", {
    invoice_id: m.dataset.invoiceId,
    patient_id: m.dataset.patientId,
    organization_id: m.dataset.organizationId,
    facility_id: m.dataset.facilityId || null,
    type: document.getElementById("waiverType").value,
    value: Number(document.getElementById("waiverValue").value),
    reason: document.getElementById("waiverReason").value,
  });

  closeModal("waiverModal");
});

bindFormOnce("reverseForm", async (e) => {
  e.preventDefault();
  const m = document.getElementById("reverseModal");

  await submitAction("/api/invoices/reverse-transaction", {
    id: document.getElementById("reverseTransId").value,
    type: m.dataset.type || document.getElementById("reverseType").value,
    reason: document.getElementById("reverseReason").value,
  });

  closeModal("reverseModal");
});

/* ============================================================
   🌍 GLOBAL HELPERS (MASTER PARITY)
============================================================ */
const findEntry = (id) =>
  (window.latestInvoiceEntries || entries || []).find(
    (x) => String(x.id) === String(id)
  );

window.viewInvoice = (id) => {
  if (!hasPerm("invoices:view"))
    return showToast("⛔ No permission");
  const entry = findEntry(id);
  entry ? handleView(entry) : showToast("❌ Not found");
};

window.deleteInvoice = async (id) => {
  if (!hasPerm("invoices:delete"))
    return showToast("⛔ No permission");
  await handleDelete(id);
};

["toggle-status", "void", "restore"].forEach((action) => {
  window[`${action}Invoice`] = async (id) => {
    if (!hasPerm(`invoices:${action}`) && !hasPerm("invoices:edit"))
      return showToast("⛔ No permission");

    const entry = findEntry(id);

    if (action === "toggle-status") {
      return await handleToggleStatus(id, entry);
    }

    return await handleLifecycleAction(id, action);
  };
});

window.printInvoice = (id) => {
  if (!hasPerm("invoices:print"))
    return showToast("⛔ No permission");
  const entry = findEntry(id);
  entry ? handlePrint(entry) : showToast("❌ Not found");
};

/* ============================================================
   🔚 FINAL: CLOSE BUTTONS
============================================================ */
document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () =>
    closeModal(btn.dataset.close)
  );
});