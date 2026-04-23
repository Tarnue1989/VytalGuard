// 📁 backend/src/services/financialService.js
import db, { sequelize } from "../models/index.js";
import {
  PAYMENT_STATUS,
  REFUND_STATUS,
  DEPOSIT_STATUS,
  DISCOUNT_WAIVER_STATUS,
  LEDGER_STATUS,
  INVOICE_STATUS,
  DISCOUNT_STATUS,
  LEDGER_TYPES,
  LEDGER_DIRECTIONS
} from "../constants/enums.js";
import { recalcInvoice } from "../utils/invoiceUtil.js";
import { applyLifecycleTransition } from "../utils/lifecycleUtil.js";

/* ============================================================
   🔖 Local enum maps (FIXED — OBJECT ENUM SAFE)
============================================================ */

const PS = {
  PENDING: PAYMENT_STATUS.PENDING,
  COMPLETED: PAYMENT_STATUS.COMPLETED,
  FAILED: PAYMENT_STATUS.FAILED,
  CANCELLED: PAYMENT_STATUS.CANCELLED,
  REVERSED: PAYMENT_STATUS.REVERSED,
  VOIDED: PAYMENT_STATUS.VOIDED,
  VERIFIED: PAYMENT_STATUS.VERIFIED,
};

const RS = {
  PENDING: REFUND_STATUS.PENDING,
  APPROVED: REFUND_STATUS.APPROVED,
  REJECTED: REFUND_STATUS.REJECTED,
  PROCESSED: REFUND_STATUS.PROCESSED,
  CANCELLED: REFUND_STATUS.CANCELLED,
  REVERSED: REFUND_STATUS.REVERSED,
  VOIDED: REFUND_STATUS.VOIDED,
};

const RTS = {
  PENDING: REFUND_STATUS.PENDING,
  APPROVED: REFUND_STATUS.APPROVED,
  REJECTED: REFUND_STATUS.REJECTED,
  PROCESSED: REFUND_STATUS.PROCESSED,
  CANCELLED: REFUND_STATUS.CANCELLED,
  REVERSED: REFUND_STATUS.REVERSED,
};

// 💰 Deposit lifecycle map (enterprise-aligned)
const DS = {
  PENDING: DEPOSIT_STATUS.PENDING,
  CLEARED: DEPOSIT_STATUS.CLEARED,
  APPLIED: DEPOSIT_STATUS.APPLIED,
  CANCELLED: DEPOSIT_STATUS.CANCELLED,
  REVERSED: DEPOSIT_STATUS.REVERSED,
  VOIDED: DEPOSIT_STATUS.VOIDED,
  VERIFIED: DEPOSIT_STATUS.VERIFIED,
};

const WS = {
  PENDING: DISCOUNT_WAIVER_STATUS.PENDING,
  APPROVED: DISCOUNT_WAIVER_STATUS.APPROVED,
  APPLIED: DISCOUNT_WAIVER_STATUS.APPLIED,
  REJECTED: DISCOUNT_WAIVER_STATUS.REJECTED,
  VOIDED: DISCOUNT_WAIVER_STATUS.VOIDED,
  FINALIZED: DISCOUNT_WAIVER_STATUS.FINALIZED,
};

const IS = {
  DRAFT: INVOICE_STATUS.DRAFT,
  ISSUED: INVOICE_STATUS.ISSUED,
  UNPAID: INVOICE_STATUS.UNPAID,
  PARTIAL: INVOICE_STATUS.PARTIAL,
  PAID: INVOICE_STATUS.PAID,
  CANCELLED: INVOICE_STATUS.CANCELLED,
  VOIDED: INVOICE_STATUS.VOIDED,
};

const DSC = {
  DRAFT: DISCOUNT_STATUS.DRAFT,
  ACTIVE: DISCOUNT_STATUS.ACTIVE,
  INACTIVE: DISCOUNT_STATUS.INACTIVE,
  FINALIZED: DISCOUNT_STATUS.FINALIZED,
  VOIDED: DISCOUNT_STATUS.VOIDED,
};

/* ============================================================
   🔹 Helper: Write to FinancialLedger (ENTERPRISE MASTER FINAL)
============================================================ */
async function logLedger({
  type, // "payment" | "refund" | "deposit" | "waiver" | "discount" | "expense" | "transfer" | "reversal"
  entity,
  organization_id,
  facility_id,
  account_id,
  patient_id,
  invoice_id,
  amount,
  method,
  note,
  user,
  t,
}) {
  if (!t) {
    throw new Error("❌ Transaction (t) is required for ledger logging");
  }

  if (!organization_id) {
    throw new Error("❌ organization_id is required for ledger");
  }

  if (!facility_id) {
    throw new Error("❌ facility_id is required for ledger");
  }

  if (amount === undefined || amount === null) {
    throw new Error("❌ amount is required for ledger");
  }

  const ledgerData = {
    organization_id,
    facility_id,
    patient_id: patient_id || null,
    invoice_id: invoice_id || null,
    amount: parseFloat(amount),
    method: method || null,
    status: LEDGER_STATUS.PENDING,
    note: note || null,
    created_by_id: user?.id || null,
  };

  switch (type) {
    /* ================= CREDIT ================= */
    case "payment":
      ledgerData.transaction_type = "credit";
      ledgerData.payment_id = entity?.id || null;
      break;

    case "deposit":
      ledgerData.transaction_type = "credit";
      ledgerData.deposit_id = entity?.id || null;
      break;

    /* ================= DEBIT ================= */
    case "refund":
      ledgerData.transaction_type = "debit";
      ledgerData.refund_id = entity?.id || null;
      break;

    case "waiver":
      ledgerData.transaction_type = "debit";
      ledgerData.discount_waiver_id = entity?.id || null;
      break;

    case "discount":
      ledgerData.transaction_type = "debit";
      ledgerData.discount_id = entity?.id || null;
      break;

    case "expense":
      ledgerData.transaction_type = "debit";
      ledgerData.expense_id = entity?.id || null;
      break;

    /* ================= TRANSFER ================= */
    case "transfer":
      ledgerData.transaction_type =
        parseFloat(amount) >= 0 ? "credit" : "debit";
      ledgerData.note = note || "Transfer entry";
      break;

    /* ================= REVERSAL ================= */
    case "reversal":
      ledgerData.transaction_type =
        parseFloat(amount) >= 0 ? "credit" : "debit";
      ledgerData.note = `Reversal entry${note ? ` · ${note}` : ""}`;
      break;

    /* ================= FAIL SAFE ================= */
    default:
      throw new Error(`❌ Unsupported ledger type: ${type}`);
  }

  return await db.FinancialLedger.create(ledgerData, {
    transaction: t,
    user,
  });
}

/* ============================================================
   💰 Financial Service
============================================================ */
export const financialService = {
  /* ----------------- Payments (TRANSACTION-SAFE) ----------------- */
async applyPayment({
  invoice_id,
  amount,
  method,
  transaction_ref,
  user,
  organization_id,
  facility_id,
  allow_locked_payment = false,
  t,
}) {
  if (!t) {
    throw new Error("❌ Transaction (t) is required for applyPayment");
  }

  /* ============================
     🔍 DEBUG: ENTRY PAYLOAD
  ============================ */
  console.log("💰 [applyPayment] START", {
    invoice_id,
    amount,
    method,
    transaction_ref,
    organization_id,
    facility_id,
    user_org: user?.organization_id,
    user_fac: user?.facility_id,
  });

  /* ============================
     🧠 DEBUG: ACTIVE DATABASE
  ============================ */
  const [dbName] = await sequelize.query("select current_database()");
  console.log("🧠 [applyPayment] Connected DB:", dbName?.current_database);

  /* ============================
     🔒 LOAD + LOCK INVOICE
  ============================ */
  const invoice = await db.Invoice.findByPk(invoice_id, {
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  console.log("📄 [applyPayment] Invoice lookup:", {
    found: !!invoice,
    id: invoice?.id,
    org: invoice?.organization_id,
    fac: invoice?.facility_id,
    status: invoice?.status,
  });

  /* ============================
     🧪 RAW SQL CHECK (IF NULL)
  ============================ */
  if (!invoice) {
    const [rows] = await sequelize.query(
      `SELECT id, invoice_number, organization_id, facility_id, status
       FROM invoices
       WHERE id = :id`,
      {
        replacements: { id: invoice_id },
        transaction: t,
      }
    );

    console.log("🧪 [applyPayment] Raw SQL invoice check:", rows);
    throw new Error("❌ Invoice not found");
  }


  if (parseFloat(amount) <= 0) {
    throw new Error("❌ Payment amount must be greater than 0");
  }

  /* ============================
     💳 CREATE PAYMENT
  ============================ */
    const payment = await db.Payment.create(
      {
        invoice_id,
        organization_id: organization_id ?? invoice.organization_id,
        facility_id: facility_id ?? invoice.facility_id,
        patient_id: invoice.patient_id,

        // 🔥 FIX — ALWAYS DERIVE FROM INVOICE
        currency: invoice.currency,

        amount,
        method,
        transaction_ref,

        status: PS.COMPLETED,
        created_by_id: user?.id,
      },
      { transaction: t, user }
    );

  console.log("💳 [applyPayment] Payment created:", {
    payment_id: payment.id,
    amount: payment.amount,
    status: payment.status,
  });

  /* ============================
     📒 LEDGER ENTRY
  ============================ */
  await logLedger({
    type: "payment",
    entity: payment,
    organization_id: payment.organization_id,
    facility_id: payment.facility_id,
    patient_id: payment.patient_id,
    invoice_id,
    amount,
    method,
    note: `Payment of ${amount} via ${method}`,
    user,
    t,
  });

  /* ============================
     🔄 RECALC INVOICE
  ============================ */
  const updatedInvoice = await recalcInvoice(invoice_id, t);

  console.log("🔄 [applyPayment] Invoice recalculated:", {
    invoice_id: updatedInvoice?.id,
    balance: updatedInvoice?.balance,
    status: updatedInvoice?.status,
  });

  return { payment, invoice: updatedInvoice };
},

  async completePayment({ payment_id, user, t }) {
    if (!t) {
      throw new Error("❌ Transaction (t) is required for completePayment");
    }

    const payment = await db.Payment.findByPk(payment_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!payment) throw new Error("❌ Payment not found");

    if (payment.status !== PS.PENDING) {
      throw new Error(
        `❌ Only pending payments can be completed (current: ${payment.status})`
      );
    }

    await payment.update(
      {
        status: PS.COMPLETED,
        updated_by_id: user?.id,
      },
      { transaction: t, user }
    );

    const updatedInvoice = await recalcInvoice(payment.invoice_id, t);
    return { payment, invoice: updatedInvoice };
  },

    /* ----------------- Refunds ----------------- */

    async applyRefund({ payment_id, amount, reason, user, t }) {
      if (!t) throw new Error("❌ Transaction (t) is required for applyRefund");

      /* ================= 🔒 LOCK PAYMENT ================= */
      const payment = await db.Payment.findByPk(payment_id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!payment) throw new Error("❌ Payment not found");

      if (parseFloat(amount) <= 0) {
        throw new Error("❌ Refund amount must be greater than 0");
      }

      /* ================= 🔒 LOCK EXISTING REFUNDS ================= */
      const existingRefunds = await db.Refund.findAll({
        where: {
          payment_id,
          status: RS.PROCESSED,
        },
        attributes: ["amount"],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const alreadyRefunded = existingRefunds.reduce(
        (sum, r) => sum + Number(r.amount || 0),
        0
      );

      const remaining =
        Number(payment.amount || 0) - alreadyRefunded;

      if (Number(amount) > remaining) {
        throw new Error(
          `❌ Refund exceeds remaining refundable balance (${remaining})`
        );
      }

      /* ================= CREATE REFUND ================= */
      const refund = await db.Refund.create(
        {
          payment_id,
          invoice_id: payment.invoice_id,
          organization_id: payment.organization_id,
          facility_id: payment.facility_id,
          patient_id: payment.patient_id,
          currency: payment.currency,
          amount,
          reason,
          method: payment.method,
          status: RS.PENDING,
          created_by_id: user?.id,
        },
        { transaction: t, user }
      );

      /* ================= CREATE TRANSACTION ================= */
      await db.RefundTransaction.create(
        {
          refund_id: refund.id,
          organization_id: refund.organization_id,
          facility_id: refund.facility_id,
          patient_id: refund.patient_id,
          invoice_id: refund.invoice_id,
          amount,
          method: refund.method,
          status: RTS.PENDING,
          created_by_id: user?.id,
        },
        { transaction: t, user }
      );

      return { refund };
    },

    async approveRefund(refund_id, user) {
      return await sequelize.transaction(async (t) => {
        /* ================= 🔒 LOCK REFUND ================= */
        const refund = await db.Refund.findByPk(refund_id, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!refund) throw new Error("❌ Refund not found");

        /* ================= STATUS GUARD ================= */
        if (refund.status !== RS.PENDING) {
          throw new Error(
            `❌ Only pending refunds can be approved (current: ${refund.status})`
          );
        }

        /* ================= 🔄 LIFECYCLE ================= */
        await applyLifecycleTransition({
          entity: refund,
          action: "approved",
          nextStatus: RS.APPROVED,
          user,
          t,
        });

        await logLedger({
          type: "refund",
          entity: refund,
          organization_id: refund.organization_id,
          facility_id: refund.facility_id,
          patient_id: refund.patient_id,
          invoice_id: refund.invoice_id,
          amount: refund.amount,
          note: `Refund approved`,
          user,
          t,
        });
        /* ================= 🧾 TRANSACTION LOG ================= */
        await db.RefundTransaction.create(
          {
            refund_id: refund.id,
            organization_id: refund.organization_id,
            facility_id: refund.facility_id,
            patient_id: refund.patient_id,
            invoice_id: refund.invoice_id,
            amount: refund.amount,
            status: RTS.APPROVED,
            approved_by_id: user?.id,
            approved_at: new Date(),
          },
          { transaction: t, user }
        );

        /* ================= 🔄 INVOICE RECALC (CRITICAL FIX) ================= */
        const invoice = await recalcInvoice(refund.invoice_id, t);

        /* ================= RETURN ================= */
        return { refund, invoice };
      });
    },

    async rejectRefund(refund_id, reason, user) {
      return await sequelize.transaction(async (t) => {
        const refund = await db.Refund.findByPk(refund_id, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!refund) throw new Error("❌ Refund not found");

        if (refund.status !== RS.PENDING) {
          throw new Error(
            `❌ Only pending refunds can be rejected (current: ${refund.status})`
          );
        }

        if (!reason) throw new Error("❌ Reason required to reject refund");

        await applyLifecycleTransition({
          entity: refund,
          action: "rejected",
          nextStatus: RS.REJECTED,
          user,
          reason,
          t,
        });

        await db.RefundTransaction.create(
          {
            refund_id: refund.id,
            organization_id: refund.organization_id,
            facility_id: refund.facility_id,
            patient_id: refund.patient_id,
            invoice_id: refund.invoice_id,
            amount: refund.amount,
            status: RTS.REJECTED,
            rejected_by_id: user?.id,
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
        const refund = await db.Refund.findByPk(refund_id, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!refund) throw new Error("❌ Refund not found");

        if (refund.status !== RS.APPROVED) {
          throw new Error("❌ Refund must be approved before processing");
        }

        await applyLifecycleTransition({
          entity: refund,
          action: "processed",
          nextStatus: RS.PROCESSED,
          user,
          t,
        });

        await db.RefundTransaction.create(
          {
            refund_id: refund.id,
            organization_id: refund.organization_id,
            facility_id: refund.facility_id,
            patient_id: refund.patient_id,
            invoice_id: refund.invoice_id,
            amount: refund.amount,
            status: RTS.PROCESSED,
            processed_by_id: user?.id,
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
          note: `Processed refund of ${refund.amount} · ${refund.reason}`,
          user,
          t,
        });

        const invoice = await recalcInvoice(refund.invoice_id, t);
        return { refund, invoice };
      });
    },

    async cancelRefund(refund_id, reason, user) {
      return await sequelize.transaction(async (t) => {
        const refund = await db.Refund.findByPk(refund_id, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!refund) throw new Error("❌ Refund not found");

        if (![RS.PENDING, RS.APPROVED].includes(refund.status)) {
          throw new Error(
            `❌ Only pending or approved refunds can be cancelled (current: ${refund.status})`
          );
        }

        if (!reason) throw new Error("❌ Reason required to cancel refund");

        await applyLifecycleTransition({
          entity: refund,
          action: "cancelled",
          nextStatus: RS.CANCELLED,
          user,
          reason,
          t,
        });

        await db.RefundTransaction.create(
          {
            refund_id: refund.id,
            organization_id: refund.organization_id,
            facility_id: refund.facility_id,
            patient_id: refund.patient_id,
            invoice_id: refund.invoice_id,
            amount: refund.amount,
            status: RTS.CANCELLED,
            cancelled_by_id: user?.id,
            cancelled_at: new Date(),
          },
          { transaction: t, user }
        );

        return { refund };
      });
    },
    async reverseRefund(refund_id, user) {
      return await sequelize.transaction(async (t) => {
        const refund = await db.Refund.findByPk(refund_id, {
          transaction: t,
          lock: t.LOCK.UPDATE, // 🔥 LOCK ADDED
          paranoid: false,
        });
        if (!refund) throw new Error("❌ Refund not found");

        if (refund.status !== RS.PROCESSED) {
          throw new Error(
            `❌ Only processed refunds can be reversed (current: ${refund.status})`
          );
        }

        await applyLifecycleTransition({
          entity: refund,
          action: "reversed",
          nextStatus: RS.REVERSED,
          user,
          reason: "Reversal of processed refund",
          t,
        });

        await db.RefundTransaction.create(
          {
            refund_id: refund.id,
            organization_id: refund.organization_id,
            facility_id: refund.facility_id,
            patient_id: refund.patient_id,
            invoice_id: refund.invoice_id,
            amount: refund.amount,
            status: RTS.REVERSED,
            reversed_by_id: user?.id,
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
          note: `Refund reversed (ID: ${refund.id})`,
          user,
          t,
        });

        const invoice = await recalcInvoice(refund.invoice_id, t);
        return { refund, invoice, message: "✅ Refund reversed" };
      });
    },

    async voidRefund(refund_id, reason, user) {
      return await sequelize.transaction(async (t) => {
        /* ================= 🔒 LOCK REFUND ================= */
        const refund = await db.Refund.findByPk(refund_id, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!refund) throw new Error("❌ Refund not found");

        /* ================= STATUS GUARD ================= */
        if ([RS.PROCESSED, RS.REVERSED].includes(refund.status)) {
          throw new Error("❌ Processed or reversed refunds cannot be voided");
        }

        /* ================= 🔄 LIFECYCLE ================= */
        await applyLifecycleTransition({
          entity: refund,
          action: "voided",
          nextStatus: RS.VOIDED,
          user,
          reason,
          t,
        });

        /* ================= 🧾 TRANSACTION LOG (ADDED FIX) ================= */
        await db.RefundTransaction.create(
          {
            refund_id: refund.id,
            organization_id: refund.organization_id,
            facility_id: refund.facility_id,
            patient_id: refund.patient_id,
            invoice_id: refund.invoice_id,
            amount: refund.amount,
            status: RTS.VOIDED,
            voided_by_id: user?.id,
            voided_at: new Date(),
          },
          { transaction: t, user }
        );

        /* ================= 📒 LEDGER REVERSAL ================= */
        await logLedger({
          type: "reversal",
          entity: refund,
          organization_id: refund.organization_id,
          facility_id: refund.facility_id,
          patient_id: refund.patient_id,
          invoice_id: refund.invoice_id,
          amount: -Math.abs(refund.amount),
          note: `Refund voided · ${reason || "no reason"}`,
          user,
          t,
        });

        /* ================= 🔄 RECALC INVOICE ================= */
        const invoice = await recalcInvoice(refund.invoice_id, t);

        return { refund, invoice };
      });
    },
    async restoreRefund(refund_id, user) {
      return await sequelize.transaction(async (t) => {
        /* ================= 🔒 LOCK (PARANOID SAFE) ================= */
        const refund = await db.Refund.findOne({
          where: { id: refund_id },
          transaction: t,
          lock: t.LOCK.UPDATE,
          paranoid: false,
        });
        if (!refund) throw new Error("❌ Refund not found");

        /* ================= ♻️ RESTORE SOFT DELETE ================= */
        if (refund.deleted_at) {
          await refund.restore({ transaction: t });
        }

        /* ================= DETERMINE NEXT STATUS ================= */
        const nextStatus =
          [RS.VOIDED, RS.REVERSED].includes(refund.status)
            ? RS.PENDING
            : refund.status;

        /* ================= 🔄 LIFECYCLE ================= */
        await applyLifecycleTransition({
          entity: refund,
          action: "restored",
          nextStatus,
          user,
          t,
        });

        /* ================= 🧾 TRANSACTION LOG (ADDED FIX) ================= */
        await db.RefundTransaction.create(
          {
            refund_id: refund.id,
            organization_id: refund.organization_id,
            facility_id: refund.facility_id,
            patient_id: refund.patient_id,
            invoice_id: refund.invoice_id,
            amount: refund.amount,
            status: RTS.PENDING,
            created_by_id: user?.id,
          },
          { transaction: t, user }
        );

        /* ================= 🔄 RECALC (IMPORTANT) ================= */
        const invoice = await recalcInvoice(refund.invoice_id, t);

        return { refund, invoice };
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
      currency, // 🔥 ADDED (allow standalone deposits)
      user,
      t,
    }) {
      if (parseFloat(amount) <= 0) {
        throw new Error("❌ Deposit amount must be greater than 0");
      }

      let appliedAmt = 0;
      let remaining = parseFloat(amount) || 0;

      // 🔥 LOAD INVOICE (OPTIONAL — MASTER SAFE)
      let invoice = null;

      if (invoice_id) {
        invoice = await db.Invoice.findByPk(invoice_id, { transaction: t });
        if (!invoice) throw new Error("❌ Invoice not found");

        const invoiceBalance = parseFloat(invoice.balance) || 0;
        appliedAmt = Math.min(invoiceBalance, remaining);
        remaining -= appliedAmt;
      }

      /* ============================================================
        🔥 RESOLVE CURRENCY (FIXED — SUPPORT BOTH CASES)
      ============================================================ */
      let resolvedCurrency;

      if (invoice?.currency) {
        // ✅ Case 1: Deposit tied to invoice
        resolvedCurrency = invoice.currency;
      } else {
        // ✅ Case 2: Standalone deposit
        if (!currency) {
          throw new Error("❌ Currency is required when no invoice is provided");
        }
        resolvedCurrency = currency;
      }

      const deposit = await db.Deposit.create(
        {
          patient_id,
          organization_id,
          facility_id,
          applied_invoice_id: invoice_id || null,

          currency: resolvedCurrency, // ✅ ALWAYS SET

          amount,
          method,
          transaction_ref,
          notes,
          reason,

          status: invoice_id
            ? remaining <= 0
              ? DS.APPLIED
              : DS.CLEARED
            : DS.PENDING,

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
    /* ----------------- Finalize Deposit ----------------- */
    async finalizeDeposit({ deposit_id, invoice_id = null, user, t }) {
      const useTx = t || await sequelize.transaction();
      let committedHere = false;

      try {
        const deposit = await db.Deposit.findByPk(deposit_id, { transaction: useTx });
        if (!deposit) throw new Error("❌ Deposit not found");

        if (![DS.PENDING, DS.CLEARED].includes(deposit.status)) {
          throw new Error("❌ Only pending/cleared deposits can be finalized");
        }

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
            transaction: useTx,
          });
          if (openInvoice) targetInvoiceId = openInvoice.id;
        }

        let appliedAmt = 0;
        let remaining = parseFloat(deposit.amount) || 0;

        if (targetInvoiceId) {
          const invoice = await db.Invoice.findByPk(targetInvoiceId, { transaction: useTx });
          if (!invoice) throw new Error("❌ Invoice not found");

          const invoiceBalance = parseFloat(invoice.balance) || 0;
          appliedAmt = Math.min(invoiceBalance, remaining);
          remaining -= appliedAmt;
        }

        await deposit.update(
          {
            status: remaining <= 0 ? DS.APPLIED : DS.CLEARED,
            applied_invoice_id: targetInvoiceId,
            applied_amount: appliedAmt.toFixed(2),
            remaining_balance: remaining.toFixed(2),
            updated_by_id: user?.id,
          },
          { transaction: useTx, user }
        );

        if (targetInvoiceId) {
          await recalcInvoice(targetInvoiceId, useTx);
        }

        if (!t) {
          await useTx.commit();
          committedHere = true;
        }

        return { deposit, invoice_id: targetInvoiceId };
      } catch (err) {
        if (!t && !committedHere) await useTx.rollback();
        throw err;
      }
    },

    /* ----------------- Clear Deposit (LIFECYCLE) ----------------- */
    async clearDeposit({ deposit_id, user }) {
      return await sequelize.transaction(async (t) => {
        const deposit = await db.Deposit.findByPk(deposit_id, { transaction: t });
        if (!deposit) throw new Error("❌ Deposit not found");

        if (deposit.status !== DS.PENDING) {
          throw new Error("❌ Only pending deposits can be cleared");
        }

        await applyLifecycleTransition({
          entity: deposit,
          action: "processed",
          nextStatus: DS.CLEARED,
          user,
          t,
        });

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
        await applyLifecycleTransition({
          entity: deposit,
          action: "processed",
          nextStatus: DS.CLEARED,
          user,
          t,
        });
        newStatus = DS.CLEARED;

      } else if (deposit.status === DS.CLEARED) {
        const { deposit: finalized } = await this.finalizeDeposit({
          deposit_id,
          user,
          t,
        });
        newStatus = finalized.status;

      } else if (deposit.status === DS.APPLIED) {
        throw new Error("❌ Applied deposits cannot be toggled back");
      }

      return { deposit, newStatus };
    },

    /* ----------------- Apply Deposit to Invoice ----------------- */
    async applyDepositToInvoice({ deposit_id, invoice_id, amount, user }) {
      return await sequelize.transaction(async (t) => {
        const deposit = await db.Deposit.findByPk(deposit_id, { transaction: t });
        if (!deposit) throw new Error("❌ Deposit not found");

        if (![DS.CLEARED, DS.APPLIED].includes(deposit.status)) {
          throw new Error("❌ Only cleared or applied deposits can be used");
        }

        const invoice = await db.Invoice.findByPk(invoice_id, { transaction: t });
        if (!invoice) throw new Error("❌ Invoice not found");

        const remainingDeposit = parseFloat(deposit.remaining_balance) || 0;
        const invoiceBalance = parseFloat(invoice.balance ?? invoice.total ?? 0);
        const applyAmt = Math.min(
          parseFloat(amount),
          remainingDeposit,
          invoiceBalance
        );

        if (applyAmt <= 0) {
          throw new Error("❌ Invalid or exhausted deposit/invoice balance");
        }

        const application = await db.DepositApplication.create(
          {
            deposit_id,
            invoice_id,
            applied_amount: applyAmt.toFixed(2),
            applied_by_id: user?.id || null,
          },
          { transaction: t, user }
        );

        const newApplied = (parseFloat(deposit.applied_amount) || 0) + applyAmt;
        const newRemaining = Math.max(
          0,
          (parseFloat(deposit.amount) || 0) - newApplied
        );

        const newStatus = newRemaining <= 0 ? DS.APPLIED : DS.CLEARED;

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

        invoice.balance = Math.max(0, invoiceBalance - applyAmt).toFixed(2);
        invoice.status = invoice.balance <= 0 ? IS.PAID : IS.PARTIAL;
        invoice.updated_by_id = user?.id || null;
        await invoice.save({ transaction: t, user });

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

        const updatedInvoice = await recalcInvoice(invoice_id, t);

        return { application, deposit, invoice: updatedInvoice };
      });
    },

    /* ----------------- Verify Deposit (LIFECYCLE) ----------------- */
    async verifyDeposit({ deposit_id, user }) {
      return await sequelize.transaction(async (t) => {
        const deposit = await db.Deposit.findByPk(deposit_id, { transaction: t });
        if (!deposit) throw new Error("❌ Deposit not found");

        if (![DS.CLEARED, DS.APPLIED].includes(deposit.status)) {
          throw new Error("❌ Only cleared/applied deposits can be verified");
        }

        await applyLifecycleTransition({
          entity: deposit,
          action: "verified",
          nextStatus: DS.VERIFIED,
          user,
          t,
        });

        await logLedger({
          type: "deposit",
          entity: deposit,
          organization_id: deposit.organization_id,
          facility_id: deposit.facility_id,
          patient_id: deposit.patient_id,
          invoice_id: deposit.applied_invoice_id,
          amount: deposit.amount,
          note: `Deposit verified`,
          user,
          t,
        });

        return { deposit };
      });
    },

    /* ----------------- Void Deposit ----------------- */
    async voidDeposit({ deposit_id, reason, user }) {
      return await sequelize.transaction(async (t) => {
        const deposit = await db.Deposit.findByPk(deposit_id, { transaction: t });
        if (!deposit) throw new Error("❌ Deposit not found");

        if ([DS.VERIFIED, DS.REVERSED, DS.VOIDED].includes(deposit.status)) {
          throw new Error("❌ Verified, reversed, or voided deposits cannot be voided");
        }

        await this.reverseTransaction({
          type: "deposit",
          id: deposit_id,
          user,
          reason: reason || "Deposit voided",
        });

        await applyLifecycleTransition({
          entity: deposit,
          action: "voided",
          nextStatus: DS.VOIDED,
          user,
          reason,
          t,
        });

        return { deposit };
      });
    },

    /* ============================================================
   💸 Discount Waivers — Enterprise MASTER Parity (FINAL)
    ============================================================ */

    /* ----------------- createWaiver ----------------- */
    async createWaiver({
      invoice_id,
      type,
      percentage,
      amount,
      reason,
      user,
    }) {
      return await sequelize.transaction(async (t) => {
        const invoice = await db.Invoice.findByPk(invoice_id, { transaction: t });
        if (!invoice) throw new Error("❌ Invoice not found");
        const status = (invoice.status || "").toLowerCase();

        if ([
          IS.PAID.toLowerCase(),
          IS.CANCELLED.toLowerCase(),
          IS.VOIDED.toLowerCase()
        ].includes(status)) {
          throw new Error(`❌ Cannot request waiver on ${invoice.status} invoice`);
        }
        if (!["percentage", "fixed"].includes(type)) {
          throw new Error("❌ Invalid waiver type");
        }

        // 🔥 SOURCE OF TRUTH (DERIVED)
        const patient_id = invoice.patient_id;
        const organization_id = invoice.organization_id;
        const facility_id = invoice.facility_id;

        // 🧮 Preview amount (NOT applied yet)
        const baseTotal = parseFloat(invoice.total) || 0;
        let previewAmount =
          type === "fixed"
            ? parseFloat(amount) || 0
            : (baseTotal * (parseFloat(percentage) || 0)) / 100;

        previewAmount = Math.min(
          previewAmount,
          parseFloat(invoice.balance || 0)
        );

        const waiver = await db.DiscountWaiver.create(
          {
            invoice_id,
            patient_id,
            organization_id,
            facility_id,
            type,
            percentage: type === "percentage" ? percentage : null,
            amount: type === "fixed" ? amount : null,
            applied_total: 0,
            reason,
            status: WS.PENDING,
            created_by_id: user?.id,
          },
          { transaction: t, user }
        );

        return waiver;
      });
    },

    /* ----------------- updateWaiver ----------------- */
    async updateWaiver({ id, payload, user }) {
      return await sequelize.transaction(async (t) => {
        const waiver = await db.DiscountWaiver.findByPk(id, { transaction: t });
        if (!waiver) throw new Error("❌ Waiver not found");

        // 🔒 HARD LOCK
        if ([WS.APPLIED, WS.VOIDED, WS.FINALIZED].includes(waiver.status)) {
          throw new Error("❌ Finalized / applied / voided waivers cannot be edited");
        }

        const updateData = {
          updated_by_id: user?.id,
        };

        if (payload.reason !== undefined) updateData.reason = payload.reason;

        if (payload.type) {
          if (!["percentage", "fixed"].includes(payload.type)) {
            throw new Error("❌ Invalid waiver type");
          }

          updateData.type = payload.type;
          updateData.percentage =
            payload.type === "percentage" ? payload.percentage : null;
          updateData.amount =
            payload.type === "fixed" ? payload.amount : null;
        }

        await waiver.update(updateData, { transaction: t, user });
        return waiver;
      });
    },

    /* ----------------- approveWaiver ----------------- */
    async approveWaiver({ id, user }) {
      return await sequelize.transaction(async (t) => {
        const waiver = await db.DiscountWaiver.findByPk(id, { transaction: t });
        if (!waiver) throw new Error("❌ Waiver not found");

        if (waiver.status !== WS.PENDING) {
          throw new Error("❌ Only pending waivers can be approved");
        }

        await waiver.update(
          {
            status: WS.APPROVED,
            approved_by_id: user?.id,
            approved_at: new Date(),
            updated_by_id: user?.id,
          },
          { transaction: t, user }
        );

        return waiver;
      });
    },

    /* ----------------- rejectWaiver ----------------- */
    async rejectWaiver({ id, reason, user }) {
      return await sequelize.transaction(async (t) => {
        const waiver = await db.DiscountWaiver.findByPk(id, { transaction: t });
        if (!waiver) throw new Error("❌ Waiver not found");

        if (waiver.status !== WS.PENDING) {
          throw new Error("❌ Only pending waivers can be rejected");
        }

        if (!reason || !String(reason).trim()) {
          throw new Error("❌ Rejection reason is required");
        }

        await waiver.update(
          {
            status: WS.REJECTED,
            reason,
            rejected_by_id: user?.id,
            rejected_at: new Date(),
            updated_by_id: user?.id,
          },
          { transaction: t, user }
        );

        return waiver;
      });
    },
    /* ----------------- voidWaiver ----------------- */
    async voidWaiver({ id, reason, user }) {
      return await sequelize.transaction(async (t) => {
        const waiver = await db.DiscountWaiver.findByPk(id, { transaction: t });
        if (!waiver) throw new Error("❌ Waiver not found");

        if (waiver.status === WS.VOIDED) {
          throw new Error("❌ Waiver already voided");
        }

        if (!reason || !String(reason).trim()) {
          throw new Error("❌ Void reason is required");
        }

        // 🔁 Delegate to unified reversal logic
        await this.reverseTransaction({
          type: "waiver",
          id,
          user,
          reason,
        });

        return await db.DiscountWaiver.findByPk(id, { transaction: t });
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
        if (!invoice) throw new Error("❌ Invoice not found");

        const baseTotal = parseFloat(invoice.total) || 0;
        let applyAmount =
          waiver.type === "fixed"
            ? parseFloat(waiver.amount) || 0
            : (baseTotal * (parseFloat(waiver.percentage) || 0)) / 100;

        applyAmount = Math.min(
          applyAmount,
          parseFloat(invoice.balance || 0)
        );

        await waiver.update(
          {
            status: WS.APPLIED,
            applied_total: applyAmount.toFixed(2),
            finalized_by_id: user?.id,
            finalized_at: new Date(),
            updated_by_id: user?.id,
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
          amount: applyAmount,
          note: `Waiver applied (${waiver.type})`,
          user,
          t,
        });

        const updatedInvoice = await recalcInvoice(waiver.invoice_id, t);
        return { waiver, invoice: updatedInvoice };
      });
    },
    /* ----------------- restoreWaiver ----------------- */
    async restoreWaiver({ id, user }) {
      return await sequelize.transaction(async (t) => {
        const waiver = await db.DiscountWaiver.findByPk(id, { transaction: t });
        if (!waiver) throw new Error("❌ Waiver not found");

        if (waiver.status !== WS.VOIDED) {
          throw new Error("❌ Only voided waivers can be restored");
        }

        // 🔄 Restore to last valid lifecycle state
        // MASTER rule: voided → approved (not applied)
        await waiver.update(
          {
            status: WS.APPROVED,
            applied_total: 0,
            updated_by_id: user?.id,
          },
          { transaction: t, user }
        );

        // 🔁 Recalculate invoice to ensure balance correctness
        await recalcInvoice(waiver.invoice_id, t);

        return waiver;
      });
    },

    /* ----------------- reverseTransaction (waiver only) ----------------- */
    async reverseTransaction({ type, id, user, reason = null }) {
      return await sequelize.transaction(async (t) => {

        /* =========================
          🔁 WAIVER REVERSAL
        ========================= */
        if (type === "waiver") {
          const waiver = await db.DiscountWaiver.findByPk(id, { transaction: t });
          if (!waiver) throw new Error("❌ Waiver not found");

          const amount = Math.abs(parseFloat(waiver.applied_total) || 0);

          await waiver.update(
            {
              status: WS.VOIDED,
              applied_total: 0,
              updated_by_id: user?.id,
            },
            { transaction: t, user }
          );

          await logLedger({
            type: "reversal",
            entity: waiver,
            organization_id: waiver.organization_id,
            facility_id: waiver.facility_id,
            patient_id: waiver.patient_id,
            invoice_id: waiver.invoice_id,
            amount,
            note: `Reversal of waiver${reason ? ` · ${reason}` : ""}`,
            user,
            t,
          });

          await recalcInvoice(waiver.invoice_id, t);
          return { success: true };
        }

        /* =========================
          🔁 DEPOSIT REVERSAL (FIX)
        ========================= */
        if (type === "deposit") {
          const deposit = await db.Deposit.findByPk(id, { transaction: t });
          if (!deposit) throw new Error("❌ Deposit not found");

          await logLedger({
            type: "reversal",
            entity: deposit,
            organization_id: deposit.organization_id,
            facility_id: deposit.facility_id,
            patient_id: deposit.patient_id,
            invoice_id: deposit.applied_invoice_id,
            amount: -Math.abs(deposit.amount),
            note: `Deposit reversal${reason ? ` · ${reason}` : ""}`,
            user,
            t,
          });
            await applyLifecycleTransition({
              entity: deposit,
              action: "reversed",
              nextStatus: DS.REVERSED,
              user,
              t,
            });

          return { success: true };
        }

        throw new Error("❌ Unsupported reversal type");
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

        /* ============================================================
          🔐 LEDGER-DERIVED TENANT RESOLUTION (MASTER)
        ============================================================ */
        let orgId = organization_id || null;
        let facId = facility_id || null;
        let patientId = null;

        let invoice = null;
        if (invoice_id) {
          invoice = await db.Invoice.findByPk(invoice_id, {
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if (!invoice) throw new Error("❌ Invoice not found");
          const status = (invoice.status || "").toLowerCase();

          // ❌ BLOCK ONLY FINAL STATES (MATCH PAYMENT LOGIC)
          if ([
            IS.PAID.toLowerCase(),
            IS.CANCELLED.toLowerCase(),
            IS.VOIDED.toLowerCase()
          ].includes(status)) {
            throw new Error(`❌ Cannot apply discount to ${invoice.status} invoice`);
          }
          // 🔥 INHERIT FROM INVOICE (SOURCE OF TRUTH)
          orgId = invoice.organization_id;
          facId = invoice.facility_id;
          patientId = invoice.patient_id;
        }

        // 🛡️ Fallback (non-ledger / superadmin edge cases)
        if (!orgId) orgId = user.organization_id;
        if (!facId && Array.isArray(user.facility_ids)) {
          facId = user.facility_ids[0];
        }

        // 🚨 HARD GUARARDS
        if (!orgId) throw new Error("❌ Discount organization unresolved");
        if (!facId) throw new Error("❌ Discount facility unresolved");

        /* ============================================================
          🧮 GUARDS
        ============================================================ */
        if (type === "percentage" && value > 100) {
          throw new Error("❌ Percentage discount cannot exceed 100%");
        }

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

        /* ============================================================
          ✅ CREATE DISCOUNT
        ============================================================ */
        const discount = await db.Discount.create(
          {
            invoice_id: invoice_id || null,
            invoice_item_id: invoice_item_id || null,
            discount_policy_id: discount_policy_id || null,
            organization_id: orgId,
            facility_id: facId,
            patient_id: patientId,
            type,
            value,
            reason,
            name: name || (invoice_item_id ? "Item discount" : "Invoice discount"),
            status: DSC.DRAFT,
            created_by_id: user?.id,
          },
          { transaction: t, user }
        );

        /* ============================================================
          📒 LEDGER + RECALC
        ============================================================ */
        if (invoice_id) {
          await recalcInvoice(invoice_id, t);

          await logLedger({
            type: "discount",
            entity: discount,
            organization_id: orgId,
            facility_id: facId,
            patient_id: patientId,
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
      🏁 Finalize Discount (FIXED — INSURANCE SAFE)
    ============================================================ */
    async finalizeDiscount({ id, user }) {
      return await sequelize.transaction(async (t) => {
        const discount = await db.Discount.findByPk(id, { transaction: t });
        if (!discount) throw new Error("❌ Discount not found");

        if (discount.status !== DSC.ACTIVE) {
          throw new Error("❌ Only active discounts can be finalized");
        }

        /* ============================================================
          🔥 LOAD INVOICE
        ============================================================ */
        const invoice = await db.Invoice.findByPk(discount.invoice_id, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!invoice) throw new Error("❌ Invoice not found");

        /* ============================================================
          🧮 USE PATIENT BALANCE AS BASE (CRITICAL FIX)
        ============================================================ */
        const patientBalance = parseFloat(invoice.balance || 0);

        let applied = 0;

        if (discount.type === "percentage") {
          applied = patientBalance * (parseFloat(discount.value) / 100);
        } else {
          applied = parseFloat(discount.value);
        }

        /* ============================================================
          🔒 HARD CAP (NEVER EXCEED BALANCE)
        ============================================================ */
        if (applied > patientBalance) {
          applied = patientBalance;
        }

        /* ============================================================
          💾 STORE CORRECT VALUE (OVERRIDE MODEL)
        ============================================================ */
        await discount.update(
          {
            status: DSC.FINALIZED,
            applied_amount: applied.toFixed(2),
            finalized_by_id: user?.id,
            finalized_at: new Date(),
          },
          { transaction: t, user }
        );

        /* ============================================================
          🔄 RECALCULATE INVOICE
        ============================================================ */
        await recalcInvoice(invoice.id, t);

        /* ============================================================
          📒 LEDGER
        ============================================================ */
        await logLedger({
          type: "discount",
          entity: discount,
          organization_id: discount.organization_id,
          facility_id: discount.facility_id,
          patient_id: discount.patient_id,
          invoice_id: invoice.id,
          amount: applied,
          note: `Discount finalized (PATIENT ONLY): ${discount.type} ${discount.value}${discount.type === "percentage" ? "%" : ""}`,
          user,
          t,
        });

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
    💸 EXPENSES (ENTERPRISE MASTER – FINAL)
  ============================================================ */

  /* ----------------- Create Expense ----------------- */
  async createExpense({
    date,
    amount,
    currency,
    category,
    account_id,
    description,
    organization_id,
    facility_id,
    user,
  }) {
    return await sequelize.transaction(async (t) => {

      /* ================= GLOBAL SAFETY ================= */
      if (!user?.organization_id) {
        throw new Error("❌ User organization context missing");
      }

      if (!date || !amount || !currency || !category || !account_id) {
        throw new Error("❌ Missing required expense fields");
      }

      if (parseFloat(amount) <= 0) {
        throw new Error("❌ Expense amount must be greater than 0");
      }

      /* ================= CREATE ================= */
      const expense = await db.Expense.create(
        {
          date,
          amount,
          currency,
          category,
          account_id,
          description,
          organization_id,
          facility_id,
          created_by_id: user?.id,
        },
        { transaction: t, user }
      );

      /* ================= LEDGER (CRITICAL) ================= */
      await logLedger({
        type: "expense",
        entity: expense,
        organization_id,
        facility_id,
        account_id, // 🔥 FIXED
        amount,
        method: null,
        note: `Expense: ${category}${description ? ` · ${description}` : ""}`,
        user,
        t,
      });

      return expense;
    });
  },

  /* ============================================================
    🔁 TRANSFERS (ENTERPRISE MASTER – FINAL)
  ============================================================ */
  async applyTransfer({
    from_account_id,
    to_account_id,
    amount,
    user,
    organization_id,
    facility_id,
    t,
  }) {
    if (!t) throw new Error("❌ Transaction (t) is required");

    if (!user?.organization_id) {
      throw new Error("❌ User organization context missing");
    }

    if (parseFloat(amount) <= 0) {
      throw new Error("❌ Amount must be > 0");
    }

    if (!from_account_id || !to_account_id) {
      throw new Error("❌ Both source and destination accounts are required");
    }

    const currency = user?.currency || "USD";

    /* ================= OUT (DEBIT) ================= */
    await logLedger({
      type: "transfer", // ✅ FIXED
      entity: { id: null },
      organization_id,
      facility_id,
      account_id: from_account_id, // 🔥 CRITICAL
      amount: -Math.abs(amount),
      note: `Transfer OUT → account ${from_account_id}`,
      user,
      t,
    });

    /* ================= IN (CREDIT) ================= */
    await logLedger({
      type: "transfer", // ✅ FIXED
      entity: { id: null },
      organization_id,
      facility_id,
      account_id: to_account_id, // 🔥 CRITICAL
      amount: Math.abs(amount),
      note: `Transfer IN → account ${to_account_id}`,
      user,
      t,
    });

    /* ================= CASH LEDGER (OPTIONAL VIEW) ================= */
    await db.CashLedger.create({
      date: new Date(),
      type: LEDGER_TYPES.TRANSFER,
      direction: LEDGER_DIRECTIONS.OUT,
      account_id: from_account_id,
      amount,
      currency,
      organization_id,
      facility_id,
      created_by_id: user?.id,
    }, { transaction: t });

    await db.CashLedger.create({
      date: new Date(),
      type: LEDGER_TYPES.TRANSFER,
      direction: LEDGER_DIRECTIONS.IN,
      account_id: to_account_id,
      amount,
      currency,
      organization_id,
      facility_id,
      created_by_id: user?.id,
    }, { transaction: t });

    return { success: true };
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
