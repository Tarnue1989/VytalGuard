// 📁 add-discount.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors add-deposit.js for unified lifecycle & RBAC consistency
// 🔹 Maintains all discount-specific IDs, logic, and API endpoints intact
// 🔹 Adds role-aware organization/facility cascade, tooltips, and safe guards
// ============================================================================

import { setupDiscountFormSubmission } from "./discount-form.js";
import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
  loadInvoiceItemsLite,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard + Session Watch
============================================================ */
const token = initPageGuard(autoPagePermissionKey(["discounts:create", "discounts:edit"]));
initLogoutWatcher();

/* ============================================================
   🧩 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  const form = document.getElementById("discountForm");
  if (!form) return;
  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset hidden IDs
  ["invoiceId", "invoiceItemId", "organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Discount";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Discount`;

  // Hide reason field on add
  document.getElementById("reasonGroup")?.classList.add("hidden");
}

/* ============================================================
   🚀 Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("discountForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const invoiceInput = document.getElementById("invoiceInput");
  const invoiceHidden = document.getElementById("invoiceId");
  const invoiceSuggestions = document.getElementById("invoiceSuggestions");
  const invoiceItemSelect = document.getElementById("invoiceItemId");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🏢 Organizations
  ============================================================ */
  if (userRole.includes("super")) {
    try {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
    } catch (err) {
      console.error("❌ Organizations preload failed", err);
      showToast("❌ Could not load organizations");
    }
  } else {
    orgSelect?.closest(".form-group")?.classList.add("hidden");
  }

  /* ============================================================
     🏭 Facilities
  ============================================================ */
  async function reloadFacilities(orgId = null) {
    try {
      const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } catch (err) {
      console.error("❌ Facilities preload failed", err);
      showToast("❌ Could not load facilities");
    }
  }

  if (userRole.includes("super")) {
    orgSelect?.addEventListener("change", async () => {
      await reloadFacilities(orgSelect.value || null);
    });
  } else if (userRole.includes("admin")) {
    await reloadFacilities(); // Admins see scoped facilities
  } else {
    facSelect?.closest(".form-group")?.classList.add("hidden");
  }

  /* ============================================================
     💳 Invoice Suggestion + Item Loader
  ============================================================ */
  setupSuggestionInputDynamic(
    invoiceInput,
    invoiceSuggestions,
    "/api/lite/invoices",
    async (selected) => {
      invoiceHidden.value = selected?.id || "";

      if (selected) {
        invoiceInput.value =
          selected.label ||
          `${selected.invoice_number || ""} · Balance ${selected.balance || ""}`;

        if (selected.id && invoiceItemSelect) {
          try {
            const items = await loadInvoiceItemsLite(selected.id, {}, true);
            const filtered = items.filter((x) => !["voided", "cancelled"].includes(x.status));

            filtered.forEach((item) => {
              item.displayLabel =
                item.label ||
                `${item.description || "Item"} · Qty ${item.quantity || 1} · $${item.net_amount || item.total_price || ""}`;
            });

            setupSelectOptions(invoiceItemSelect, filtered, "id", "displayLabel", "-- Apply to whole invoice --");
          } catch (err) {
            console.error("❌ Failed to load invoice items:", err);
            setupSelectOptions(invoiceItemSelect, [], "id", "description", "-- Apply to whole invoice --");
          }
        }
      } else {
        invoiceHidden.value = "";
        setupSelectOptions(invoiceItemSelect, [], "id", "description", "-- Apply to whole invoice --");
      }
    },
    "label"
  );

  /* ============================================================
     💾 Form Submission Integration
  ============================================================ */
  setupDiscountFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Prefill
  ============================================================ */
  const editId = sessionStorage.getItem("discountEditId");
  const rawPayload = sessionStorage.getItem("discountEditPayload");

  async function applyPrefill(entry) {
    const typeEl = document.getElementById("typeSelect");
    const valueEl = document.getElementById("value");
    const reasonEl = document.getElementById("reason");

    if (typeEl) typeEl.value = entry.type || "";
    if (valueEl) valueEl.value = entry.value || "";
    if (reasonEl && entry.reason) {
      reasonEl.value = entry.reason;
      document.getElementById("reasonGroup")?.classList.remove("hidden");
    }

    // 🏢 Prefill organization + facility
    const orgId = entry.organization?.id || entry.organization_id;
    const facId = entry.facility?.id || entry.facility_id;
    if (orgId && orgSelect) {
      orgSelect.value = orgId;
      await reloadFacilities(orgId);
    }
    if (facId && facSelect) facSelect.value = facId;

    // 💳 Prefill invoice + items
    if (entry.invoice) {
      invoiceHidden.value = entry.invoice.id;
      invoiceInput.value = entry.invoice.invoice_number;

      if (invoiceItemSelect && entry.invoice.id) {
        const items = await loadInvoiceItemsLite(entry.invoice.id, {}, true);
        const filtered = items.filter((x) => !["voided", "cancelled"].includes(x.status));

        filtered.forEach((item) => {
          item.displayLabel =
            item.label ||
            `${item.description || "Item"} · Qty ${item.quantity || 1} · $${item.net_amount || item.total_price || ""}`;
        });

        setupSelectOptions(invoiceItemSelect, filtered, "id", "displayLabel", "-- Apply to whole invoice --");
        if (entry.invoice_item_id) invoiceItemSelect.value = entry.invoice_item_id;
      }
    }

    // 🧭 Update UI
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Discount";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Discount`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached edit payload:", err);
      showToast("❌ Could not load cached discount for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/discounts/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry) throw new Error(result.message || "❌ Failed to fetch discount");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load discount:", err);
        showToast(err.message || "❌ Failed to load discount for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel & Clear Buttons
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("discountEditId");
    sessionStorage.removeItem("discountEditPayload");
    window.location.href = "/discounts-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("discountEditId");
    sessionStorage.removeItem("discountEditPayload");
    resetForm();
  });
});
