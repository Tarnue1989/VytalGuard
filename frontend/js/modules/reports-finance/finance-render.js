// 📊 finance-render.js – FINAL (Enterprise-aligned)
// ============================================================
// 🔹 Renders finance summary + service breakdown
// 🔹 Adds payments by method + deposit summary
// 🔹 Safe against null / empty data
// ============================================================

/* ============================================================
   📊 FINANCE SUMMARY
============================================================ */
export function renderFinanceSummary(data = {}) {
  const container = document.getElementById("financeSummary");
  if (!container) return;

  const gross = fmt(data.gross_total);
  const paid = fmt(data.paid);
  const refunded = fmt(data.payment_refunded ?? data.refunded);
  const outstanding = fmt(data.outstanding);

  container.innerHTML = `
    <div class="col-xl-3 col-sm-6">
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="text-muted small">Total Revenue</div>
          <h6 class="mb-0">$${gross}</h6>
        </div>
      </div>
    </div>

    <div class="col-xl-3 col-sm-6">
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="text-muted small">Paid</div>
          <h6 class="mb-0 text-success">$${paid}</h6>
        </div>
      </div>
    </div>

    <div class="col-xl-3 col-sm-6">
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="text-muted small">Refunded</div>
          <h6 class="mb-0 text-danger">$${refunded}</h6>
        </div>
      </div>
    </div>

    <div class="col-xl-3 col-sm-6">
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="text-muted small">Outstanding</div>
          <h6 class="mb-0 text-warning">$${outstanding}</h6>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   📦 REVENUE BY SERVICE
============================================================ */
export function renderServiceTable(rows = []) {
  const body = document.getElementById("financeServiceTable");
  if (!body) return;

  if (!Array.isArray(rows) || !rows.length) {
    body.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-muted small">
          No service data available
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = rows
    .map(
      (r) => `
        <tr>
          <td>${safe(r.module)}</td>
          <td>${Number(r.items || 0)}</td>
          <td>$${fmt(r.revenue)}</td>
        </tr>
      `
    )
    .join("");
}

/* ============================================================
   💳 PAYMENTS BY METHOD
============================================================ */
export function renderPaymentsTable(rows = []) {
  const body = document.getElementById("financePaymentsTable");
  if (!body) return;

  if (!Array.isArray(rows) || !rows.length) {
    body.innerHTML = `
      <tr>
        <td colspan="2" class="text-center text-muted small">
          No payment data available
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = rows
    .map(
      (r) => `
        <tr>
          <td>${safe(r.method)}</td>
          <td>$${fmt(r.amount)}</td>
        </tr>
      `
    )
    .join("");
}

/* ============================================================
   💰 DEPOSIT SUMMARY (LIABILITY VIEW)
============================================================ */
export function renderDepositSummary(data = {}) {
  const container = document.getElementById("financeDepositSummary");
  if (!container) return;

  const collected = fmt(data.collected);
  const applied = fmt(data.applied);
  const refunded = fmt(data.deposit_refunded);
  const remaining = fmt(data.remaining);

  container.innerHTML = `
    <div class="row g-3">
      <div class="col-md-3">
        <div class="text-muted small">Collected</div>
        <div class="fw-semibold">$${collected}</div>
      </div>

      <div class="col-md-3">
        <div class="text-muted small">Applied</div>
        <div class="fw-semibold text-success">$${applied}</div>
      </div>

      <div class="col-md-3">
        <div class="text-muted small">Refunded</div>
        <div class="fw-semibold text-danger">$${refunded}</div>
      </div>

      <div class="col-md-3">
        <div class="text-muted small">Remaining</div>
        <div class="fw-semibold text-warning">$${remaining}</div>
      </div>
    </div>
  `;
}

/* ============================================================
   🔧 HELPERS
============================================================ */
function fmt(val) {
  const num = Number(val || 0);
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function safe(val) {
  return val ?? "";
}
