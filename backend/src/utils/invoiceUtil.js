// 📁 backend/src/utils/invoiceUtil.js
// ============================================================================
// 💰 Invoice Utility – Enterprise Master Pattern (INSURANCE FIXED)
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

      /* 🔥 NEW: INSURANCE + PATIENT SPLIT */
      (SELECT COALESCE(SUM(i.insurance_amount),0) 
         FROM invoice_items i 
        WHERE i.invoice_id = inv.id 
          AND i.status <> 'voided') AS total_insurance,

      (SELECT COALESCE(SUM(i.patient_amount),0) 
         FROM invoice_items i 
        WHERE i.invoice_id = inv.id 
          AND i.status <> 'voided') AS total_patient,

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

  const subtotal      = parseFloat(t0.subtotal)        || 0;
  const totalTax      = parseFloat(t0.total_tax)       || 0;
  const totalItems    = parseFloat(t0.total_items)     || 0;
  const totalInsurance= parseFloat(t0.total_insurance) || 0;
  const totalPatient  = parseFloat(t0.total_patient)   || 0;
  const totalWaivers  = parseFloat(t0.total_waivers)   || 0;
  const totalDeposits = parseFloat(t0.total_deposits)  || 0;
  const totalPaid     = parseFloat(t0.total_paid)      || 0;
  const totalRefunds  = parseFloat(t0.total_refunds)   || 0;
  const activeItems   = parseInt(t0.active_items_count || 0, 10);

  /* 🔥 FIXED BALANCE */
  let balance = totalPatient - totalWaivers - totalDeposits - totalPaid + totalRefunds;
  if (balance < 0) balance = 0;

  const invoice = await db.Invoice.findByPk(invoiceId, { transaction: t });
  if (!invoice) throw new Error("❌ Invoice not found");

  if (
    [INVOICE_STATUS.CANCELLED, INVOICE_STATUS.VOIDED].includes(invoice.status)
  ) {
    balance = 0;
  }

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

  await invoice.update(
    {
      subtotal: subtotal.toFixed(2),
      total_tax: totalTax.toFixed(2),
      total: totalItems.toFixed(2),

      /* 🔥 OPTIONAL: STORE INSURANCE */
      insurance_amount: totalInsurance.toFixed(2),

      total_discount: totalWaivers.toFixed(2),
      applied_deposits: totalDeposits.toFixed(2),
      total_paid: totalPaid.toFixed(2),
      refunded_amount: totalRefunds.toFixed(2),

      /* 🔥 FIXED */
      balance: balance.toFixed(2),

      status: newStatus,
    },
    { transaction: t }
  );

  console.log("[RecalcInvoice FIXED]", {
    invoiceId,
    total: totalItems,
    insurance: totalInsurance,
    patient: totalPatient,
    balance,
    status: newStatus,
  });

  return invoice;
}