// 📦 finance-filter-main.js – FINAL (UI + PRINT FULL + EXPENSES + INSURANCE)
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

    /* ========================================================
       🔥 FETCH ALL (UPGRADED)
    ======================================================== */
    const [
      summaryRes,
      servicesRes,
      paymentsRes,
      depositsRes,
      expensesRes,     // 🔥 NEW
      insuranceRes,    // 🔥 NEW
    ] = await Promise.all([
      authFetch(`/api/reports/finance/summary?${query}`),
      authFetch(`/api/reports/finance/services?${query}`),
      authFetch(`/api/reports/finance/payments?${query}`),
      authFetch(`/api/reports/finance/deposits?${query}`),

      // 🔥 NEW ENDPOINTS
      authFetch(`/api/reports/finance/expenses?${query}`),
      authFetch(`/api/reports/finance/insurance?${query}`),
    ]);

    /* ========================================================
       🔥 PARSE RESPONSES
    ======================================================== */
    const summaryJson   = summaryRes.ok   ? await summaryRes.json()   : {};
    const servicesJson  = servicesRes.ok  ? await servicesRes.json()  : {};
    const paymentsJson  = paymentsRes.ok  ? await paymentsRes.json()  : {};
    const depositsJson  = depositsRes.ok  ? await depositsRes.json()  : {};
    const expensesJson  = expensesRes.ok  ? await expensesRes.json()  : {};
    const insuranceJson = insuranceRes.ok ? await insuranceRes.json() : {};

    console.log("Finance Summary:", summaryJson);
    console.log("Deposits:", depositsJson);
    console.log("Expenses:", expensesJson);
    console.log("Insurance:", insuranceJson);

    /* ========================================================
       🔥 MERGE ALL DATA (FINAL)
    ======================================================== */
    const summaryData  = summaryJson?.data || {};
    const depositData  = depositsJson?.data || {};
    const expenseData  = expensesJson?.data || {};
    const insuranceData = insuranceJson?.data || {};

    const mergedSummary = {
      ...summaryData,

      /* =========================
         🏦 DEPOSITS
      ========================= */
      deposit_collected: depositData.collected || 0,
      applied_deposits: depositData.applied || 0,
      deposit_refunded: depositData.deposit_refunded || 0,
      deposit_balance: depositData.remaining || 0,

      /* =========================
         💸 EXPENSES (NEW)
      ========================= */
      total_expense: expenseData.total_expense || 0,

      /* =========================
         🏥 INSURANCE (NEW)
      ========================= */
      insurance_claimed: insuranceData.claimed || 0,
      insurance_approved: insuranceData.approved || 0,
      insurance_paid: insuranceData.paid || 0,
      insurance_outstanding: insuranceData.outstanding || 0,
    };

    /* ========================================================
       🔥 PROFIT (CRITICAL)
    ======================================================== */
    mergedSummary.profit =
      (mergedSummary.net_cash || 0) -
      (mergedSummary.total_expense || 0);

    /* ========================================================
       🎨 RENDER
    ======================================================== */
    renderFinanceSummary(mergedSummary);
    renderFinanceInsights(mergedSummary);
    renderServiceTable(servicesJson?.data || []);
    renderPaymentsTable(paymentsJson?.data || []);
    renderDepositSummary(); // intentionally empty

    /* ========================================================
       🖨️ STORE FOR PRINT
    ======================================================== */
    window.financeSummaryData  = mergedSummary;
    window.financeServicesData = servicesJson?.data || [];
    window.financePaymentsData = paymentsJson?.data || [];

  } catch (err) {
    console.error("❌ Finance report load failed", err);
  } finally {
    hideLoading();
    applyBtn?.removeAttribute("disabled");
  }
}