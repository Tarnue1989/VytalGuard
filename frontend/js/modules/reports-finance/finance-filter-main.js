// 📦 finance-filter-main.js – FINAL (ISO date safe, fully wired)
// ============================================================
// 🔹 Loads all finance report sections
// 🔹 Uses daterangepicker ISO output only
// 🔹 Safe against empty / partial responses
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
   📊 Load Reports
============================================================ */
async function loadReports() {
  try {
    showLoading();

    const params = new URLSearchParams();
    const input = document.getElementById("financeDateRange");

    // ✅ Always use daterangepicker values (ISO safe)
    if (input && $(input).data("daterangepicker")) {
      const picker = $(input).data("daterangepicker");

      const from = picker.startDate.format("YYYY-MM-DD");
      const to   = picker.endDate.format("YYYY-MM-DD");

      params.set("from", from);
      params.set("to", to);
    }

    const [
      summaryRes,
      servicesRes,
      paymentsRes,
      depositsRes,
    ] = await Promise.all([
      authFetch(`/api/reports/finance/summary?${params.toString()}`),
      authFetch(`/api/reports/finance/services?${params.toString()}`),
      authFetch(`/api/reports/finance/payments?${params.toString()}`),
      authFetch(`/api/reports/finance/deposits?${params.toString()}`),
    ]);

    const summaryJson  = await summaryRes.json();
    const servicesJson = await servicesRes.json();
    const paymentsJson = await paymentsRes.json();
    const depositsJson = await depositsRes.json();

    // 🔹 Render sections (safe defaults)
    renderFinanceSummary(summaryJson?.data || {});
    renderServiceTable(servicesJson?.data || []);
    renderPaymentsTable(paymentsJson?.data || []);
    renderDepositSummary(depositsJson?.data || {});

  } catch (err) {
    console.error("❌ Finance report load failed", err);
  } finally {
    hideLoading();
  }
}
