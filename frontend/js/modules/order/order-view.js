// ============================================================
// 📦 Order – View Page (Read-Only, Professional)
// 🔹 Lab Request → Order Adaptation (MASTER PARITY)
// Shows:
//  - Order details
//  - Ordered items
// ============================================================

import { authFetch } from "../../authSession.js";
import { showToast, showLoading, hideLoading } from "../../utils/index.js";

/* ============================================================
   🔎 Read ID
============================================================ */
const params = new URLSearchParams(window.location.search);
const orderId = params.get("id");

if (!orderId) {
  showToast("❌ Missing order ID");
  throw new Error("Missing order ID in URL");
}

/* ============================================================
   📎 DOM
============================================================ */
const backBtnEl = document.getElementById("backBtn");
const statusBadgeEl = document.getElementById("orderStatus");
const orderInfoEl = document.getElementById("orderInfo");
const itemsListEl = document.getElementById("itemsList");

/* ============================================================
   🔙 Back
============================================================ */
function handleBackNavigation() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "/orders-list.html";
  }
}

backBtnEl?.addEventListener("click", handleBackNavigation);

/* ============================================================
   🎨 Helpers
============================================================ */
function renderStatusBadge(status) {
  const map = {
    draft: "secondary",
    pending: "info",
    in_progress: "warning",
    completed: "primary",
    verified: "success",
    cancelled: "danger",
    voided: "dark",
  };
  return `<span class="badge bg-${map[status] || "secondary"}">${status}</span>`;
}

const safe = (v) => v ?? "—";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

/* ============================================================
   📦 LOAD ORDER
============================================================ */
async function loadOrderView() {
  try {
    showLoading();

    const res = await authFetch(`/api/orders/${orderId}`);
    const json = await res.json();
    const order = json?.data;

    if (!order) {
      showToast("❌ Order not found");
      return;
    }

    statusBadgeEl.innerHTML = renderStatusBadge(order.status);

    orderInfoEl.innerHTML = `
      <div><strong>Patient:</strong> ${safe(order.patient_label)}</div>
      <div><strong>Provider:</strong> ${safe(order.provider_label)}</div>
      <div><strong>Department:</strong> ${safe(order.department?.name)}</div>
      <div><strong>Order Date:</strong> ${formatDate(order.order_date)}</div>
      <div><strong>Status:</strong> ${safe(order.status)}</div>
    `;

    const items = Array.isArray(order.items) ? order.items : [];

    itemsListEl.innerHTML = items.length
      ? items
          .map(
            (i) =>
              `<li>${safe(i.billableItem?.name || "Order Item")}</li>`
          )
          .join("")
      : `<li class="text-muted">No items</li>`;

  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load order");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🚀 INIT
============================================================ */
loadOrderView();