// 📁 backend/src/services/financialService.js
import db, { sequelize } from "../models/index.js";
import {
  PAYMENT_STATUS,
  REFUND_STATUS,
  DEPOSIT_STATUS,
  DISCOUNT_WAIVER_STATUS,
  LEDGER_STATUS,
  INVOICE_STATUS,
  DISCOUNT_STATUS
} from "../constants/enums.js";
import { recalcInvoice } from "../utils/invoiceUtil.js";

/* ============================================================
   🔖 Local enum maps
============================================================ */
const PS = {
  PENDING: PAYMENT_STATUS[0],     // "pending"
  COMPLETED: PAYMENT_STATUS[1],   // "completed"
  FAILED: PAYMENT_STATUS[2],      // "failed"
  CANCELLED: PAYMENT_STATUS[3],   // "cancelled"
  REVERSED: PAYMENT_STATUS[4],    // "reversed"
  VOIDED: PAYMENT_STATUS[5],      // "voided"
  VERIFIED: PAYMENT_STATUS[6],    // "verified"
};
const RS = {
  PENDING: REFUND_STATUS[0],
  APPROVED: REFUND_STATUS[1],
  REJECTED: REFUND_STATUS[2],
  PROCESSED: REFUND_STATUS[3],
  CANCELLED: REFUND_STATUS[4],
  REVERSED: REFUND_STATUS[5]
};

const RTS = {
  PENDING: REFUND_STATUS[0],    // "pending"
  APPROVED: REFUND_STATUS[1],   // "approved"
  REJECTED: REFUND_STATUS[2],   // "rejected"
  PROCESSED: REFUND_STATUS[3],  // "processed"
  CANCELLED: REFUND_STATUS[4],  // "cancelled"
  REVERSED: REFUND_STATUS[5],   // "reversed"
};

// 💰 Deposit lifecycle map (enterprise-aligned)
const DS = {
  PENDING: DEPOSIT_STATUS[0],     // new deposit
  CLEARED: DEPOSIT_STATUS[1],     // verified funds received
  APPLIED: DEPOSIT_STATUS[2],     // applied to invoice
  CANCELLED: DEPOSIT_STATUS[3],   // user cancelled before use
  REVERSED: DEPOSIT_STATUS[4],    // reversed from invoice
  VOIDED: DEPOSIT_STATUS[5] || "voided",     // 🆕 admin invalidation
  VERIFIED: DEPOSIT_STATUS[6] || "verified", // 🆕 audited/locked
};



const WS = {
  PENDING: DISCOUNT_WAIVER_STATUS[0],
  APPROVED: DISCOUNT_WAIVER_STATUS[1],
  APPLIED: DISCOUNT_WAIVER_STATUS[2],
  REJECTED: DISCOUNT_WAIVER_STATUS[3],
  VOIDED: DISCOUNT_WAIVER_STATUS[4],
};

const IS = {
  DRAFT: INVOICE_STATUS[0],
  ISSUED: INVOICE_STATUS[1],
  UNPAID: INVOICE_STATUS[2],
  PARTIAL: INVOICE_STATUS[3],
  PAID: INVOICE_STATUS[4],
  CANCELLED: INVOICE_STATUS[5],
  VOIDED: INVOICE_STATUS[6],
};
const DSC = {
  DRAFT: DISCOUNT_STATUS[0],
  ACTIVE: DISCOUNT_STATUS[1],
  INACTIVE: DISCOUNT_STATUS[2],
  FINALIZED: DISCOUNT_STATUS[3],
  VOIDED: DISCOUNT_STATUS[4],
};

/* ============================================================
   🔹 Helper: Write to FinancialLedger
============================================================ */
async function logLedger({
  type, // "payment" | "refund" | "deposit" | "waiver" | "discount" | "reversal"
  entity,
  organization_id,
  facility_id,
  patient_id,
  invoice_id,
  amount,
  method,
  note,
  user,
  t,
}) {
  const ledgerData = {
    organization_id,
    facility_id,
    patient_id: patient_id || null,
    invoice_id: invoice_id || null,
    amount,
    method: method || null,
    status: LEDGER_STATUS[0], // pending
    note,
    created_by_id: user?.id,
  };

  switch (type) {
    case "payment":
      ledgerData.transaction_type = "credit";
      ledgerData.payment_id = entity.id;
      break;
    case "deposit":
      ledgerData.transaction_type = "credit";
      ledgerData.deposit_id = entity.id;
      break;
    case "refund":
      ledgerData.transaction_type = "debit";
      ledgerData.refund_id = entity.id;
      break;
    case "waiver":
      ledgerData.transaction_type = "debit";
      ledgerData.discount_waiver_id = entity.id;
      break;
    case "discount":
      ledgerData.transaction_type = "debit";
      ledgerData.discount_id = entity.id;   // 👈 link to discount model
      break;
    case "reversal":
      ledgerData.transaction_type = amount >= 0 ? "credit" : "debit";
      ledgerData.note = `Reversal entry - ${note}`;
      break;
    default:
      throw new Error("❌ Unsupported ledger type");
  }

  return await db.FinancialLedger.create(ledgerData, { transaction: t, user });
}


/* ============================================================
   💰 Financial Service
============================================================ */
export const financialService = {
  /* ----------------- Payments ----------------- */
  async applyPayment({ invoice_id, amount, method, transaction_ref, user }) {
    return await sequelize.transaction(async (t) => {
      const invoice = await db.Invoice.findByPk(invoice_id, { transaction: t });
      if (!invoice) throw new Error("❌ Invoice not found");
      if (invoice.is_locked) throw new Error("❌ Cannot add payment to locked invoice");

      if (parseFloat(amount) <= 0)
        throw new Error("❌ Payment amount must be greater than 0");

      const payment = await db.Payment.create(
        {
          invoice_id,
          organization_id: invoice.organization_id,
          facility_id: invoice.facility_id,
          patient_id: invoice.patient_id,
          amount,
          method,
          transaction_ref,
          status: PS.PENDING,
          created_by_id: user?.id,
        },
        { transaction: t, user }
      );

      await logLedger({
        type: "payment",
        entity: payment,
        organization_id: invoice.organization_id,
        facility_id: invoice.facility_id,
        patient_id: invoice.patient_id,
        invoice_id,
        amount,
        method,
        note: `Payment of ${amount} via ${method}`,
        user,
        t,
      });

      const updatedInvoice = await recalcInvoice(invoice_id, t);
      return { payment, invoice: updatedInvoice };
    });
  },

  async completePayment(payment_id, user) {
    return await sequelize.transaction(async (t) => {
      const payment = await db.Payment.findByPk(payment_id, { transaction: t });
      if (!payment) throw new Error("❌ Payment not found");

      await payment.update({ status: PS.COMPLETED }, { transaction: t, user });
      const updatedInvoice = await recalcInvoice(payment.invoice_id, t);
      return { payment, invoice: updatedInvoice };
    });
  },

    /* ----------------- Refunds ----------------- */
    async applyRefund({ payment_id, amount, reason, user }) {
      return await sequelize.transaction(async (t) => {
        const payment = await db.Payment.findByPk(payment_id, { transaction: t });
        if (!payment) throw new Error("❌ Payment not found");

        if (parseFloat(amount) <= 0)
          throw new Error("❌ Refund amount must be greater than 0");
        if (parseFloat(amount) > parseFloat(payment.amount))
          throw new Error("❌ Refund amount cannot exceed original payment");

        const refund = await db.Refund.create(
          {
            payment_id,
            invoice_id: payment.invoice_id,
            organization_id: payment.organization_id,
            facility_id: payment.facility_id,
            patient_id: payment.patient_id,
            amount,
            reason,
            method: payment.method, // ✅ COPY METHOD HERE
            status: RS.PENDING,
            created_by_id: user?.id,
          },
          { transaction: t, user }
        );

        await db.RefundTransaction.create(
          {
            refund_id: refund.id,
            organization_id: refund.organization_id,
            facility_id: refund.facility_id,
            patient_id: refund.patient_id,
            invoice_id: refund.invoice_id,
            amount,
            method: payment.method, // ✅ add also to transaction log
            status: RTS.PENDING,
            created_by_id: user?.id,
          },
          { transaction: t, user }
        );

        return { refund };
      });
    },

    async approveRefund(refund_id, user) {
      return await sequelize.transaction(async (t) => {
        const refund = await db.Refund.findByPk(refund_id, { transaction: t });
        if (!refund) throw new Error("❌ Refund not found");

        if (refund.status !== RS.PENDING) {
          throw new Error(`❌ Only pending refunds can be approved (current: ${refund.status})`);
        }

        await refund.update(
          {
            status: RS.APPROVED,
            approved_by_id: user?.id || null,
            approved_at: new Date(),
          },
          { transaction: t, user }
        );

        // 🔹 Track approval in transactions
        await db.RefundTransaction.create(
          {
            refund_id: refund.id,
            organization_id: refund.organization_id,
            facility_id: refund.facility_id,
            patient_id: refund.patient_id,
            invoice_id: refund.invoice_id,   // ✅ FIX
            amount: refund.amount,
            status: RTS.APPROVED,
            approved_by_id: user?.id || null,
            approved_at: new Date(),
          },
          { transaction: t, user }
        );

        return { refund };
      });
    },

    async rejectRefund(refund_id, reason, user) {
      return await sequelize.transaction(async (t) => {
        const refund = await db.Refund.findByPk(refund_id, { transaction: t });
        if (!refund) throw new Error("❌ Refund not found");

        if (refund.status !== RS.PENDING) {
          throw new Error(`❌ Only pending refunds can be rejected (current: ${refund.status})`);
        }

        if (!reason) throw new Error("❌ Reason required to reject refund");

        await refund.update(
          {
            status: RS.REJECTED,
            rejected_by_id: user?.id || null,
            rejected_at: new Date(),
            reason,
          },
          { transaction: t, user }
        );

        // 🔹 Track rejection
        await db.RefundTransaction.create(
          {
            refund_id: refund.id,
            organization_id: refund.organization_id,
            facility_id: refund.facility_id,
            patient_id: refund.patient_id,
            invoice_id: refund.invoice_id,   // ✅ FIX
            amount: refund.amount,
            status: RTS.REJECTED,
            rejected_by_id: user?.id || null,
            rejected_at: new Date(),
            reject_reason: reason,
          },
          { transaction: t, user }
        );

        return { refund };
      });
    },

    async processRefund(refund_id, user) {
      return await sequelize.transaction(async (t) => {
        const refund = await db.Refund.findByPk(refund_id, { transaction: t });
        if (!refund) throw new Error("❌ Refund not found");

        if (refund.status !== RS.APPROVED) {
          throw new Error("❌ Refund must be approved before processing");
        }

        await refund.update(
          {
            status: RS.PROCESSED,
            processed_by_id: user?.id || null,
            processed_at: new Date(),
          },
          { transaction: t, user }
        );

        // 🔹 Track processing
        await db.RefundTransaction.create(
          {
            refund_id: refund.id,
            organization_id: refund.organization_id,
            facility_id: refund.facility_id,
            patient_id: refund.patient_id,
            invoice_id: refund.invoice_id,   // ✅ FIX
            amount: refund.amount,
            status: RTS.PROCESSED,
            processed_by_id: user?.id || null,
            processed_at: new Date(),
          },
          { transaction: t, user }
        );

        await logLedger({
          type: "refund",
          entity: refund,
          organization_id: refund.organization_id,
          facility_id: refund.facility_id,
          patient_id: refund.patient_id,
          invoice_id: refund.invoice_id,
          amount: refund.amount,
          note: `Processed refund of ${refund.amount} for reason: ${refund.reason}`,
          user,
          t,
        });

        const updatedInvoice = await recalcInvoice(refund.invoice_id, t);
        return { refund, invoice: updatedInvoice };
      });
    },

    async cancelRefund(refund_id, reason, user) {
      return await sequelize.transaction(async (t) => {
        const refund = await db.Refund.findByPk(refund_id, { transaction: t });
        if (!refund) throw new Error("❌ Refund not found");

        if (![RS.PENDING, RS.APPROVED].includes(refund.status)) {
          throw new Error(`❌ Only pending or approved refunds can be cancelled (current: ${refund.status})`);
        }

        if (!reason) throw new Error("❌ Reason required to cancel refund");

        await refund.update(
          {
            status: RS.CANCELLED,
            cancelled_by_id: user?.id || null,
            cancelled_at: new Date(),
            reason,
          },
          { transaction: t, user }
        );

        // 🔹 Track cancellation
        await db.RefundTransaction.create(
          {
            refund_id: refund.id,
            organization_id: refund.organization_id,
            facility_id: refund.facility_id,
            patient_id: refund.patient_id,
            invoice_id: refund.invoice_id,   // ✅ FIX
            amount: refund.amount,
            status: RTS.CANCELLED,
            cancelled_by_id: user?.id || null,
            cancelled_at: new Date(),
          },
          { transaction: t, user }
        );

        return { refund };
      });
    },

    async reverseRefund(refund_id, user) {
      return await sequelize.transaction(async (t) => {
        const refund = await db.Refund.findByPk(refund_id, { transaction: t, paranoid: false });
        if (!refund) throw new Error("❌ Refund not found");

        if (refund.status !== RS.PROCESSED) {
          throw new Error(`❌ Only processed refunds can be reversed (current: ${refund.status})`);
        }

        await refund.update(
          {
            status: RS.REVERSED,
            cancelled_by_id: user?.id || null,
            cancelled_at: new Date(),
            reason: "Reversal of processed refund",
          },
          { transaction: t, user }
        );

        // 🔹 Track reversal
        await db.RefundTransaction.create(
          {
            refund_id: refund.id,
            organization_id: refund.organization_id,
            facility_id: refund.facility_id,
            patient_id: refund.patient_id,
            invoice_id: refund.invoice_id,   // ✅ FIX
            amount: refund.amount,
            status: RTS.REVERSED,
            reversed_by_id: user?.id || null,
            reversed_at: new Date(),
          },
          { transaction: t, user }
        );

        await logLedger({
          type: "reversal",
          entity: refund,
          organization_id: refund.organization_id,
          facility_id: refund.facility_id,
          patient_id: refund.patient_id,
          invoice_id: refund.invoice_id,
          amount: refund.amount,
          note: `Refund reversed (original: ${refund.id})`,
          user,
          t,
        });

        const updatedInvoice = await recalcInvoice(refund.invoice_id, t);
        return { refund, invoice: updatedInvoice, message: "✅ Refund reversed" };
      });
    },

    async voidRefund(refund_id, reason, user) {
      return await sequelize.transaction(async (t) => {
        const refund = await db.Refund.findByPk(refund_id, { transaction: t });
        if (!refund) throw new Error("❌ Refund not found");

        // Prevent voiding processed or reversed refunds
        if ([RS.PROCESSED, RS.REVERSED].includes(refund.status)) {
          throw new Error("❌ Processed or reversed refunds cannot be voided");
        }

        await refund.update(
          {
            status: "voided",
            void_reason: reason || null,
            voided_by_id: user?.id,
            voided_at: new Date(),
          },
          { transaction: t, user }
        );

        await logLedger({
          type: "reversal",
          entity: refund,
          organization_id: refund.organization_id,
          facility_id: refund.facility_id,
          patient_id: refund.patient_id,
          invoice_id: refund.invoice_id,
          amount: -Math.abs(refund.amount),
          note: `Refund voided · Reason: ${reason || "N/A"}`,
          user,
          t,
        });

        const updatedInvoice = await recalcInvoice(refund.invoice_id, t);
        return { refund, invoice: updatedInvoice };
      });
    },

    async restoreRefund(refund_id, user) {
      return await sequelize.transaction(async (t) => {
        const refund = await db.Refund.findOne({
          where: { id: refund_id },
          paranoid: false,
          transaction: t,
        });
        if (!refund) throw new Error("❌ Refund not found");

        // Restore soft-deleted record if needed
        if (refund.deleted_at) {
          await refund.restore({ transaction: t });
        }

        // Move VOIDED / REVERSED → PENDING
        const newStatus =
          ["voided", "reversed"].includes(refund.status?.toLowerCase())
            ? "pending"
            : refund.status;

        await refund.update(
          {
            status: newStatus,
            restored_by_id: user?.id,
            restored_at: new Date(),
            updated_by_id: user?.id,
          },
          { transaction: t, user }
        );

        await logLedger({
          type: "refund",
          entity: refund,
          organization_id: refund.organization_id,
          facility_id: refund.facility_id,
          patient_id: refund.patient_id,
          invoice_id: refund.invoice_id,
          amount: refund.amount,
          note: `Refund restored from ${refund.status} → ${newStatus}`,
          user,
          t,
        });

        const updatedInvoice = await recalcInvoice(refund.invoice_id, t);
        return { refund, invoice: updatedInvoice };
      });
    },

    /* ----------------- Deposits ----------------- */
    async applyDeposit({
    patient_id,
    organization_id,
    facility_id,
    amount,
    method,
    transaction_ref,
    notes,
    reason,
    invoice_id,
    user,
    t,
    }) {
    if (parseFloat(amount) <= 0) {
        throw new Error("❌ Deposit amount must be greater than 0");
    }

    let appliedAmt = 0;
    let remaining = parseFloat(amount) || 0;

    if (invoice_id) {
        const invoice = await db.Invoice.findByPk(invoice_id, { transaction: t });
        if (!invoice) throw new Error("❌ Invoice not found");

        const invoiceBalance = parseFloat(invoice.balance) || 0;
        appliedAmt = Math.min(invoiceBalance, remaining);
        remaining = remaining - appliedAmt;
    }

    const deposit = await db.Deposit.create(
        {
        patient_id,
        organization_id,
        facility_id,
        applied_invoice_id: invoice_id || null,
        amount,
        method,
        transaction_ref,
        notes,
        reason,
        status: invoice_id ? DS.APPLIED : DS.PENDING, // ✅ auto-apply if invoice given
        applied_amount: appliedAmt.toFixed(2),
        remaining_balance: remaining.toFixed(2),
        created_by_id: user?.id,
        },
        { transaction: t, user }
    );

    await logLedger({
        type: "deposit",
        entity: deposit,
        organization_id,
        facility_id,
        patient_id,
        invoice_id,
        amount,
        method,
        note: `Deposit of ${amount} via ${method}${
        transaction_ref ? ` (Ref: ${transaction_ref})` : ""
        }${notes ? ` · ${notes}` : ""}${reason ? ` · Reason: ${reason}` : ""}`,
        user,
        t,
    });

    let updatedInvoice = null;
    if (invoice_id) {
        updatedInvoice = await recalcInvoice(invoice_id, t);
    }

    return { deposit, invoice: updatedInvoice };
    },

    async finalizeDeposit({ deposit_id, invoice_id = null, user }) {
    return await sequelize.transaction(async (t) => {
        const deposit = await db.Deposit.findByPk(deposit_id, { transaction: t });
        if (!deposit) throw new Error("❌ Deposit not found");

        if (![DS.PENDING, DS.CLEARED].includes(deposit.status)) {
        throw new Error("❌ Only pending/cleared deposits can be finalized");
        }

        // auto-link invoice if not provided
        let targetInvoiceId = invoice_id || deposit.applied_invoice_id;
        if (!targetInvoiceId) {
        const openInvoice = await db.Invoice.findOne({
            where: {
            patient_id: deposit.patient_id,
            organization_id: deposit.organization_id,
            facility_id: deposit.facility_id,
            status: [IS.DRAFT, IS.ISSUED, IS.UNPAID, IS.PARTIAL],
            is_locked: false,
            },
            order: [["created_at", "DESC"]],
            transaction: t,
        });
        if (openInvoice) targetInvoiceId = openInvoice.id;
        }

        let appliedAmt = 0;
        let remaining = parseFloat(deposit.amount) || 0;

        if (targetInvoiceId) {
        const invoice = await db.Invoice.findByPk(targetInvoiceId, { transaction: t });
        if (!invoice) throw new Error("❌ Invoice not found");

        const invoiceBalance = parseFloat(invoice.balance) || 0;
        const depositAmt = parseFloat(deposit.amount) || 0;

        appliedAmt = Math.min(invoiceBalance, depositAmt);
        remaining = depositAmt - appliedAmt;
        }

        await deposit.update(
        {
            status: DS.APPLIED,
            applied_invoice_id: targetInvoiceId,
            applied_amount: appliedAmt.toFixed(2),
            remaining_balance: remaining.toFixed(2),
            updated_by_id: user?.id,
        },
        { transaction: t, user }
        );

        if (targetInvoiceId) {
        await recalcInvoice(targetInvoiceId, t);
        }

        return { deposit, invoice_id: targetInvoiceId };
    });
    },

    async clearDeposit({ deposit_id, user }) {
    return await sequelize.transaction(async (t) => {
        const deposit = await db.Deposit.findByPk(deposit_id, { transaction: t });
        if (!deposit) throw new Error("❌ Deposit not found");

        if (deposit.status !== DS.PENDING) {
        throw new Error("❌ Only pending deposits can be cleared");
        }

        await deposit.update(
        { status: DS.CLEARED, updated_by_id: user?.id },
        { transaction: t, user }
        );

        return { deposit };
    });
    },
    /* ----------------- Toggle Deposit Status ----------------- */
    async toggleDepositStatus({ deposit_id, user, t }) {
        const deposit = await db.Deposit.findByPk(deposit_id, { transaction: t });
        if (!deposit) throw new Error("❌ Deposit not found");

        if ([DS.CANCELLED, DS.REVERSED].includes(deposit.status)) {
        throw new Error("❌ Cancelled/Reversed deposits cannot be toggled");
        }

        let newStatus = deposit.status;

        if (deposit.status === DS.PENDING) {
        // move → CLEARED
        await deposit.update(
            { status: DS.CLEARED, updated_by_id: user?.id },
            { transaction: t, user }
        );
        newStatus = DS.CLEARED;

        } else if (deposit.status === DS.CLEARED) {
        // move → APPLIED (delegate to finalizeDeposit)
        const { deposit: finalized } = await this.finalizeDeposit({
            deposit_id,
            user,
        });
        newStatus = finalized.status;
        } else if (deposit.status === DS.APPLIED) {
        // maybe allow rollback to CLEARED if no invoice?
        // for now we leave as-is
        throw new Error("❌ Applied deposits cannot be toggled back");
        }

        return { deposit, newStatus };
    },

    /* ----------------- Apply Deposit to Invoice ----------------- */
    async applyDepositToInvoice({ deposit_id, invoice_id, amount, user }) {
      return await sequelize.transaction(async (t) => {
        // 🔎 Fetch deposit
        const deposit = await db.Deposit.findByPk(deposit_id, { transaction: t });
        if (!deposit) throw new Error("❌ Deposit not found");

        // 🔒 Only cleared or applied deposits can be used
        if (![DS.CLEARED, DS.APPLIED].includes(deposit.status)) {
          throw new Error("❌ Only cleared or applied deposits can be used");
        }

        // 🔎 Fetch invoice
        const invoice = await db.Invoice.findByPk(invoice_id, { transaction: t });
        if (!invoice) throw new Error("❌ Invoice not found");
        if (invoice.is_locked)
          throw new Error("❌ Cannot apply deposit to locked invoice");

        // 💰 Validate available deposit + invoice balances
        const remainingDeposit = parseFloat(deposit.remaining_balance) || 0;
        const invoiceBalance = parseFloat(invoice.balance ?? invoice.total ?? 0);
        const applyAmt = Math.min(
          parseFloat(amount),
          remainingDeposit,
          invoiceBalance
        );

        if (applyAmt <= 0)
          throw new Error("❌ Invalid or exhausted deposit/invoice balance");

        // 🧾 Record deposit application
        const application = await db.DepositApplication.create(
          {
            deposit_id,
            invoice_id,
            applied_amount: applyAmt.toFixed(2),
            applied_by_id: user?.id || null,
          },
          { transaction: t, user }
        );

        // 🏦 Update deposit (manual verification mode)
        const newApplied = (parseFloat(deposit.applied_amount) || 0) + applyAmt;
        const newRemaining = Math.max(
          0,
          (parseFloat(deposit.amount) || 0) - newApplied
        );

        // ✅ Always stay "applied" — verification done manually
        const newStatus = DS.APPLIED;

        await deposit.update(
          {
            applied_invoice_id: deposit.applied_invoice_id || invoice_id,
            applied_amount: newApplied.toFixed(2),
            remaining_balance: newRemaining.toFixed(2),
            status: newStatus,
            updated_by_id: user?.id,
          },
          { transaction: t, user }
        );

        // 🧮 Update invoice balance + status directly
        const newInvBalance = Math.max(0, invoiceBalance - applyAmt);
        invoice.balance = newInvBalance.toFixed(2);
        invoice.status =
          newInvBalance <= 0 ? IS.PAID : IS.PARTIAL;
        invoice.updated_by_id = user?.id || null;
        await invoice.save({ transaction: t, user });

        // 🧾 Ledger Entry
        await logLedger({
          type: "deposit",
          entity: deposit,
          organization_id: deposit.organization_id,
          facility_id: deposit.facility_id,
          patient_id: deposit.patient_id,
          invoice_id,
          amount: applyAmt,
          note: `Applied ${applyAmt.toFixed(2)} from deposit ${deposit.id} → invoice ${invoice.invoice_number}`,
          user,
          t,
        });

        // 🧠 Recalculate invoice totals (ensures consistency for reports)
        const updatedInvoice = await recalcInvoice(invoice_id, t);

        return {
          application,
          deposit,
          invoice: updatedInvoice,
        };
      });
    },

    /* ----------------- Verify Deposit ----------------- */
    async verifyDeposit({ deposit_id, user }) {
      return await sequelize.transaction(async (t) => {
        const deposit = await db.Deposit.findByPk(deposit_id, { transaction: t });
        if (!deposit) throw new Error("❌ Deposit not found");

        if (![DS.CLEARED, DS.APPLIED].includes(deposit.status)) {
          throw new Error("❌ Only cleared/applied deposits can be verified");
        }

        await deposit.update(
          {
            status: DS.VERIFIED,
            verified_by_id: user?.id,
            verified_at: new Date(),
          },
          { transaction: t, user }
        );

        await logLedger({
          type: "deposit",
          entity: deposit,
          organization_id: deposit.organization_id,
          facility_id: deposit.facility_id,
          patient_id: deposit.patient_id,
          invoice_id: deposit.applied_invoice_id,
          amount: deposit.amount,
          note: `Deposit verified by ${user?.name || "system"}`,
          user,
          t,
        });

        return { deposit };
      });
    },

    /* ----------------- Void Deposit (FIXED) ----------------- */
    async voidDeposit({ deposit_id, reason, user }) {
      return await sequelize.transaction(async (t) => {
        const deposit = await db.Deposit.findByPk(deposit_id, { transaction: t });
        if (!deposit) throw new Error("❌ Deposit not found");

        if ([DS.VERIFIED, DS.REVERSED, DS.VOIDED].includes(deposit.status)) {
          throw new Error("❌ Verified, reversed, or voided deposits cannot be voided");
        }

        // 🔁 STEP 1: Reverse all applications + invoice effects
        await this.reverseTransaction({
          type: "deposit",
          id: deposit_id,
          user,
          reason: reason || "Deposit voided",
        });

        // 🔒 STEP 2: Mark deposit as VOIDED (final administrative state)
        await deposit.update(
          {
            status: DS.VOIDED,
            void_reason: reason || null,
            voided_by_id: user?.id,
            voided_at: new Date(),
            updated_by_id: user?.id,
          },
          { transaction: t, user }
        );

        return { deposit };
      });
    },


    /* ----------------- applyWaiver ----------------- */
    async applyWaiver({
    invoice_id,
    patient_id,
    organization_id,
    facility_id,
    type,
    value,
    reason,
    user,
    }) {
    return await sequelize.transaction(async (t) => {
        const invoice = await db.Invoice.findByPk(invoice_id, { transaction: t });
        if (!invoice) throw new Error("❌ Invoice not found");
        if (invoice.is_locked) throw new Error("❌ Cannot request waiver on locked invoice");

        if (!["percentage", "fixed"].includes(type)) {
        throw new Error("❌ Invalid waiver type");
        }

        // 🧮 Calculate initial expected amount (not applied yet, just for validation/preview)
        const baseTotal = parseFloat(invoice.total) || 0;
        let expectedAmount =
        type === "fixed"
            ? parseFloat(value) || 0
            : (baseTotal * (parseFloat(value) || 0)) / 100;

        // Waiver cannot exceed current balance
        if (expectedAmount > parseFloat(invoice.balance || 0)) {
        expectedAmount = parseFloat(invoice.balance || 0);
        }

        const waiver = await db.DiscountWaiver.create(
        {
            invoice_id,
            patient_id,
            organization_id,
            facility_id,
            type,
            reason,
            percentage: type === "percentage" ? value : null,
            amount: type === "fixed" ? value : null,
            applied_total: 0, // 👈 actual applied happens only at finalize
            status: WS.PENDING,
            created_by_id: user?.id,
        },
        { transaction: t, user }
        );

        return { waiver, invoice };
    });
    },

    /* ----------------- finalizeWaiver ----------------- */
    async finalizeWaiver(waiver_id, user) {
    return await sequelize.transaction(async (t) => {
        const waiver = await db.DiscountWaiver.findByPk(waiver_id, { transaction: t });
        if (!waiver) throw new Error("❌ Waiver not found");

        if (waiver.status !== WS.APPROVED) {
        throw new Error("❌ Only approved waivers can be finalized");
        }

        const invoice = await db.Invoice.findByPk(waiver.invoice_id, { transaction: t });
        if (!invoice) throw new Error("❌ Invoice not found for waiver");

        const baseTotal = parseFloat(invoice.total) || 0;
        let waiverAmount =
        waiver.type === "fixed"
            ? parseFloat(waiver.amount) || 0
            : (baseTotal * (parseFloat(waiver.percentage) || 0)) / 100;

        // Guard: cannot exceed remaining invoice balance
        const currentBalance = parseFloat(invoice.balance || 0);
        if (waiverAmount > currentBalance) {
        waiverAmount = currentBalance;
        }

        await waiver.update(
        {
            status: WS.APPLIED,
            applied_total: waiverAmount.toFixed(2),
            updated_by_id: user?.id,
            finalized_by_id: user?.id || null,
            finalized_at: new Date(),
        },
        { transaction: t, user }
        );

        await logLedger({
        type: "waiver",
        entity: waiver,
        organization_id: waiver.organization_id,
        facility_id: waiver.facility_id,
        patient_id: waiver.patient_id,
        invoice_id: waiver.invoice_id,
        amount: waiverAmount,
        note: `Waiver finalized: ${waiver.type} (${waiverAmount.toFixed(2)})`,
        user,
        t,
        });

        const updatedInvoice = await recalcInvoice(waiver.invoice_id, t);

        console.log("[FinalizeWaiver] Invoice recalculated", {
        invoice_id: updatedInvoice.id,
        total: updatedInvoice.total,
        discount: updatedInvoice.total_discount,
        deposits: updatedInvoice.applied_deposits,
        paid: updatedInvoice.total_paid,
        refunds: updatedInvoice.refunded_amount,
        balance: updatedInvoice.balance,
        });

        return { waiver, invoice: updatedInvoice };
    });
    },


    /* ----------------- reverseTransaction ----------------- */
    async reverseTransaction({ type, id, user, reason = null }) {
    return await sequelize.transaction(async (t) => {
        let entity,
        amount = 0,
        invoice_id = null,
        organization_id = null,
        facility_id = null,
        patient_id = null,
        note = "";

        switch (type) {
        case "payment": {
            entity = await db.Payment.findByPk(id, { transaction: t });
            if (!entity) throw new Error("❌ Payment not found");

            amount = -Math.abs(entity.amount);
            invoice_id = entity.invoice_id;
            organization_id = entity.organization_id;
            facility_id = entity.facility_id;
            patient_id = entity.patient_id;

            note = `Reversal of payment ${id}`;
            await entity.update(
            { status: PS.CANCELLED, updated_by_id: user?.id },
            { transaction: t, user }
            );
            break;
        }

        case "refund": {
            entity = await db.Refund.findByPk(id, { transaction: t });
            if (!entity) throw new Error("❌ Refund not found");

            amount = Math.abs(entity.amount);
            invoice_id = entity.invoice_id;
            organization_id = entity.organization_id;
            facility_id = entity.facility_id;
            patient_id = entity.patient_id;

            note = `Reversal of refund ${id}`;
            await entity.update(
            { status: RS.CANCELLED, updated_by_id: user?.id },
            { transaction: t, user }
            );
            break;
        }

        case "deposit": {
            entity = await db.Deposit.findByPk(id, { transaction: t });
            if (!entity) throw new Error("❌ Deposit not found");

            const baseAmt = parseFloat(entity.amount) || 0;

            // 🔎 Collect all applications for this deposit
            const applications = await db.DepositApplication.findAll({
            where: { deposit_id: id },
            transaction: t,
            });

            const appliedTotal = applications.reduce(
            (sum, app) => sum + (parseFloat(app.applied_amount) || 0),
            0
            );

            // 🔹 Mark apps as reversed
            await db.DepositApplication.update(
            { reversed_at: new Date(), reversed_by_id: user?.id },
            { where: { deposit_id: id }, transaction: t }
            );

            // 🔹 Reset deposit
            await entity.update(
            {
                status: DS.REVERSED,
                applied_amount: 0,
                remaining_balance: baseAmt,
                applied_invoice_id: null,
                updated_by_id: user?.id,
            },
            { transaction: t, user }
            );

            // 🔹 Ledger reversal reflects applied or base
            amount = -Math.abs(appliedTotal > 0 ? appliedTotal : baseAmt);

            organization_id = entity.organization_id;
            facility_id = entity.facility_id;
            patient_id = entity.patient_id;
            note = `Reversal of deposit ${id}`;

            // 🔹 Recalculate all invoices touched by this deposit
            for (const app of applications) {
            if (app.invoice_id) {
                await recalcInvoice(app.invoice_id, t);
            }
            }
            break;
        }

        case "waiver": {
            entity = await db.DiscountWaiver.findByPk(id, { transaction: t });
            if (!entity) throw new Error("❌ Waiver not found");

            amount = Math.abs(
            parseFloat(entity.applied_amount) || parseFloat(entity.amount) || 0
            );
            invoice_id = entity.invoice_id;
            organization_id = entity.organization_id;
            facility_id = entity.facility_id;
            patient_id = entity.patient_id;

            note = `Reversal of waiver ${id}`;
            await entity.update(
            {
                status: WS.VOIDED,
                applied_amount: 0,
                remaining_balance: entity.amount,
                updated_by_id: user?.id,
            },
            { transaction: t, user }
            );
            break;
        }

        default:
            throw new Error("❌ Unsupported reversal type");
        }

        if (reason) note += ` · Reason: ${reason}`;
        else if (entity?.reason) note += ` · Reason: ${entity.reason}`;

        await logLedger({
        type: "reversal",
        entity,
        organization_id,
        facility_id,
        patient_id,
        invoice_id,
        amount,
        note,
        user,
        t,
        });

        // 🔹 If only one invoice_id was set, recalc it too
        if (invoice_id) {
        await recalcInvoice(invoice_id, t);
        }

        return { success: true, message: `✅ ${type} reversed successfully` };
    });
    },
  
  
/* ----------------- Discounts ----------------- */
async createDiscount({
  invoice_id,
  invoice_item_id,
  discount_policy_id,
  type,
  value,
  reason,
  organization_id,
  facility_id,
  name,
  user,
}) {
  return await sequelize.transaction(async (t) => {
    if (!["percentage", "fixed"].includes(type)) {
      throw new Error("❌ Invalid discount type");
    }

    // 🔎 Validate invoice
    let invoice = null;
    if (invoice_id) {
      invoice = await db.Invoice.findByPk(invoice_id, { transaction: t });
      if (!invoice) throw new Error("❌ Invoice not found");
      if (invoice.is_locked)
        throw new Error("❌ Cannot apply discount to locked invoice");
    }

    // Guardrails
    if (type === "percentage" && value > 100) {
      throw new Error("❌ Percentage discount cannot exceed 100%");
    }

    // Prevent duplicates
    const duplicate = await db.Discount.findOne({
      where: {
        invoice_id: invoice_id || null,
        invoice_item_id: invoice_item_id || null,
        type,
        value,
        status: [DSC.ACTIVE, DSC.FINALIZED],
      },
      transaction: t,
    });
    if (duplicate)
      throw new Error("❌ A similar discount is already active/finalized");

    const discount = await db.Discount.create(
      {
        invoice_id: invoice_id || null,
        invoice_item_id: invoice_item_id || null,
        discount_policy_id: discount_policy_id || null,
        organization_id,
        facility_id,
        type,
        value,
        reason,
        name: name || (invoice_item_id ? `Item discount` : `Invoice discount`),
        status: DSC.DRAFT,
        created_by_id: user?.id,
      },
      { transaction: t, user }
    );

    if (invoice_id) {
      await recalcInvoice(invoice_id, t);

      await logLedger({
        type: "discount",
        entity: discount,
        organization_id,
        facility_id,
        patient_id: invoice.patient_id,
        invoice_id,
        amount: value,
        note: `Discount created: ${type} ${value}${type === "percentage" ? "%" : ""}`,
        user,
        t,
      });
    }

    return discount;
  });
},

async updateDiscount({ id, payload, user }) {
  return await sequelize.transaction(async (t) => {
    const discount = await db.Discount.findByPk(id, { transaction: t });
    if (!discount) throw new Error("❌ Discount not found");
    if ([DSC.FINALIZED, DSC.VOIDED].includes(discount.status)) {
      throw new Error("❌ Cannot update finalized or voided discount");
    }

    if (payload.type === "percentage" && payload.value > 100) {
      throw new Error("❌ Percentage discount cannot exceed 100%");
    }

    await discount.update(
      { ...payload, updated_by_id: user?.id },
      { transaction: t, user }
    );

    if (discount.invoice_id) {
      await recalcInvoice(discount.invoice_id, t);

      await logLedger({
        type: "discount",
        entity: discount,
        organization_id: discount.organization_id,
        facility_id: discount.facility_id,
        patient_id: discount.patient_id,
        invoice_id: discount.invoice_id,
        amount: payload.value,
        note: `Discount updated: ${payload.type} ${payload.value}${payload.type === "percentage" ? "%" : ""}`,
        user,
        t,
      });
    }

    return discount;
  });
},

/* ============================================================
   🔁 Toggle Discount Status – full lifecycle
============================================================ */
async toggleDiscountStatus({ id, user }) {
  return await sequelize.transaction(async (t) => {
    const discount = await db.Discount.findByPk(id, { transaction: t });
    if (!discount) throw new Error("❌ Discount not found");

    const current = discount.status;
    let next = current;

    switch (current) {
      case DSC.DRAFT:
        next = DSC.ACTIVE;
        break;
      case DSC.ACTIVE:
        next = DSC.INACTIVE;
        break;
      case DSC.INACTIVE:
        next = DSC.FINALIZED;
        break;
      case DSC.FINALIZED:
        next = DSC.VOIDED;
        break;
      case DSC.VOIDED:
        throw new Error("❌ Voided discount cannot be toggled – use Restore");
      default:
        next = DSC.DRAFT;
    }

    await discount.update(
      { status: next, updated_by_id: user?.id },
      { transaction: t, user }
    );

    if (discount.invoice_id) {
      await recalcInvoice(discount.invoice_id, t);
      await logLedger({
        type: "discount",
        entity: discount,
        organization_id: discount.organization_id,
        facility_id: discount.facility_id,
        patient_id: discount.patient_id,
        invoice_id: discount.invoice_id,
        amount: discount.value,
        note: `Discount status changed → ${next}`,
        user,
        t,
      });
    }

    return discount;
  });
},

/* ============================================================
   🏁 Finalize Discount
============================================================ */
async finalizeDiscount({ id, user }) {
  return await sequelize.transaction(async (t) => {
    const discount = await db.Discount.findByPk(id, { transaction: t });
    if (!discount) throw new Error("❌ Discount not found");
    if (discount.status !== DSC.ACTIVE) {
      throw new Error("❌ Only active discounts can be finalized");
    }

    await discount.update(
      {
        status: DSC.FINALIZED,
        finalized_by_id: user?.id,
        finalized_at: new Date(),
      },
      { transaction: t, user }
    );

    if (discount.invoice_id) {
      await recalcInvoice(discount.invoice_id, t);
      await logLedger({
        type: "discount",
        entity: discount,
        organization_id: discount.organization_id,
        facility_id: discount.facility_id,
        patient_id: discount.patient_id,
        invoice_id: discount.invoice_id,
        amount: discount.value,
        note: `Discount finalized: ${discount.type} ${discount.value}${discount.type === "percentage" ? "%" : ""}`,
        user,
        t,
      });
    }

    return discount;
  });
},

/* ============================================================
   🚫 Void Discount
============================================================ */
async voidDiscount({ id, reason, user }) {
  return await sequelize.transaction(async (t) => {
    const discount = await db.Discount.findByPk(id, { transaction: t });
    if (!discount) throw new Error("❌ Discount not found");
    if (discount.status === DSC.VOIDED) throw new Error("❌ Already voided");

    await discount.update(
      {
        status: DSC.VOIDED,
        void_reason: reason || null,
        voided_by_id: user?.id,
        voided_at: new Date(),
      },
      { transaction: t, user }
    );

    if (discount.invoice_id) {
      await recalcInvoice(discount.invoice_id, t);
      await logLedger({
        type: "discount",
        entity: discount,
        organization_id: discount.organization_id,
        facility_id: discount.facility_id,
        patient_id: discount.patient_id,
        invoice_id: discount.invoice_id,
        amount: discount.value,
        note: `Discount voided · Reason: ${reason || "N/A"}`,
        user,
        t,
      });
    }

    return discount;
  });
},

  /* ============================================================
    ♻️ Restore Discount – (Fixed v2.5 Enterprise Aligned)
    🔹 Restores both voided and soft-deleted discounts
    🔹 Correctly persists new status + triggers invoice recalculation
    🔹 Returns updated discount object for UI refresh
  ============================================================ */
  async restoreDiscount({ id, user }) {
    return await sequelize.transaction(async (t) => {
      const discount = await db.Discount.findOne({
        where: { id },
        paranoid: false,
        transaction: t,
      });
      if (!discount) throw new Error("❌ Discount not found");

      // 🧠 Handle both soft-deleted and voided discounts
      if (discount.deleted_at) {
        await discount.restore({ transaction: t });
      }

      // 🌀 Restore logic: move VOIDED → DRAFT
      if (discount.status === DSC.VOIDED) {
        await discount.update(
          {
            status: DSC.DRAFT,
            updated_by_id: user?.id,
            restored_by_id: user?.id || null,
            restored_at: new Date(),
          },
          { transaction: t, user }
        );
      } else {
        await discount.update(
          {
            updated_by_id: user?.id,
            restored_by_id: user?.id || null,
            restored_at: new Date(),
          },
          { transaction: t, user }
        );
      }

      // 🔄 Recalculate linked invoice if applicable
      if (discount.invoice_id) {
        await recalcInvoice(discount.invoice_id, t);
      }

      // ✅ Return the fresh updated record
      const refreshed = await db.Discount.findByPk(discount.id, { transaction: t });
      return refreshed;
    });
  },


async deleteDiscount({ id, user }) {
  return await sequelize.transaction(async (t) => {
    const discount = await db.Discount.findByPk(id, { transaction: t });
    if (!discount) throw new Error("❌ Discount not found");
    if ([DSC.FINALIZED, DSC.VOIDED].includes(discount.status)) {
      throw new Error("❌ Cannot delete finalized or voided discount");
    }

    await discount.update({ deleted_by_id: user?.id }, { transaction: t });
    await discount.destroy({ transaction: t });

    if (discount.invoice_id) await recalcInvoice(discount.invoice_id, t);
    return discount;
  });
},

  /* ----------------- Ledger ----------------- */
  async getLedgerEntries(filters = {}, options = {}) {
    return await db.FinancialLedger.findAll({
      where: filters,
      order: [["created_at", "DESC"]],
      ...options,
    });
  },

    /* ----------------- Public Invoice Recalc ----------------- */
    async recalcInvoice(invoiceId, t = null) {
    return await recalcInvoice(invoiceId, t); // thin wrapper
    }

};
