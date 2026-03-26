// 📊 finance-render.js – FINAL PRO (Enterprise Financial Reporting)
// ============================================================
// 🔹 Correct sign handling (no fake negatives)
// 🔹 Smart color logic (only negative = red)
// 🔹 Clean financial formatting
// ============================================================

/* ============================================================
   📊 FINANCE SUMMARY
============================================================ */
export function renderFinanceSummary(data = {}) {
  const container = document.getElementById("financeSummary");
  if (!container) return;

  const gross = Number(data.subtotal || 0);
  const discount = Number(data.discounts || 0);
  const waivers = Number(data.waivers || 0);
  const net = Number(data.gross_total || 0);
  const paid = Number(data.paid || 0);
  const deposits = Number(data.applied_deposits || 0);
  const outstanding = Number(data.outstanding || 0);

  container.innerHTML = `
    ${card("Gross Revenue", gross)}
    ${card("Discounts", discount)}
    ${card("Waivers", waivers)}
    ${card("Net Revenue", net)}
    ${card("Cash Paid", paid, "text-success")}
    ${card("Deposits Used", deposits, "text-info")}
    ${card("Outstanding", outstanding, "text-warning")}
  `;
}

/* ============================================================
   📦 REVENUE BY SERVICE
============================================================ */
export function renderServiceTable(rows = []) {
  const body = document.getElementById("financeServiceTable");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted small">
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
        <td>${formatMoney(net)}</td>
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
      <td>${formatMoney(totalNet)}</td>
    </tr>
  `;

  body.innerHTML = rowsHtml + totalRow;
}

/* ============================================================
   💳 PAYMENTS BY METHOD
============================================================ */
export function renderPaymentsTable(rows = []) {
  const body = document.getElementById("financePaymentsTable");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = `
      <tr>
        <td colspan="2" class="text-center text-muted small">
          No payment data available
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = rows.map(r => `
    <tr>
      <td>${safe(r.method)}</td>
      <td>${formatMoney(r.amount)}</td>
    </tr>
  `).join("");
}

/* ============================================================
   💰 DEPOSIT SUMMARY
============================================================ */
export function renderDepositSummary(data = {}) {
  const container = document.getElementById("financeDepositSummary");
  if (!container) return;

  container.innerHTML = `
    <div class="row g-3">
      <div class="col-md-3">
        <div class="text-muted small">Collected</div>
        <div class="fw-semibold">${formatMoney(data.collected)}</div>
      </div>
      <div class="col-md-3">
        <div class="text-muted small">Applied</div>
        <div class="fw-semibold text-success">${formatMoney(data.applied)}</div>
      </div>
      <div class="col-md-3">
        <div class="text-muted small">Refunded</div>
        <div class="fw-semibold ${data.deposit_refunded < 0 ? "text-danger" : ""}">
          ${formatMoney(data.deposit_refunded)}
        </div>
      </div>
      <div class="col-md-3">
        <div class="text-muted small">Remaining</div>
        <div class="fw-semibold text-warning">${formatMoney(data.remaining)}</div>
      </div>
    </div>
  `;
}

/* ============================================================
   🧩 CARD HELPER
============================================================ */
function card(label, value, extraClass = "") {
  return `
    <div class="col-xl-2 col-sm-6">
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="text-muted small">${label}</div>
          <h6 class="${value < 0 ? "text-danger" : extraClass}">
            ${formatMoney(value)}
          </h6>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   💰 MONEY FORMAT (CORE FIX)
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