// 📁 discount-form.js – Enterprise Master Pattern Aligned (Add/Edit Discount)
// ============================================================================
// 🔹 Mirrors autoBillingRule-form.js for unified tenant + role visibility
// 🔹 Permission-driven org/facility logic (super → admin → facility-level)
// 🔹 Preserves all DOM IDs, event wiring, and backend flow
// ============================================================================

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
  loadInvoiceItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   🧩 Helpers
============================================================ */
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function normalizeMessage(result, fallback) {
  if (!result) return fallback;
  const msg = result.message ?? result.error ?? result.msg;
  if (typeof msg === "string") return msg;
  if (msg?.detail) return msg.detail;
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}

function normalizeUUID(val) {
  return val && val.trim() !== "" ? val : null;
}

function resolveTenantScope() {
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
  const userOrg = localStorage.getItem("organization_id") || null;
  const userFac = localStorage.getItem("facility_id") || null;
  return {
    userRole,
    userOrg,
    userFac,
    isSuper: userRole.includes("super"),
    isAdmin: userRole.includes("admin"),
    isFacilityHead:
      userRole.includes("facilityhead") || userRole.includes("manager"),
  };
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupDiscountFormSubmission({ form }) {
  const token = initPageGuard(autoPagePermissionKey(["discounts:create", "discounts:edit"]));
  initLogoutWatcher();

  const queryId = getQueryParam("id");
  const sessionId = sessionStorage.getItem("discountEditId");
  const discountId = sessionId || queryId;
  const isEdit = !!discountId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");

  if (isEdit) {
    titleEl && (titleEl.textContent = "Edit Discount");
    submitBtn &&
      (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Discount`);
  } else {
    titleEl && (titleEl.textContent = "Add Discount");
    submitBtn &&
      (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Discount`);
  }

  // 📋 DOM refs
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const invoiceInput = document.getElementById("invoiceInput");
  const invoiceHidden = document.getElementById("invoiceId");
  const invoiceSuggestions = document.getElementById("invoiceSuggestions");
  const invoiceItemSelect = document.getElementById("invoiceItemId");
  const typeSelect = document.getElementById("typeSelect");
  const valueInput = document.getElementById("value");
  const reasonInput = document.getElementById("reason");

  let maxAllowed = null;

  /* ============================================================
     🔽 Prefill Dropdowns (Org/Facility visibility logic)
  ============================================================ */
  try {
    const { isSuper, isAdmin, userOrg } = resolveTenantScope();

    if (isSuper) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }

      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
    } else if (isAdmin) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({ organization_id: userOrg }, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // Invoice suggestion loader
    setupSuggestionInputDynamic(
      invoiceInput,
      invoiceSuggestions,
      "/api/lite/invoices",
      async (selected) => {
        invoiceHidden.value = selected?.id || "";
        maxAllowed = selected?.balance ? parseFloat(selected.balance) : 0;

        if (selected && invoiceItemSelect) {
          try {
            const items = await loadInvoiceItemsLite(selected.id, {}, true);
            const filtered = items.filter(
              (x) => !["voided", "cancelled"].includes(x.status)
            );
            filtered.forEach((item) => {
              item.displayLabel = `${item.description || "Item"} · Qty ${
                item.quantity || 1
              } · $${item.net_amount || item.total_price || 0}`;
            });
            setupSelectOptions(
              invoiceItemSelect,
              filtered,
              "id",
              "displayLabel",
              "-- Apply to whole invoice --"
            );
            invoiceItemSelect.addEventListener("change", () => {
              const chosen = filtered.find((x) => x.id === invoiceItemSelect.value);
              maxAllowed = chosen
                ? parseFloat(chosen.net_amount || chosen.total_price || 0)
                : parseFloat(selected.balance || 0);
            });
          } catch {
            invoiceItemSelect.innerHTML = `<option value="">-- Apply to whole invoice --</option>`;
          }
        } else {
          invoiceHidden.value = "";
          invoiceItemSelect.innerHTML = `<option value="">-- Apply to whole invoice --</option>`;
        }
      },
      "label"
    );
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     🧩 Prefill If Editing
  ============================================================ */
  if (isEdit && discountId) {
    try {
      showLoading();
      let entry = null;
      const cached = sessionStorage.getItem("discountEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        const res = await authFetch(`/api/discounts/${discountId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(normalizeMessage(result, `❌ Failed to load discount`));
        entry = result.data;
      }

      // Populate fields
      orgSelect.value = entry.organization_id || "";
      facSelect.value = entry.facility_id || "";
      typeSelect.value = entry.type || "";
      valueInput.value = entry.value || "";
      reasonInput.value = entry.reason || "";
      if (entry.invoice) {
        invoiceInput.value = entry.invoice.invoice_number;
        invoiceHidden.value = entry.invoice.id;
      }
    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load discount");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     💾 Submit Handler (Role-aware enforcement)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    try {
      showLoading();

      const { isSuper, isAdmin, userOrg, userFac } = resolveTenantScope();

      const payload = {
        invoice_id: normalizeUUID(invoiceHidden.value),
        invoice_item_id: normalizeUUID(invoiceItemSelect?.value || null),
        type: typeSelect?.value || null,
        value: parseFloat(valueInput?.value || 0) || null,
        reason: reasonInput?.value || null,
        organization_id: orgSelect?.value || null,
        facility_id: facSelect?.value || null,
      };

      // Enforce tenant scoping
      if (isSuper) {
        payload.organization_id = orgSelect.value || null;
        payload.facility_id = facSelect.value || null;
      } else if (isAdmin) {
        payload.organization_id = userOrg;
        payload.facility_id = facSelect.value || null;
      } else {
        payload.organization_id = userOrg;
        payload.facility_id = userFac;
      }

      const url = isEdit ? `/api/discounts/${discountId}` : `/api/discounts`;
      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      if (isEdit) {
        showToast("✅ Discount updated successfully");
        sessionStorage.removeItem("discountEditId");
        sessionStorage.removeItem("discountEditPayload");
        window.location.href = "/discounts-list.html";
      } else {
        showToast("✅ Discount created successfully");
        form.reset();
        invoiceHidden.value = "";
        invoiceItemSelect.innerHTML = `<option value="">-- Apply to whole invoice --</option>`;
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("discountEditId");
    sessionStorage.removeItem("discountEditPayload");
    window.location.href = "/discounts-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("discountEditId");
    sessionStorage.removeItem("discountEditPayload");
    form.reset();
    invoiceHidden.value = "";
    invoiceItemSelect.innerHTML = `<option value="">-- Apply to whole invoice --</option>`;
    titleEl && (titleEl.textContent = "Add Discount");
  });
}
