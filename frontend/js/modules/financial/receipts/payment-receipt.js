import { authFetch } from "../../../authSession.js";
import { showToast } from "../../../utils/index.js";

document.addEventListener("DOMContentLoaded", async () => {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return showToast("❌ No payment ID provided");

  try {
    const res = await authFetch(`/api/payments/${id}`);
    const { data } = await res.json();
    if (!data) return showToast("❌ Payment not found");

    document.getElementById("receiptContent").innerHTML = `
      <p><strong>Receipt No:</strong> ${data.payment_number || data.id}</p>
      <p><strong>Date:</strong> ${new Date(data.created_at).toLocaleDateString()}</p>
      <p><strong>Patient:</strong> ${data.patient_label || "—"}</p>
      <p><strong>Invoice:</strong> ${data.invoice?.invoice_number || "—"}</p>
      <table class="table table-bordered mt-3">
        <tr><th>Method</th><td>${data.method || "—"}</td></tr>
        <tr><th>Amount</th><td>$${Number(data.amount || 0).toFixed(2)}</td></tr>
        <tr><th>Status</th><td>${data.status}</td></tr>
      </table>
      <p><strong>Notes:</strong> ${data.notes || "—"}</p>
    `;

    document.getElementById("printBtn").addEventListener("click", () =>
      html2pdf().from(document.getElementById("receiptContent"))
        .set({ filename: `payment-receipt-${id}.pdf` }).save()
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load payment receipt");
  }
});
