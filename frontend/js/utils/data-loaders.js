// -----------------------------------------------------------------------------
// 🌟 UNIVERSAL DATA LOADER UTILITIES — fresh on reload, cached during nav
// -----------------------------------------------------------------------------

import { showToast } from "./toast-utils.js";
import { authFetch } from "../authSession.js";

// -----------------------------------------------------------------------------
// 🔄 Reload detection & one-time cache sweep
// -----------------------------------------------------------------------------
function isHardReload() {
  try {
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    if (nav && nav.type) return nav.type === "reload";
    if (performance.navigation && typeof performance.navigation.type === "number") {
      return performance.navigation.type === 1; // TYPE_RELOAD
    }
  } catch (_) {}
  return false;
}

function clearDataLoaderCachesOnce() {
  try {
    const FLAG = "dataLoader__clearedThisLoad";

    // Prevent double-clearing on same page load
    if (sessionStorage.getItem(FLAG)) return;

    // 🔥 ALWAYS clear payment caches on every load — refund balance must be realtime
    const PAYMENT_PREFIX = "genericList_/api/lite/payments";

    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);

      // Clear ALL general list caches on hard reload
      if (isHardReload() && key.startsWith("genericList_")) {
        sessionStorage.removeItem(key);
        continue;
      }

      // 🔥 NEW: Always clear payment-related caches (fixes stale refund amounts)
      if (key.startsWith(PAYMENT_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    }

    sessionStorage.setItem(FLAG, "1");
  } catch (_) {
    // non-fatal
  }
}

clearDataLoaderCachesOnce();

// -----------------------------------------------------------------------------
// 🧩 Convenience wrappers (use these in modules)
// -----------------------------------------------------------------------------

// Organizations lite
export const loadOrganizationsLite = (force = false) =>
  fetchGenericList("/api/lite/organizations", "data", 15, force);

// Facilities lite (with optional params: { organization_id, force })
export const loadFacilitiesLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/facilities${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Departments lite (with optional filters: { facility_id, organization_id, status })
export const loadDepartmentsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/departments${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Employees lite (with optional filters: { department_id, facility_id, organization_id, status, position, q })
export const loadEmployeesLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/employees${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};


// Employees lite with email (autocomplete)
export const loadEmployeesLiteWithEmail = (q = "", force = false) => {
  const endpoint = `/api/lite/employees/email${q ? "?q=" + encodeURIComponent(q) : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};
// -----------------------------------------------------------------------------
// 🧑‍⚕️ Clinical Employee Shortcuts
// These wrap loadEmployeesLite with a fixed `position` filter for convenience
// Commonly used for appointment scheduling, clinical assignments, etc.
// -----------------------------------------------------------------------------
export const loadDoctorsLite = (params = {}, force = false) => {
  return loadEmployeesLite({ ...params, position: "Doctor" }, force);
};

export const loadMidwivesLite = (params = {}, force = false) => {
  return loadEmployeesLite({ ...params, position: "Midwife" }, force);
};
export const loadNursesLite = (params = {}, force = false) => {
  return loadEmployeesLite({ ...params, position: "Nurse" }, force);
};
// Patients lite (with optional filters: { organization_id, facility_id, q })
export const loadPatientsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/patients${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Patients lite with contact (autocomplete with phone/email)
export const loadPatientsLiteWithContact = (q = "", force = false) => {
  const endpoint = `/api/lite/patients/contact${q ? "?q=" + encodeURIComponent(q) : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Roles lite (with optional filters: { status, q })
export const loadRolesLite = (params = {}, force = false) => {
  const q = new URLSearchParams({
    organization_id: params.organization_id || "",
    facility_id: params.facility_id || "",
    q: params.q || "",
    limit: 200,
  });

  const endpoint = `/api/lite/roles?${q.toString()}`;
  return fetchGenericList(endpoint, "data.records", 15, force);
};

// Permissions lite (with optional filters: { module, category, q })
export const loadPermissionsLite = (params = {}, force = false) => {
  const q = new URLSearchParams({ ...params, limit: 500 });
  const endpoint = `/api/lite/permissions${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data.records", 15, force);
};


// Role-Permissions lite (with optional filters: { role_id, organization_id, facility_id, q })
export const loadRolePermissionsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/role-permissions${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};



// Master Item Categories lite (with optional filters: { organization_id, facility_id, status, q })
export const loadMasterItemCategoriesLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/master-item-categories${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Master Items lite (with optional filters: { organization_id, facility_id, category_id, department_id, status, q })
export const loadMasterItemsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/master-items${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Feature Modules lite
export const loadFeatureModulesLite = (force = false) =>
  fetchGenericList("/api/lite/feature-modules", "data", 15, force);

// Users lite
export const loadUsersLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/users${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// User-Facilities lite
export const loadUserFacilitiesLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/user-facilities${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Suppliers lite (with optional filters OR direct <select> element)
export const loadSuppliersLite = async (params = {}, force = false) => {
  // If params is actually a DOM element, handle select-population mode
  if (params instanceof HTMLElement && params.tagName === "SELECT") {
    const selectEl = params;
    const records = await fetchGenericList("/api/lite/suppliers", "data", 15, force);
    setupSelectOptions(selectEl, records, "id", "name", "-- Select Supplier --");
    return records;
  }

  // Otherwise assume params is a filter object
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/suppliers${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};
// Registration Logs lite (with optional filters: { organization_id, facility_id, q })
export const loadRegistrationLogsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/registration-logs${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};
// Appointments lite (with optional filters: { patient_id, facility_id, q })
export const loadAppointmentsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/appointments${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Recommendations lite (with optional filters: { patient_id, consultation_id, organization_id, facility_id, q })
export const loadRecommendationsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/recommendations${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};
// Triage Records lite (with optional filters: { patient_id, doctor_id, facility_id, organization_id, q })
export const loadTriageRecordsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/triage-records${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};
// Vitals lite (with optional filters: { patient_id, nurse_id, organization_id, facility_id, q })
export const loadVitalsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/vitals${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};
// Lab Requests lite (with optional filters: { patient_id, facility_id, organization_id, q })
export const loadLabRequestsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/lab-requests${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};
// 📌 Lab Request Items lite (tests inside a lab request)
export async function loadLabRequestItemsLite(lab_request_id) {
  if (!lab_request_id) return [];
  try {
    const res = await authFetch(`/api/lite/lab-request-items?lab_request_id=${lab_request_id}`);
    const result = await res.json().catch(() => ({}));
    return result?.data?.records || [];
  } catch (err) {
    console.error("❌ Failed to load lab request items:", err);
    return [];
  }
}
// Maternity Visits lite (with optional filters: { patient_id, facility_id, organization_id, q })
export const loadMaternityVisitsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/maternity-visits${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Delivery Records lite (with optional filters: { patient_id, facility_id, organization_id, q })
export const loadDeliveryRecordsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/delivery-records${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Newborn Records lite (with optional filters: { patient_id, delivery_record_id, facility_id, organization_id, q })
export const loadNewbornRecordsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/newborn-records${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Medical Records lite (with optional filters: { patient_id, consultation_id, facility_id, organization_id, q })
export const loadMedicalRecordsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/medical-records${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};


// Lab Results lite (with optional filters: { patient_id, facility_id, organization_id, q })
export const loadLabResultsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/lab-results${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};
// 📌 Consultations lite (with optional filters: { patient_id, doctor_id, facility_id, organization_id, q, status })
export const loadConsultationsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/consultations${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data.records", 15, force);  // ✅ unwraps records
};


// Prescriptions lite (with optional filters: { patient_id, doctor_id, facility_id, organization_id, q, status })
export const loadPrescriptionsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/prescriptions${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// 📌 Prescription Items lite (inside a prescription)
export async function loadPrescriptionItemsLite(prescription_id) {
  if (!prescription_id) return [];
  try {
    const res = await authFetch(`/api/lite/prescription-items?prescription_id=${prescription_id}`);
    const result = await res.json().catch(() => ({}));
    return result?.data?.records || [];
  } catch (err) {
    console.error("❌ Failed to load prescription items:", err);
    return [];
  }
}
// -----------------------------------------------------------------------------
// 💊 Pharmacy Transactions lite
// -----------------------------------------------------------------------------

// Pharmacy Transactions lite (with optional filters: { patient_id, prescription_id, facility_id, organization_id, q, status })
export const loadPharmacyTransactionsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/pharmacy-transactions${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// 📌 Pharmacy Transaction Items lite (items inside a pharmacy transaction)
export async function loadPharmacyTransactionItemsLite(transaction_id) {
  if (!transaction_id) return [];
  try {
    const res = await authFetch(`/api/lite/pharmacy-transaction-items?transaction_id=${transaction_id}`);
    const result = await res.json().catch(() => ({}));
    return result?.data?.records || [];
  } catch (err) {
    console.error("❌ Failed to load pharmacy transaction items:", err);
    return [];
  }
}
// EKG Records lite (with optional filters: { patient_id, consultation_id, registration_log_id, facility_id, organization_id, q })
export const loadEKGRecordsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/ekg-records${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Ultrasound Records lite (with optional filters: { patient_id, consultation_id, maternity_visit_id, facility_id, organization_id, q })
export const loadUltrasoundRecordsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/ultrasound-records${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Department Stocks lite (with optional filters: { department_id, facility_id, organization_id, status, q })
export const loadDepartmentStocksLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/department-stocks${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};
// Stock Requests lite (with optional filters: { department_id, facility_id, organization_id, q })
export const loadStockRequestsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/stock-requests${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};
// -----------------------------------------------------------------------------
// 📦 Item Availability lite (with optional filters: { master_item_id, facility_id })
// -----------------------------------------------------------------------------
export const loadItemAvailabilityLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/item-availability${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 5, force);
};
// Surgeries lite (with optional filters: { patient_id, surgeon_id, consultation_id, facility_id, organization_id, q })
export const loadSurgeriesLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/surgeries${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Billable Items lite (MASTER — optimized for autocomplete & billing)
export const loadBillableItemsLite = async (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/billable-items${q.toString() ? "?" + q.toString() : ""}`;

  const records = await fetchGenericList(endpoint, "data", 10, force);

  // 🔥 Normalize for ALL UI usage (dropdown + suggestion + billing)
  return records.map((item) => ({
    ...item,

    // ✅ universal select support
    value: item.id,

    // ✅ always safe label
    label:
      item.label ||
      `${item.name || ""}${item.code ? ` (${item.code})` : ""}`,

    // 🔥 OPTIONAL (uncomment if you want price shown in dropdown)
    // label:
    //   item.label ||
    //   `${item.name || ""}${item.code ? ` (${item.code})` : ""}${
    //     item.price ? ` - ${item.price} ${item.currency || ""}` : ""
    //   }`,
  }));
};
// 📦 Refund Deposits lite loader
// Supports optional filters: { patient_id, deposit_id, facility_id, organization_id, status, q }
export const loadRefundDepositsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/refund-deposits${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data.records", 15, force);
};

// -----------------------------------------------------------------------------
// 💳 Invoices lite (with optional filters: { patient_id, facility_id, organization_id, q })
// -----------------------------------------------------------------------------
export const loadInvoicesLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/invoices${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data.records", 15, force);
};

// 📌 Invoice Items lite (inside a specific invoice)
export async function loadInvoiceItemsLite(invoiceId, params = {}, force = true) {
  if (!invoiceId) return [];
  try {
    const q = new URLSearchParams(params).toString();
    const res = await authFetch(`/api/lite/invoices/${invoiceId}/items${q ? "?" + q : ""}`);
    const r = await res.json().catch(() => ({}));
    return r?.data?.records || [];
  } catch (e) {
    console.error("❌ loadInvoiceItemsLite:", e);
    return [];
  }
}

// 📦 Accounts lite loader
export const loadAccountsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/accounts${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data.records", 15, force);
};

// 📦 Currency Rates lite loader
export const loadCurrencyRatesLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/currency-rates${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data.records", 15, force);
};


// 📦 Expenses lite loader
export const loadExpensesLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/expenses${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data.records", 15, force);
};
// 📦 Payments lite loader
// Supports optional filters: 
// { patient_id, invoice_id, facility_id, organization_id, status, is_deposit, q }
export const loadPaymentsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/payments${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data.records", 20, force);
};


// 📦 Deposits lite loader
// Supports optional filters: { patient_id, invoice_id, facility_id, organization_id, status, q }
export const loadDepositsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/deposits${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data.records", 20, force);
};
// 📦 Discount Policies lite (with optional filters: { organization_id, facility_id, q })
export const loadDiscountPoliciesLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/discount-policies${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data.records", 20, force); // 🔧 set to 20 for consistency
};

// 📦 Discount Waivers lite (with optional filters: { organization_id, facility_id, q })
export const loadDiscountWaiversLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/discount-waivers${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data.records", 20, force); // 🔧 20 for consistency
};

// Employee Positions lite (for dropdowns)
export const loadEmployeePositionsLite = (force = false) =>
  fetchGenericList("/api/lite/employee-positions", "data", 15, force);


// -----------------------------------------------------------------------------
// 🟢 Universal generic loader with sessionStorage caching
// -----------------------------------------------------------------------------
export async function fetchGenericList(endpoint, key = "data", cacheMinutes = 15, forceRefresh = false) {
  const bypass = forceRefresh || isHardReload();
  const cacheKey = `genericList_${endpoint}`;

  if (!bypass) {
    const cachedRaw = sessionStorage.getItem(cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (cached.expires > Date.now() && Array.isArray(cached.records)) {
          return cached.records;
        }
      } catch (err) {
        console.warn("⚠️ Invalid cache:", err);
      }
    }
  }

  try {
    const res = await authFetch(endpointWithBust(endpoint), { cache: "no-store" });
    if (!res.ok) {
      const txt = await safeText(res);
      console.warn(`⚠️ Fetch failed ${res.status}:`, txt);
      showToast?.(`Failed to load data (${res.status}).`);
      return [];
    }

    const result = await res.json();
    const records = extractArrayRecords(result, key);

if (records.length > 0) {
  sessionStorage.setItem(
    cacheKey,
    JSON.stringify({
      records,
      expires: Date.now() + cacheMinutes * 60 * 1000,
    })
  );
}

    return records;
  } catch (err) {
    console.error("❌ fetchGenericList error:", err);
    showToast?.("Network error. Please try again.");
    return [];
  }
}
// Auto Billing Rules lite (with optional filters: { organization_id, facility_id, q })
export const loadAutoBillingRulesLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/auto-billing-rules${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// Billing Triggers lite
export const loadBillingTriggersLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/billing-triggers${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data", 15, force);
};

// -----------------------------------------------------------------------------
// 💳 Billable Items (category & ID helpers)
// -----------------------------------------------------------------------------
export async function fetchBillableItemsByCategory(category, limit = 100) {
  const url = `/api/billable-items?category=${encodeURIComponent(category)}&active=true&limit=${limit}`;
  const cacheKey = `billableItems_${category}`;
  const autoCache = !isHardReload();

  if (autoCache) {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (_) {}
    }
  }

  try {
    const res = await authFetch(endpointWithBust(url), { cache: "no-store" });
    if (!res.ok) {
      const txt = await safeText(res);
      console.warn(`⚠️ Billable items fetch failed ${res.status}:`, txt);
      return [];
    }
    const result = await res.json();
    const items = extractArrayRecords(result, "data");
    sessionStorage.setItem(cacheKey, JSON.stringify(items));
    return items;
  } catch (err) {
    console.error("❌ Failed to fetch billable items:", err);
    return [];
  }
}

export const loadInsuranceProvidersLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/insurance-providers${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data.records", 15, force);
};

export const loadInsuranceClaimsLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/insurance-claims${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data.records", 15, force);
};

export const loadPatientInsurancesLite = (params = {}, force = false) => {
  const q = new URLSearchParams(params);
  const endpoint = `/api/lite/patient-insurances${q.toString() ? "?" + q.toString() : ""}`;
  return fetchGenericList(endpoint, "data.records", 15, force);
};
export async function fetchBillableItemById(id) {
  try {
    const res = await authFetch(endpointWithBust(`/api/billable-items/${id}`), { cache: "no-store" });
    if (!res.ok) {
      console.warn(`⚠️ No BillableItem found for ID ${id} (${res.status})`);
      return null;
    }
    const result = await res.json();
    return result?.data ?? result ?? null;
  } catch (err) {
    console.error("❌ Failed to fetch BillableItem by ID:", err);
    return null;
  }
}

export async function fetchBillableItemByMasterId(masterItemId) {
  try {
    const res = await authFetch(endpointWithBust(`/api/billable-items/by-master/${masterItemId}`), { cache: "no-store" });
    if (!res.ok) {
      console.warn(`⚠️ No BillableItem found for MasterItem ${masterItemId} (${res.status})`);
      return null;
    }
    const result = await res.json();
    return result?.data ?? result ?? null;
  } catch (err) {
    console.error("❌ Failed to fetch BillableItem by MasterItem:", err);
    return null;
  }
}

// -----------------------------------------------------------------------------
// 🧠 Suggestion Inputs (static & dynamic)
// -----------------------------------------------------------------------------
export function setupSuggestionInput(inputEl, suggestionEl, list, onSelect, labelField = "name") {
  inputEl.addEventListener("input", () => {
    const query = inputEl.value.trim().toLowerCase();
    const matches = list.filter((item) =>
      String(item[labelField] ?? "").toLowerCase().includes(query)
    );

    suggestionEl.innerHTML = matches
      .map((item) => {
        const label = item[labelField] ?? "";
        return `<div class="suggestion-item" data-id="${item.id}" data-label="${label}">${label}</div>`;
      })
      .join("");

    suggestionEl.style.display = matches.length ? "block" : "none";

    suggestionEl.querySelectorAll(".suggestion-item").forEach((itemEl) => {
      itemEl.onclick = () => {
        const id = itemEl.dataset.id;
        const label = itemEl.dataset.label;
        inputEl.value = label;
        suggestionEl.innerHTML = "";
        suggestionEl.style.display = "none";

        const selectedItem = list.find((p) => String(p.id) === String(id));
        onSelect?.(selectedItem);
      };
    });
  });
}

export function setupSuggestionInputDynamic(
  inputEl,
  suggestionEl,
  apiUrl,
  onSelect,
  labelField = "name",
  options = {}
) {
  let timeout;
  let suggestions = [];
  let highlightedIndex = -1;
  const minChars = options.minChars ?? 2;

  if (options.prefill?.label) {
    inputEl.value = options.prefill.label;
  }

  inputEl.addEventListener("input", () => {
    clearTimeout(timeout);
    const query = inputEl.value?.trim() || "";
    highlightedIndex = -1;

    if (document.activeElement !== inputEl || query.length < minChars) {
      suggestionEl.innerHTML = "";
      suggestionEl.style.display = "none";
      return;
    }

    suggestionEl.innerHTML = `<div class="suggestion-loading">Loading...</div>`;
    suggestionEl.style.display = "block";

    timeout = setTimeout(async () => {

      // 🔥 NEW: merge extra params (dynamic-safe)
      const extraParams =
        typeof options.extraParams === "function"
          ? options.extraParams()
          : options.extraParams || {};

      const url = withQuery(apiUrl, { 
        search: query,   // 🔥 FIX: use "search" instead of "q"
        ...extraParams
      });


      try {
        const res = await authFetch(endpointWithBust(url), { cache: "no-store" });
        const result = await res.json();
        if (!res.ok) throw new Error(`Fetch error ${res.status}`);

        suggestions = Array.isArray(result?.data?.records)
          ? result.data.records
          : Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.records)
          ? result.records
          : Array.isArray(result)
          ? result
          : [];

        suggestionEl.innerHTML = `
          <ul class="suggestions-list">
            ${suggestions
              .map((item, idx) => {
                const label = item[labelField] ?? "";
                return `<li class="suggestion-item" data-id="${item.id}" data-label="${label}" data-index="${idx}">${label}</li>`;
              })
              .join("")}
          </ul>
        `;
        suggestionEl.style.display = suggestions.length ? "block" : "none";

        suggestionEl.querySelectorAll(".suggestion-item").forEach((itemEl) => {
          itemEl.onclick = (e) => {
            e.stopPropagation();
            selectSuggestion(+itemEl.dataset.index);
          };
        });
      } catch (err) {
        console.error("❌ Suggestion load failed:", err);
        suggestionEl.innerHTML = "";
        suggestionEl.style.display = "none";
      }
    }, 300);
  });


  inputEl.addEventListener("keydown", (e) => {
    const items = suggestionEl.querySelectorAll(".suggestion-item");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightedIndex = (highlightedIndex + 1) % items.length;
      updateHighlight(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
      updateHighlight(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        selectSuggestion(highlightedIndex);
      }
    } else if (e.key === "Escape") {
      suggestionEl.innerHTML = "";
      suggestionEl.style.display = "none";
    }
  });

  document.addEventListener("click", (e) => {
    setTimeout(() => {
      if (
        inputEl &&
        suggestionEl &&
        !inputEl.contains(e.target) &&
        !suggestionEl.contains(e.target)
      ) {
        suggestionEl.innerHTML = "";
        suggestionEl.style.display = "none";
      }
    }, 150);
  });

  function selectSuggestion(index) {
    const item = suggestions[index];
    if (!item) return;
    const label = item[labelField] ?? "";
    inputEl.value = label;
    suggestionEl.innerHTML = "";
    suggestionEl.style.display = "none";
    onSelect?.(item);
  }

  function updateHighlight(items) {
    items.forEach((item) => item.classList.remove("highlight"));
    const active = items[highlightedIndex];
    if (active) active.classList.add("highlight");
  }
}

// -----------------------------------------------------------------------------
// 🏷️ Populate a <select> with options from a list
// -----------------------------------------------------------------------------
export function setupSelectOptions(
  selectEl,
  list,
  valueField = "id",
  labelField = "name",
  placeholder = "-- Select --"
) {
  selectEl.innerHTML =
    `<option value="">${placeholder}</option>` +
    list
      .map((item) => {
        const attrs = [];
        if (item.code) attrs.push(`data-code="${item.code}"`);
        if (item.description) attrs.push(`data-description="${item.description}"`);
        return `<option value="${item[valueField]}" ${attrs.join(" ")}>${item[labelField] ?? ""}</option>`;
      })
      .join("");
}


// -----------------------------------------------------------------------------
// 🔧 Helpers
// -----------------------------------------------------------------------------
function extractArrayRecords(result, primaryKey = "data") {
  let records = [];

  if (Array.isArray(result?.[primaryKey])) {
    records = result[primaryKey];
  } else if (Array.isArray(result?.[primaryKey]?.records)) {
    records = result[primaryKey].records;
  } else if (Array.isArray(result?.records)) {
    records = result.records;
  } else if (Array.isArray(result?.data)) {
    records = result.data;
  } else if (Array.isArray(result?.data?.records)) {
    records = result.data.records;
  }

  if (!Array.isArray(records)) {
    console.warn("⚠️ No valid records array found in response.", result);
    records = [];
  }
  return records;
}

function endpointWithBust(url) {
  if (!isHardReload()) return url;
  return withQuery(url, { _ts: Date.now() });
}

function withQuery(url, params) {
  const u = new URL(url, window.location.origin);
  Object.entries(params || {}).forEach(([k, v]) => {
    u.searchParams.set(k, v);
  });
  return u.pathname + (u.search ? u.search : "");
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
