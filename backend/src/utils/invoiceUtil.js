// 📁 backend/src/utils/invoiceUtil.js
// ============================================================================
// 💰 Invoice Utility – Enterprise Master Pattern (FIXED ENUM SAFE)
// ============================================================================

import db, { sequelize } from "../models/index.js";
import { INVOICE_STATUS } from "../constants/enums.js";
import { auditService } from "../services/auditService.js";

export async function recalcInvoice(invoiceId, t = null) {
  const [rows] = await sequelize.query(
    `
    SELECT
      (SELECT COUNT(*) 
         FROM invoice_items i 
        WHERE i.invoice_id = inv.id) AS total_items_count,

      (SELECT COUNT(*) 
         FROM invoice_items i 
        WHERE i.invoice_id = inv.id 
          AND i.status <> 'voided') AS active_items_count,

      (SELECT COALESCE(SUM(i.unit_price * i.quantity),0) 
         FROM invoice_items i 
        WHERE i.invoice_id = inv.id 
          AND i.status <> 'voided') AS subtotal,

      (SELECT COALESCE(SUM(i.tax_amount),0) 
         FROM invoice_items i 
        WHERE i.invoice_id = inv.id 
          AND i.status <> 'voided') AS total_tax,

      (SELECT COALESCE(SUM(i.net_amount),0) 
         FROM invoice_items i 
        WHERE i.invoice_id = inv.id 
          AND i.status <> 'voided') AS total_items,

      (
        SELECT COALESCE(SUM(w.applied_total),0)
        FROM discount_waivers w
        WHERE w.invoice_id = inv.id
          AND w.status IN ('applied','approved')
      )
      +
      (
        SELECT COALESCE(SUM(d.value),0)
        FROM discounts d
        WHERE d.invoice_id = inv.id
          AND d.status = 'finalized'
      ) AS total_waivers,

      (SELECT COALESCE(SUM(dep.applied_amount),0) 
         FROM deposits dep 
        WHERE dep.applied_invoice_id = inv.id 
          AND dep.status IN ('applied','cleared','verified')) AS total_deposits,

      (SELECT COALESCE(SUM(pay.amount),0) 
         FROM payments pay 
        WHERE pay.invoice_id = inv.id 
          AND pay.status IN ('completed','verified')) AS total_paid,

      (SELECT COALESCE(SUM(ref.amount),0) 
         FROM refunds ref 
        WHERE ref.invoice_id = inv.id 
          AND ref.status IN ('processed','approved')) AS total_refunds

    FROM invoices inv
    WHERE inv.id = :invoiceId
    `,
    { replacements: { invoiceId }, transaction: t }
  );

  const t0 = rows[0] || {};

  // 🧮 Convert numeric fields
  const subtotal      = parseFloat(t0.subtotal)      || 0;
  const totalTax      = parseFloat(t0.total_tax)     || 0;
  const totalItems    = parseFloat(t0.total_items)   || 0;
  const totalWaivers  = parseFloat(t0.total_waivers) || 0;
  const totalDeposits = parseFloat(t0.total_deposits)|| 0;
  const totalPaid     = parseFloat(t0.total_paid)    || 0;
  const totalRefunds  = parseFloat(t0.total_refunds) || 0;
  const activeItems   = parseInt(t0.active_items_count || 0, 10);

  // 💵 Compute balance
  let balance = totalItems - totalWaivers - totalDeposits - totalPaid + totalRefunds;
  if (balance < 0) balance = 0;

  const invoice = await db.Invoice.findByPk(invoiceId, { transaction: t });
  if (!invoice) throw new Error("❌ Invoice not found");

  // 🚫 Cancelled/voided invoices are locked
  if (
    [INVOICE_STATUS.CANCELLED, INVOICE_STATUS.VOIDED].includes(invoice.status)
  ) {
    balance = 0;
  }

  /* ============================================================
     🔹 Auto-update STATUS (FIXED ENUM SAFE)
  ============================================================ */
  let newStatus = invoice.status;

  if (
    ![INVOICE_STATUS.CANCELLED, INVOICE_STATUS.VOIDED].includes(newStatus)
  ) {
    if (activeItems === 0 && subtotal === 0) {
      newStatus = INVOICE_STATUS.VOIDED;
    } else if (balance <= 0 && totalItems > 0) {
      newStatus = INVOICE_STATUS.PAID;
    } else if ((totalPaid > 0 || totalDeposits > 0) && balance > 0) {
      newStatus = INVOICE_STATUS.PARTIAL;
    } else if (totalItems > 0 && totalPaid === 0 && totalDeposits === 0) {
      newStatus = INVOICE_STATUS.UNPAID;
    } else if (newStatus === INVOICE_STATUS.DRAFT && totalItems > 0) {
      newStatus = INVOICE_STATUS.ISSUED;
    }
  }

  // 💾 Persist recalculated fields
  await invoice.update(
    {
      subtotal: subtotal.toFixed(2),
      total_tax: totalTax.toFixed(2),
      total: totalItems.toFixed(2),
      total_discount: totalWaivers.toFixed(2),
      applied_deposits: totalDeposits.toFixed(2),
      total_paid: totalPaid.toFixed(2),
      refunded_amount: totalRefunds.toFixed(2),
      balance: balance.toFixed(2),
      status: newStatus,
    },
    { transaction: t }
  );

  // 🧾 Debug trace
  console.log("[RecalcInvoice]", {
    invoiceId,
    subtotal: subtotal.toFixed(2),
    tax: totalTax.toFixed(2),
    total: totalItems.toFixed(2),
    discount: totalWaivers.toFixed(2),
    deposits: totalDeposits.toFixed(2),
    paid: totalPaid.toFixed(2),
    refunds: totalRefunds.toFixed(2),
    balance: balance.toFixed(2),
    status: newStatus,
  });

  /* ============================================================
     🧭 Audit Log
  ============================================================ */
  try {
    await auditService.logAction({
      module: "invoice",
      action: "recalc_invoice",
      entityId: invoice.id,
      user: { id: invoice.updated_by_id || invoice.created_by_id || null },
      details: {
        subtotal: subtotal.toFixed(2),
        total: totalItems.toFixed(2),
        discount: totalWaivers.toFixed(2),
        deposits: totalDeposits.toFixed(2),
        paid: totalPaid.toFixed(2),
        refunds: totalRefunds.toFixed(2),
        balance: balance.toFixed(2),
        status: newStatus,
      },
      entity: invoice,
      transaction: t,
    });
  } catch (err) {
    console.warn("[RecalcInvoice] ⚠️ Failed to log audit entry:", err.message);
  }

  return invoice;
}