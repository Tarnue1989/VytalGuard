import { getOrgConfig } from "./org-config.js";
import { formatDate } from "./ui-utils.js";

export function renderReceipt({ type, containerId }) {
  const el = document.getElementById(containerId);
  if (!el) return;

  // load org branding (logo, name, footer)
  const org = getOrgConfig();

  const titleMap = {
    invoice: "Invoice Receipt",
    payment: "Payment Receipt",
    refund: "Refund Receipt",
    deposit: "Deposit Receipt"
  };

  // fetch record from sessionStorage (set before opening print window)
  const record = JSON.parse(sessionStorage.getItem("printRecord") || "{}");

  el.innerHTML = `
    <div class="receipt">
      <header>
        <img src="${org.logoUrl}" alt="Logo" />
        <h2>${org.name}</h2>
        <p>${org.address || ""}</p>
      </header>

      <h3 class="text-center">${titleMap[type]}</h3>

      <section class="details">
        ${renderDetails(type, record)}
      </section>

      <footer>
        <p>${org.footerNote || "Thank you for your business."}</p>
      </footer>
    </div>
  `;

  window.print();
}

function renderDetails(type, record) {
  switch (type) {
    case "invoice":
      return `
        <p><strong>Invoice #:</strong> ${record.invoice_number || "—"}</p>
        <p><strong>Date:</strong> ${formatDate(record.created_at)}</p>
        <p><strong>Patient:</strong> ${record.patient?.first_name || ""} ${record.patient?.last_name || ""}</p>
        <p><strong>Total:</strong> $${Number(record.total || 0).toFixed(2)}</p>
      `;
    case "payment":
      return `
        <p><strong>Payment Ref:</strong> ${record.transaction_ref || "—"}</p>
        <p><strong>Date:</strong> ${formatDate(record.created_at)}</p>
        <p><strong>Amount:</strong> $${Number(record.amount || 0).toFixed(2)}</p>
        <p><strong>Method:</strong> ${record.method || "—"}</p>
      `;
    case "refund":
      return `
        <p><strong>Refund ID:</strong> ${record.id || "—"}</p>
        <p><strong>Date:</strong> ${formatDate(record.created_at)}</p>
        <p><strong>Amount:</strong> $${Number(record.amount || 0).toFixed(2)}</p>
        <p><strong>Reason:</strong> ${record.reason || "—"}</p>
      `;
    case "deposit":
      return `
        <p><strong>Deposit ID:</strong> ${record.id || "—"}</p>
        <p><strong>Date:</strong> ${formatDate(record.created_at)}</p>
        <p><strong>Amount:</strong> $${Number(record.amount || 0).toFixed(2)}</p>
        <p><strong>Status:</strong> ${record.status || "—"}</p>
      `;
    default:
      return `<p>No data available.</p>`;
  }
}
