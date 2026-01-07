import { authFetch } from "../../../authSession.js";
import { showToast } from "../../../utils/index.js";

document.addEventListener("DOMContentLoaded", async () => {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return showToast("❌ No waiver ID provided");

  try {
    const res = await authFetch(`/api/discount-waivers/${id}`);
    const { data } = await res.json();
    if (!data) return showToast("❌ Waiver not found");

    document.getElementById("receiptContent").innerHTML = `
      <p><strong>Waiver No:</strong> ${data.waiver_number || data.id}</p>
      <p><strong>Date:</strong> ${new Date(data.created_at).toLocaleDateString()}</p>
      <p><strong>Patient:</strong> ${data.patient_label || "—"}</p>
      <p><strong>Invoice:</strong> ${data.invoice?.invoice_number || "—"}</p>
      <table class="table table-bordered mt-3">
        <tr><th>Amount</th><td>$${Number(data.amount || 0).toFixed(2)}</td></tr>
        <tr><th>Reason</th><td>${data.reason || "—"}</td></tr>
        <tr><th>Status</th><td>${data.status}</td></tr>
      </table>
    `;

    document.getElementById("printBtn").addEventListener("click", () =>
      html2pdf().from(document.getElementById("receiptContent"))
        .set({ filename: `waiver-receipt-${id}.pdf` }).save()
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load waiver receipt");
  }
});
