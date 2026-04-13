// 📊 finance-render.js – ENTERPRISE UPGRADE (Grouped + Pro Tables)
// ============================================================
// 🔥 Grouped Summary Cards (Revenue / Cash / Deposits / Outstanding)
// 🔥 Payments table upgraded with %
// 🔥 Deposit summary merged into cards (no duplicate section)
// 🔥 Clean enterprise UX (decision-first design)
// ============================================================

/* ============================================================
   📊 FINANCE SUMMARY (GROUPED CARDS)
============================================================ */
export function renderFinanceSummary(data = {}) {
  const container = document.getElementById("financeSummary");
  if (!container) return;

  const gross = Number(data.subtotal || 0);
  const discount = Number(data.discounts || 0);
  const waivers = Number(data.waivers || 0);
  const net = Number(data.gross_total || 0);

  const paid = Number(data.paid || 0);
  const refunded = Number(data.payment_refunded || 0);
  const netCash = Number(data.net_cash || 0);

  const depositCollected = Number(data.deposit_collected || 0);
  const depositUsed = Number(data.applied_deposits || 0);
  const depositRefunded = Number(data.deposit_refunded || 0);
  const depositBalance = Number(data.deposit_balance || 0);

  const outstanding = Number(data.outstanding || 0);

  container.innerHTML = `
    ${groupCard("📊 Revenue", [
      row("Gross", gross),
      row("Discount", discount, "text-danger"),
      row("Waivers", waivers, "text-warning"),
      divider(),
      row("Net", net, "fw-bold text-primary")
    ])}

    ${groupCard("💰 Cash Flow", [
      row("Collected", paid, "text-success"),
      row("Refunded", refunded, "text-danger"),
      divider(),
      row("Net Cash", netCash, "fw-bold text-primary")
    ])}

    ${groupCard("🏦 Deposits", [
      row("Collected", depositCollected),
      row("Used", depositUsed, "text-info"),
      row("Refunded", depositRefunded, "text-danger"),
      divider(),
      row("Balance", depositBalance, "fw-bold text-warning")
    ])}

    ${groupCard("⚠️ Outstanding", [
      bigValue(outstanding, "text-warning")
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

  const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const rowsHtml = rows.map(r => {
    const amount = Number(r.amount || 0);
    const percent = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;

    return `
      <tr>
        <td>${safe(r.method)}</td>
        <td>${formatMoney(amount)}</td>
        <td class="text-muted">${percent}%</td>
      </tr>
    `;
  }).join("");

  const totalRow = `
    <tr class="fw-bold border-top bg-light">
      <td>TOTAL</td>
      <td>${formatMoney(total)}</td>
      <td>100%</td>
    </tr>
  `;

  body.innerHTML = rowsHtml + totalRow;
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
function groupCard(title, contentRows = []) {
  return `
    <div class="col-xl-3 col-md-6">
      <div class="card border-0 shadow-sm h-100">
        <div class="card-body">
          <div class="fw-semibold mb-2">${title}</div>
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