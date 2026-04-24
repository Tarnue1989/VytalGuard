// 📁 backend/src/services/refundDepositService.js
// ============================================================================
// ⭐ ENTERPRISE-GRADE DEPOSIT REFUND SERVICE (LIFECYCLE + AUDIT SAFE)
// Lifecycle:
// pending → review → approved → processed → reversed
//            ↘ rejected
//            ↘ cancelled
// voided → restored
// ============================================================================
import db from "../models/index.js";
import {
  sequelize,
  RefundDeposit,
  Deposit,
  RefundDepositTransaction,
} from "../models/index.js";
import { LEDGER_TYPES, LEDGER_DIRECTIONS } from "../constants/enums.js";
import { DEPOSIT_REFUND_STATUS as RS } from "../constants/enums.js";
import { applyLifecycleTransition } from "../utils/lifecycleUtil.js";
import { financialService } from "./financialService.js";

export const refundDepositService = {

    /* =========================================================================
      1️⃣ CREATE (→ PENDING) — FIXED (NO TENANT FILTER BUG)
      ========================================================================= */
    async createRefund({ deposit_id, amount, method, reason, user, t }) {

      /* ============================================================
        🔍 FETCH DEPOSIT (NO TENANT FILTER — TRUST CONTROLLER)
      ============================================================ */
      const deposit = await Deposit.findByPk(deposit_id, {
        transaction: t,
      });

      if (!deposit) {
        throw new Error("Deposit not found");
      }

      /* ============================================================
        💰 VALIDATIONS
      ============================================================ */
      const balance = Number(deposit.remaining_balance ?? 0);
      const refundAmount = Number(amount);

      if (refundAmount <= 0) {
        throw new Error("Refund amount must be greater than zero");
      }

      if (refundAmount > balance) {
        throw new Error(`Refund amount exceeds available balance (${balance})`);
      }

      /* ============================================================
        🧾 CREATE REFUND
      ============================================================ */
      const refund = await RefundDeposit.create(
        {
          deposit_id,
          patient_id: deposit.patient_id,
          organization_id: deposit.organization_id,
          facility_id: deposit.facility_id,
          refund_amount: refundAmount,
          method,
          reason,
          status: RS.PENDING,
          created_by_id: user.id,
        },
        { transaction: t, user }
      );

      /* ============================================================
        🔁 LIFECYCLE + AUDIT
      ============================================================ */
      await applyLifecycleTransition({
        entity: refund,
        action: "created",
        nextStatus: RS.PENDING,
        user,
        reason,
        t,
      });

      return { refund };
    },
  /* =========================================================================
     2️⃣ REVIEW (PENDING → REVIEW)
     ========================================================================= */
  async reviewRefund(refund_id, user) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (refund.status !== RS.PENDING)
        throw new Error("Only pending refunds may be moved to review");

      await applyLifecycleTransition({
        entity: refund,
        action: "reviewed",
        nextStatus: RS.REVIEW,
        user,
        t,
      });

      return { refund };
    });
  },

  /* =========================================================================
     3️⃣ APPROVE (PENDING / REVIEW → APPROVED)
     ========================================================================= */
  async approveRefund({ refund_id, user }) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (![RS.PENDING, RS.REVIEW].includes(refund.status))
        throw new Error("Only pending or review refunds can be approved");

      await applyLifecycleTransition({
        entity: refund,
        action: "approved",
        nextStatus: RS.APPROVED,
        user,
        t,
      });

      return { refund };
    });
  },

  /* =========================================================================
     4️⃣ PROCESS (APPROVED → PROCESSED)
     ========================================================================= */
  async processRefund({ refund_id, user }) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (refund.status !== RS.APPROVED)
        throw new Error("Only approved refunds may be processed");

      const deposit = await Deposit.findByPk(refund.deposit_id, { transaction: t });
      if (!deposit) throw new Error("Linked deposit not found");

      const balance = Number(deposit.remaining_balance ?? 0);
      const refundAmount = Number(refund.refund_amount);

      if (refundAmount > balance)
        throw new Error(`Refund amount exceeds available balance (${balance})`);

      // 🔹 update deposit balances
      deposit.remaining_balance = balance - refundAmount;
      deposit.refund_amount =
        Number(deposit.refund_amount ?? 0) + refundAmount;

      await deposit.save({ transaction: t, user });

      await financialService.logLedger({
        type: "refund",
        entity: refund,
        organization_id: refund.organization_id,
        facility_id: refund.facility_id,
        account_id: deposit.account_id,
        patient_id: refund.patient_id,
        invoice_id: deposit.applied_invoice_id,
        amount: refundAmount,
        note: "Deposit refund",
        user,
        t,
      });
      
      await db.CashLedger.create(
      {
        date: new Date().toISOString().slice(0, 10),

      type: LEDGER_TYPES.REFUND,
      direction: LEDGER_DIRECTIONS.OUT,

        account_id: deposit.account_id,
        amount: refundAmount,
        currency: deposit.currency,

        reference_type: "refund_deposit",
        reference_id: refund.id,

        organization_id: refund.organization_id,
        facility_id: refund.facility_id,
        created_by_id: user.id,
      },
      { transaction: t }
      );
      // 🔹 ledger transaction
      await RefundDepositTransaction.create(
        {
          refund_deposit_id: refund.id,
          deposit_id: refund.deposit_id,
          amount: refundAmount,
          method: refund.method,
          patient_id: refund.patient_id,
          organization_id: refund.organization_id,
          facility_id: refund.facility_id,
          status: "processed",
          created_by_id: user.id,
        },
        { transaction: t, user }
      );

      await applyLifecycleTransition({
        entity: refund,
        action: "processed",
        nextStatus: RS.PROCESSED,
        user,
        t,
      });

      return { refund, deposit };
    });
  },

  /* =========================================================================
     5️⃣ REJECT (PENDING / REVIEW → REJECTED)
     ========================================================================= */
  async rejectRefund(refund_id, user, reason) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (![RS.PENDING, RS.REVIEW].includes(refund.status))
        throw new Error("Only pending or review refunds can be rejected");

      await applyLifecycleTransition({
        entity: refund,
        action: "rejected",
        nextStatus: RS.REJECTED,
        user,
        reason,
        t,
      });

      return { refund };
    });
  },

  /* =========================================================================
     6️⃣ CANCEL (PENDING / APPROVED → CANCELLED)
     ========================================================================= */
  async cancelRefund(refund_id, user, reason) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (![RS.PENDING, RS.APPROVED].includes(refund.status))
        throw new Error("Only pending or approved refunds can be cancelled");

      await applyLifecycleTransition({
        entity: refund,
        action: "cancelled",
        nextStatus: RS.CANCELLED,
        user,
        reason,
        t,
      });

      return { refund };
    });
  },

  /* =========================================================================
     7️⃣ VOID (ANY → VOIDED)
     ========================================================================= */
  async voidRefund({ refund_id, user, reason }) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      await applyLifecycleTransition({
        entity: refund,
        action: "voided",
        nextStatus: RS.VOIDED,
        user,
        reason,
        t,
      });

      return { refund };
    });
  },

  /* =========================================================================
     8️⃣ REVERSE (PROCESSED → REVERSED)
     ========================================================================= */
  async reverseRefund({ refund_id, user }) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (refund.status !== RS.PROCESSED)
        throw new Error("Only processed refunds can be reversed");

      const deposit = await Deposit.findByPk(refund.deposit_id, { transaction: t });

      deposit.remaining_balance =
        Number(deposit.remaining_balance ?? 0) +
        Number(refund.refund_amount);

      deposit.refund_amount =
        Number(deposit.refund_amount ?? 0) -
        Number(refund.refund_amount);

      await deposit.save({ transaction: t, user });
      await db.CashLedger.create(
      {
        date: new Date().toISOString().slice(0, 10),

        type: LEDGER_TYPES.REVERSAL,
        direction: LEDGER_DIRECTIONS.IN,

        account_id: deposit.account_id,
        amount: refund.refund_amount,
        currency: deposit.currency,

        reference_type: "refund_deposit_reversal",
        reference_id: refund.id,

        organization_id: refund.organization_id,
        facility_id: refund.facility_id,
        created_by_id: user.id,
      },
      { transaction: t }
      );
      await applyLifecycleTransition({
        entity: refund,
        action: "reversed",
        nextStatus: RS.REVERSED,
        user,
        t,
      });

      return { refund, deposit };
    });
  },

  /* =========================================================================
     9️⃣ RESTORE (VOIDED / REVERSED → PENDING)
     ========================================================================= */
  async restoreRefund({ refund_id, user }) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (![RS.VOIDED, RS.REVERSED].includes(refund.status))
        throw new Error("Only voided or reversed refunds can be restored");

      await applyLifecycleTransition({
        entity: refund,
        action: "restored",
        nextStatus: RS.PENDING,
        user,
        t,
      });

      return { refund };
    });
  },
};
