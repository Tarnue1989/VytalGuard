// 📁 backend/src/utils/recalcHelper.js

export async function triggerInvoiceRecalc(invoice_id, transaction) {
  // 🚫 Safety check
  if (!invoice_id) return;

  // 🔁 Dynamic import (NO circular issues)
  const { Invoice } = await import("../models/index.js");

  // 🔥 Trigger main recalc engine
  await Invoice.recalculate(invoice_id, transaction);
}