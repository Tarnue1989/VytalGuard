// 📦 finance-filter-main.js – FINAL (TRUE MULTI-CURRENCY)
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
  renderFinanceInsights 
} from "./finance-render.js";

/* ============================================================ */
initPageGuard(autoPagePermissionKey(["reports:view"]));
initLogoutWatcher();

/* ============================================================ */
export async function initFinanceReportModule() {
  const applyBtn = document.getElementById("financeApplyBtn");

  applyBtn?.addEventListener("click", loadReports);

  await loadReports();
}

/* ============================================================ */
async function loadReports() {
  const applyBtn = document.getElementById("financeApplyBtn");

  try {
    showLoading();
    applyBtn?.setAttribute("disabled", true);

    const params = new URLSearchParams();
    const input = document.getElementById("financeDateRange");

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

    /* ======================================================== */
    const [
      summaryRes,
      servicesRes,
      paymentsRes,
      depositsRes,
      expensesRes,
      insuranceRes,
    ] = await Promise.all([
      authFetch(`/api/reports/finance/summary?${query}`),
      authFetch(`/api/reports/finance/services?${query}`),
      authFetch(`/api/reports/finance/payments?${query}`),
      authFetch(`/api/reports/finance/deposits?${query}`),
      authFetch(`/api/reports/finance/expenses?${query}`),
      authFetch(`/api/reports/finance/insurance?${query}`),
    ]);

    /* ======================================================== */
    // 🔥 SAFE JSON PARSE (prevents undefined crashes)
    const summaryJson   = summaryRes?.ok   ? await summaryRes.json()   : { data: [] };
    const servicesJson  = servicesRes?.ok  ? await servicesRes.json()  : { data: [] };
    const paymentsJson  = paymentsRes?.ok  ? await paymentsRes.json()  : { data: [] };
    const depositsJson  = depositsRes?.ok  ? await depositsRes.json()  : { data: {} };
    const expensesJson  = expensesRes?.ok  ? await expensesRes.json()  : { data: [] };
    const insuranceJson = insuranceRes?.ok ? await insuranceRes.json() : { data: [] };

    /* ======================================================== */
    /* 🔥 RAW DATA — NO FLATTENING (CRITICAL) */
    const mergedSummary = {
      summary: summaryJson.data || [],
      deposits: depositsJson.data || {},
      expenses: expensesJson.data || [],
      insurance: insuranceJson.data || [],
    };

    /* ======================================================== */
    renderFinanceSummary(mergedSummary);
    renderFinanceInsights(mergedSummary);
    renderServiceTable(servicesJson.data || []);
    renderPaymentsTable(paymentsJson.data || []);
    renderDepositSummary();

    /* ======================================================== */
    window.financeSummaryData  = mergedSummary;
    window.financeServicesData = servicesJson.data || [];
    window.financePaymentsData = paymentsJson.data || [];

  } catch (err) {
    console.error("❌ Finance report load failed", err);
  } finally {
    hideLoading();
    applyBtn?.removeAttribute("disabled");
  }
}