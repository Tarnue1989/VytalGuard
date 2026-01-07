import { showToast } from './toast-utils.js';
import { getStoredItem } from './api-utils.js';

/**
 * 📥 Load full list of patients and pass to callback
 */
export async function loadPatientsGlobal(callback) {
  try {
    const token = getStoredItem("accessToken");
    const res = await fetch("/api/patients", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await res.json();
    const patients = Array.isArray(result) ? result : result.data || [];
    console.log("✅ Global patient list loaded:", patients);
    if (typeof callback === "function") callback(patients);
  } catch (err) {
    console.error("❌ Global patient load failed:", err);
  }
}

/**
 * 📥 Load all employees into a <select> dropdown
 */
export async function loadEmployeesGlobal(selectElement, token) {
  try {
    const res = await fetch("/api/employees", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await res.json();
    const doctors = result.records || [];

    selectElement.innerHTML = `<option value="">Select Doctor</option>` +
      doctors.map(doc => `<option value="${doc.id}">${doc.first_name} ${doc.last_name}</option>`).join('');
  } catch (err) {
    console.error("❌ Error loading doctors:", err);
    showToast("❌ Failed to load doctors.");
  }
}

/**
 * 🏥 Load all departments into a <select> dropdown
 */
export async function loadDepartmentsGlobal(selectElement) {
  try {
    const token = getStoredItem("accessToken");
    const res = await fetch("/api/departments", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const result = await res.json();
    const departments = result.records || result.data || [];

    selectElement.innerHTML = `<option value="">Select Department</option>`;
    departments.forEach(dep => {
      const option = document.createElement("option");
      option.value = dep.id;
      option.textContent = dep.department_name;
      selectElement.appendChild(option);
    });

    console.log("✅ Loaded departments:", departments);
  } catch (err) {
    console.error("❌ Failed to load departments:", err);
    showToast("❌ Could not load departments");
  }
}

/**
 * 📦 Load all suppliers into a <select> dropdown
 */
export async function loadSuppliersGlobal(selectElement, token) {
  try {
    token = token || getStoredItem("accessToken");
    const res = await fetch("/api/suppliers", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const result = await res.json();
    const suppliers = result.data || result || [];

    if (!Array.isArray(suppliers)) {
      console.error("❌ Invalid suppliers data:", suppliers);
      showToast("❌ Failed to load suppliers", "error");
      return;
    }

    selectElement.innerHTML = `<option value="">-- Select Supplier --</option>`;
    suppliers.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      selectElement.appendChild(opt);
    });
  } catch (err) {
    console.error("❌ Error loading suppliers:", err);
    showToast("❌ Could not load suppliers", "error");
  }
}

/**
 * 🧪 Load all master items into a <select> dropdown
 */
export async function loadMasterItemsGlobal(selectElement) {
  try {
    const token = getStoredItem("accessToken");
    const res = await fetch("/api/masteritems", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const result = await res.json();
    const items = result.items || [];

    selectElement.innerHTML = `<option value="">-- Select Item --</option>`;
    items.forEach(item => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.name} ${item.code ? `(${item.code})` : ""}`;
      selectElement.appendChild(option);
    });

    console.log("✅ Master items loaded:", items);
  } catch (err) {
    console.error("❌ Failed to load master items:", err);
    showToast("❌ Could not load master items.");
  }
}

/**
 * 💊 Load available stock for a medication in a department
 */
export async function loadAvailableStock(medicationId, departmentId, displayElement) {
  if (!medicationId || !departmentId || !displayElement) return;

  try {
    const token = getStoredItem("accessToken");
    const res = await fetch(`/api/inventory-stocks/available?medication_id=${medicationId}&department_id=${departmentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const stock = await res.json();
    const qty = stock?.quantity || 0;
    displayElement.textContent = `Available Stock: ${qty}`;

    if (qty <= 0) {
      displayElement.style.color = '#dc2626'; // Red
    } else if (qty <= 5) {
      displayElement.style.color = '#f59e0b'; // Orange
    } else {
      displayElement.style.color = '#1e3a8a'; // Blue
    }

    return qty;
  } catch (err) {
    console.error("❌ loadAvailableStock failed:", err);
    displayElement.textContent = `Available Stock: 0`;
    displayElement.style.color = '#dc2626';
    return 0;
  }
}

/**
 * 🧾 Fetch all invoices (used in registrationLogs)
 */
export async function fetchAllInvoices() {
  const token = getStoredItem("accessToken");
  const res = await fetch("/api/invoices", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const result = await res.json();
  return result.data?.records || result.records || [];
}

/**
 * 🗂 Fetch all master item categories (for dropdown filters)
 */
export async function fetchAllMasterItemCategories() {
  const token = getStoredItem("accessToken");
  const res = await fetch("/api/master-item-categories/list", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const result = await res.json();
  return Array.isArray(result.data) ? result.data : [];
}

/**
 * 📊 Fetch all master items (with category/department info)
 */
export async function fetchAllMasterItems() {
  const token = getStoredItem("accessToken");
  const res = await fetch("/api/masteritems?page=1&limit=500", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const result = await res.json();
  return result.data?.records || [];
}

/**
 * 💵 Fetch billable items by category (consultation, lab, etc.)
 */
export async function fetchBillableItemsByCategory(category, limit = 100) {
  const token = getStoredItem("accessToken");
  const url = `/api/billable-items?category=${encodeURIComponent(category)}&active=true&source=service&limit=${limit}`;

  const cachedKey = `billableItems_${category}`;
  const cached = sessionStorage.getItem(cachedKey);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const result = await res.json();
  const items = result.data || result.records || [];

  sessionStorage.setItem(cachedKey, JSON.stringify(items));
  return items;
}

/**
 * 🧪 Fetch pending lab requests for results module
 */
export async function fetchPendingLabRequests() {
  const token = getStoredItem("accessToken");
  const res = await fetch("/api/lab-results/pending-lab-requests", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const result = await res.json();
  return Array.isArray(result) ? result : result.data || [];
}
