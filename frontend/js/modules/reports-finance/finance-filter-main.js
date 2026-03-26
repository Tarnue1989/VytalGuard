// 📦 finance-filter-main.js – FINAL PRO (Enterprise synced)
// ============================================================
// 🔹 Fully synced with advanced finance report (discounts, waivers)
// 🔹 Safe API handling + UX improvements
// 🔹 Supports future analytics (daily, charts, etc.)
// ============================================================

import {
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";

import {
  renderFinanceSummary,
  renderServiceTable,
  renderPaymentsTable,
  renderDepositSummary,
} from "./finance-render.js";

/* ============================================================
   🔐 Auth + Session
============================================================ */
initPageGuard(autoPagePermissionKey(["reports:view"]));
initLogoutWatcher();

/* ============================================================
   🚀 Init
============================================================ */
export async function initFinanceReportModule() {
  const applyBtn = document.getElementById("financeApplyBtn");

  applyBtn?.addEventListener("click", loadReports);

  await loadReports();
}

/* ============================================================
   📊 Load Reports (FULL SYNC)
============================================================ */
async function loadReports() {
  const applyBtn = document.getElementById("financeApplyBtn");

  try {
    showLoading();
    applyBtn?.setAttribute("disabled", true);

    const params = new URLSearchParams();
    const input = document.getElementById("financeDateRange");

    /* ========================================================
       📅 DATE RANGE (ISO SAFE)
    ======================================================== */
    let from, to;

    if (input && $(input).data("daterangepicker")) {
      const picker = $(input).data("daterangepicker");

      from = picker.startDate.format("YYYY-MM-DD");
      to   = picker.endDate.format("YYYY-MM-DD");
    } else {
      const today = new Date().toISOString().slice(0, 10);
      from = today;
      to = today;
    }

    params.set("from", from);
    params.set("to", to);

    const query = params.toString();

    /* ========================================================
       🚀 PARALLEL API CALLS
    ======================================================== */
    const [
      summaryRes,
      servicesRes,
      paymentsRes,
      depositsRes,
    ] = await Promise.all([
      authFetch(`/api/reports/finance/summary?${query}`),
      authFetch(`/api/reports/finance/services?${query}`),
      authFetch(`/api/reports/finance/payments?${query}`),
      authFetch(`/api/reports/finance/deposits?${query}`),
    ]);

    /* ========================================================
       🛡 SAFE RESPONSE HANDLING
    ======================================================== */
    const summaryJson  = summaryRes.ok  ? await summaryRes.json()  : {};
    const servicesJson = servicesRes.ok ? await servicesRes.json() : {};
    const paymentsJson = paymentsRes.ok ? await paymentsRes.json() : {};
    const depositsJson = depositsRes.ok ? await depositsRes.json() : {};

    /* ========================================================
       🔍 DEBUG (DEV ONLY)
    ======================================================== */
    console.log("Finance Summary:", summaryJson);
    console.log("Services:", servicesJson);
    console.log("Payments:", paymentsJson);
    console.log("Deposits:", depositsJson);

    /* ========================================================
       🎨 RENDER ALL SECTIONS
    ======================================================== */
    renderFinanceSummary(summaryJson?.data || {});
    renderServiceTable(servicesJson?.data || []);
    renderPaymentsTable(paymentsJson?.data || []);
    renderDepositSummary(depositsJson?.data || {});

  } catch (err) {
    console.error("❌ Finance report load failed", err);
  } finally {
    hideLoading();
    applyBtn?.removeAttribute("disabled");
  }
}