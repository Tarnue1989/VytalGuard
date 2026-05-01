// 📊 finance-render.js – ENTERPRISE UPGRADE (Grouped + Pro Tables)
// ============================================================
// 🔥 Grouped Summary Cards (Revenue / Cash / Deposits / Outstanding)
// 🔥 Payments table upgraded with %
// 🔥 Deposit summary merged into cards (no duplicate section)
// 🔥 Clean enterprise UX (decision-first design)
// ============================================================

function formatMoneyByCurrency(amount, currency) {
  const symbols = {
    USD: "$",
    LRD: "L$",
  };

  const symbol = symbols[currency] || "";

  return `${symbol}${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
/* ============================================================
   📊 FINANCE SUMMARY (GROUPED CARDS)
============================================================ */
export function renderFinanceSummary(data = {}) {
  const container = document.getElementById("financeSummary");
  if (!container) return;

  const summary = data.summary || [];
  const deposits = data.deposits || {};

  /* =========================
     🔥 HELPER (LOCAL SAFE)
  ========================= */
  const currencyLines = (arr, field) => {
    if (!Array.isArray(arr)) return formatMoney(arr);

    return arr.map(r => {
      const val = Number(r[field] || 0);
      return `<div>${r.currency}: ${formatMoneyByCurrency(val, r.currency)}</div>`;
    }).join("");
  };

  
  container.innerHTML = `

    ${groupCard("📊 Revenue", [
      rowHTML("Gross", currencyLines(summary, "subtotal")),
      rowHTML("Discount", currencyLines(summary, "discounts"), "text-danger"),
      rowHTML("Waivers", currencyLines(summary, "waivers"), "text-warning"),
      divider(),
      rowHTML("Net", currencyLines(summary, "gross_total"), "fw-bold text-primary")
    ])}

    ${groupCard("💰 Cash Flow", [
      rowHTML("Collected", currencyLines(summary, "paid"), "text-success"),
      rowHTML("Refunded", currencyLines(summary, "payment_refunded"), "text-danger"),
      divider(),
      rowHTML("Net Cash", currencyLines(summary, "net_cash"), "fw-bold text-primary")
    ])}

    ${groupCard("🏦 Deposits", [
      rowHTML("Collected", currencyLines(deposits.collected, "collected")),
      rowHTML("Used", currencyLines(deposits.applied, "applied"), "text-info"),
      rowHTML("Refunded", currencyLines(deposits.deposit_refunded, "refunded"), "text-danger"),
      divider(),
      rowHTML("Balance", currencyLines(deposits.remaining, "remaining"), "fw-bold text-warning")
    ])}

    ${groupCard("⚠️ Outstanding Invoices", [
      rowHTML("Total", currencyLines(summary, "outstanding"), "fw-bold text-warning")
    ])}
  `;
}
/* ============================================================
   📦 REVENUE BY SERVICE (ENHANCED)
============================================================ */
export function renderServiceTable(rows = []) {
  const body = document.getElementById("financeServiceTable");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted small">
          No service data available
        </td>
      </tr>
    `;
    return;
  }

  let totalItems = 0;
  let totalGross = 0;
  let totalDiscount = 0;
  let totalNet = 0;

  const rowsHtml = rows.map((r) => {
    const items = Number(r.items || 0);
    const gross = Number(r.gross || 0);
    const discount = Number(r.discount || 0);
    const net = Number(r.revenue || 0);

    totalItems += items;
    totalGross += gross;
    totalDiscount += discount;
    totalNet += net;

    return `
      <tr>
        <td>${formatModule(r.module)}</td>
        <td>${items}</td>
        <td>${formatMoney(gross)}</td>
        <td class="${discount < 0 ? "text-danger" : ""}">
          ${formatMoney(discount)}
        </td>
        <td class="fw-semibold">${formatMoney(net)}</td>
      </tr>
    `;
  }).join("");

  const totalRow = `
    <tr class="fw-bold border-top bg-light">
      <td>TOTAL</td>
      <td>${totalItems}</td>
      <td>${formatMoney(totalGross)}</td>
      <td class="${totalDiscount < 0 ? "text-danger" : ""}">
        ${formatMoney(totalDiscount)}
      </td>
      <td class="text-primary">${formatMoney(totalNet)}</td>
    </tr>
  `;

  body.innerHTML = rowsHtml + totalRow;
}

/* ============================================================
   💳 PAYMENTS BY METHOD (UPGRADED)
============================================================ */
export function renderPaymentsTable(rows = []) {
  const body = document.getElementById("financePaymentsTable");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-muted small">
          No payment data available
        </td>
      </tr>
    `;
    return;
  }

  /* ============================================================
     🔥 GROUP BY CURRENCY
  ============================================================ */
  const grouped = {};

  rows.forEach(r => {
    const currency = r.currency || "UNK";
    if (!grouped[currency]) grouped[currency] = [];

    grouped[currency].push({
      method: r.method,
      amount: Number(r.amount || 0),
    });
  });

  /* ============================================================
     🔥 BUILD TABLE (PER CURRENCY)
  ============================================================ */
  let html = "";

  Object.keys(grouped).forEach(currency => {
    const list = grouped[currency];

    const total = list.reduce((sum, r) => sum + r.amount, 0);

    html += `
      <tr class="table-light fw-bold">
        <td colspan="3">${currency}</td>
      </tr>
    `;

    list.forEach(r => {
      const percent = total > 0
        ? ((r.amount / total) * 100).toFixed(1)
        : 0;

      html += `
        <tr>
          <td>${safe(r.method)}</td>
          <td>${formatMoney(r.amount)}</td>
          <td class="text-muted">${percent}%</td>
        </tr>
      `;
    });

    html += `
      <tr class="fw-bold border-top bg-light">
        <td>TOTAL (${currency})</td>
        <td>${formatMoney(total)}</td>
        <td>100%</td>
      </tr>
    `;
  });

  body.innerHTML = html;
}

/* ============================================================
   ❌ DEPOSIT SUMMARY REMOVED (MERGED INTO CARDS)
============================================================ */
export function renderDepositSummary() {
  const container = document.getElementById("financeDepositSummary");
  if (container) container.innerHTML = "";
}

/* ============================================================
   🧩 GROUP CARD
============================================================ */
const FINANCE_ROUTE_MAP = {
  revenue: "/invoices-list.html",
  cash: "/payments-list.html",
  deposits: "/deposits-list.html",
  outstanding: "/invoices-list.html?status=unpaid",
};

function groupCard(title, contentRows = []) {
  let key = "";

  if (title.includes("Revenue")) key = "revenue";
  else if (title.includes("Cash")) key = "cash";
  else if (title.includes("Deposits")) key = "deposits";
  else if (title.includes("Outstanding")) key = "outstanding";

  const route = FINANCE_ROUTE_MAP[key] || "";

  return `
    <div class="col-xl-3 col-md-6">
      <div class="card border-0 shadow-sm h-100 summary-card clickable"
           data-route="${route}">
        <div class="card-body">

          <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="fw-semibold">${title}</div>
            ${route ? `<a href="${route}" class="small text-primary">View →</a>` : ""}
          </div>

          ${contentRows.join("")}
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   🧩 ROW
============================================================ */
function row(label, value, extraClass = "") {
  return `
    <div class="d-flex justify-content-between small mb-1">
      <span class="text-muted">${label}</span>
      <span class="${extraClass}">${formatMoney(value)}</span>
    </div>
  `;
}
function rowHTML(label, html, extraClass = "") {
  return `
    <div class="d-flex justify-content-between small mb-1">
      <span class="text-muted">${label}</span>
      <span class="${extraClass}">${html}</span>
    </div>
  `;
}
function bigValue(val, cls = "") {
  return `
    <div class="text-center mt-2">
      <h5 class="${cls}">${formatMoney(val)}</h5>
    </div>
  `;
}

function divider() {
  return `<hr class="my-1"/>`;
}

/* ============================================================
   💰 MONEY FORMAT
============================================================ */
function formatMoney(val) {
  const num = Number(val || 0);

  const formatted = Math.abs(num).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return num < 0
    ? `-L$${formatted}`
    : `L$${formatted}`;
}

/* ============================================================
   🔧 HELPERS
============================================================ */
function safe(val) {
  return val ?? "";
}

function formatModule(key) {
  return key
    ?.replace(/_/g, " ")
    ?.replace(/\b\w/g, c => c.toUpperCase());
}

/* ============================================================
   📈 FINANCE INSIGHTS (🔥 FIXED — MULTI-CURRENCY SAFE)
   - Expenses
   - Profit
   - Refunds
   - Insurance
   👉 No currency mixing
============================================================ */
export function renderFinanceInsights(data = {}) {
  const container = document.getElementById("financeInsights");
  if (!container) return;

  /* ============================================================
     🔥 HELPER — FORMAT MULTI-CURRENCY LINES
     - Accepts array OR single number
     - Displays: USD: L$200 / LRD: L$48,000
  ============================================================ */
  const currencyLines = (arr, field) => {
    if (!Array.isArray(arr)) return formatMoney(arr);

    return arr.map(r => {
      const val = Number(r[field] || 0);
      return `<div>${r.currency}: ${formatMoneyByCurrency(val, r.currency)}</div>`;
    }).join("");
  };

  /* ============================================================
     🔹 SAFE DATA (RAW FROM BACKEND)
  ============================================================ */
  const expenses = data.expenses || [];
  const insurance = data.insurance || [];
  const summary = data.summary || [];
  const deposits = data.deposits || {};

  container.innerHTML = `

    <!-- ===================================================== -->
    <!-- 💸 EXPENSES -->
    <!-- ===================================================== -->
    <div class="col-xl-3 col-md-6">
      <div class="card border-0 shadow-sm h-100 summary-card clickable"
           data-route="/expenses-list.html">
        <div class="card-body">
          <div class="fw-semibold mb-2 d-flex justify-content-between">
            <span>💸 Expenses</span>
            <a href="/expenses-list.html" class="small text-primary">View →</a>
          </div>

          <div class="fw-bold text-danger">
            ${currencyLines(expenses, "total")}
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================== -->
    <!-- 📈 PROFIT -->
    <!-- ===================================================== -->
    <div class="col-xl-3 col-md-6">
      <div class="card border-0 shadow-sm h-100 summary-card clickable"
           data-route="/finance-reports.html">
        <div class="card-body">
          <div class="fw-semibold mb-2 d-flex justify-content-between">
            <span>📈 Profit</span>
            <a href="/finance-reports.html" class="small text-primary">View →</a>
          </div>

          <div class="small text-muted">Net Cash - Expenses</div>

          <div class="fw-bold text-primary">
            <!-- 🔥 PROFIT PER CURRENCY -->
            ${summary.map(s => {
              const currency = s.currency;
              const netCash = Number(s.net_cash || 0);

              const expenseRow = expenses.find(e => e.currency === currency);
              const exp = Number(expenseRow?.total || 0);

              const profit = netCash - exp;

              const formatted = Math.abs(profit).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });

              return `<div class="${profit >= 0 ? "text-success" : "text-danger"}">
                ${currency}: ${formatMoneyByCurrency(profit, currency)}
              </div>`;
            }).join("")}
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================== -->
    <!-- 🔁 REFUNDS -->
    <!-- ===================================================== -->
    <div class="col-xl-3 col-md-6">
      <div class="card border-0 shadow-sm h-100 summary-card clickable"
           data-route="/refunds-list.html">
        <div class="card-body">
          <div class="fw-semibold mb-2 d-flex justify-content-between">
            <span>🔁 Refunds</span>
            <a href="/refunds-list.html" class="small text-primary">View →</a>
          </div>

          <div class="small d-flex justify-content-between">
            <span>Payment</span>
            <span class="text-danger">
              ${currencyLines(summary, "payment_refunded")}
            </span>
          </div>

          <div class="small d-flex justify-content-between">
            <span>Deposit</span>
            <span class="text-warning">
              ${currencyLines(deposits.deposit_refunded, "refunded")}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================== -->
    <!-- 🏥 INSURANCE -->
    <!-- ===================================================== -->
    <div class="col-xl-3 col-md-6">
      <div class="card border-0 shadow-sm h-100 summary-card clickable"
           data-route="/insurance-claims-list.html">
        <div class="card-body">
          <div class="fw-semibold mb-2 d-flex justify-content-between">
            <span>🏥 Insurance</span>
            <a href="/insurance-claims-list.html" class="small text-primary">View →</a>
          </div>

          <div class="small d-flex justify-content-between">
            <span>Claimed</span>
            <span>${currencyLines(insurance, "claimed")}</span>
          </div>

          <div class="small d-flex justify-content-between">
            <span>Approved</span>
            <span class="text-primary">
              ${currencyLines(insurance, "approved")}
            </span>
          </div>

          <div class="small d-flex justify-content-between">
            <span>Paid</span>
            <span class="text-success">
              ${currencyLines(insurance, "paid")}
            </span>
          </div>

          <div class="small d-flex justify-content-between fw-bold mt-1">
            <span>Outstanding</span>
            <span class="text-warning">
              ${currencyLines(insurance.map(r => ({
                currency: r.currency,
                outstanding: Number(r.approved || 0) - Number(r.paid || 0)
              })), "outstanding")}
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
}
document.addEventListener("click", (e) => {
  const card = e.target.closest(".summary-card.clickable");
  if (!card) return;

  // allow real links
  if (e.target.closest("a")) return;

  const route = card.dataset.route;
  if (route) window.location.href = route;
});