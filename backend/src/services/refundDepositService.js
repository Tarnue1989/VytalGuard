// 📁 backend/src/services/refundDepositService.js
// ============================================================================
// ⭐ ENTERPRISE-GRADE DEPOSIT REFUND SERVICE (FINAL CORRECT VERSION)
// Lifecycle:
// pending → review → approved → processed → reversed
//            ↘ rejected
//            ↘ cancelled
// voided → restored
// ============================================================================

import {
  sequelize,
  RefundDeposit,
  Deposit,
  RefundDepositTransaction   // ✅ CORRECT MODEL
} from "../models/index.js";

import { DEPOSIT_REFUND_STATUS as RS } from "../constants/enums.js";

export const refundDepositService = {

  /* =========================================================================
     🔹 1️⃣ CREATE (→ pending)
     ========================================================================= */
  async createRefund({ deposit_id, amount, method, reason, user }) {
    return sequelize.transaction(async (t) => {

      const roles = (user.roleNames || []).map(r => r.toLowerCase());
      const isSuper = roles.includes("superadmin");

      const where = { id: deposit_id };
      if (!isSuper) {
        where.organization_id = user.organization_id;
        where.facility_id = user.facility_id;
      }

      const deposit = await Deposit.findOne({ where, transaction: t });
      if (!deposit) throw new Error("Deposit not found");

      const balance = Number(deposit.remaining_balance ?? 0);
      const refundAmount = Number(amount);

      if (refundAmount <= 0)
        throw new Error("Refund amount must be greater than zero");

      if (refundAmount > balance)
        throw new Error(`Refund amount exceeds available balance (${balance})`);

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
          reason_log: [
            { action: "created", reason, user_id: user.id, timestamp: new Date() }
          ]
        },
        { transaction: t }
      );

      return { refund };
    });
  },

  /* =========================================================================
     🔹 2️⃣ REVIEW (pending → review)
     ========================================================================= */
  async reviewRefund(refund_id, user) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.unscoped().findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (refund.status !== RS.PENDING)
        throw new Error("Only pending refunds may be moved to review");

      refund.status = RS.REVIEW;
      refund.updated_by_id = user.id;

      refund.reason_log = [
        ...(refund.reason_log || []),
        { action: "reviewed", user_id: user.id, timestamp: new Date() }
      ];

      await refund.save({ transaction: t, user });
      return { refund };
    });
  },

  /* =========================================================================
     🔹 3️⃣ APPROVE (pending / review → approved)
     ========================================================================= */
  async approveRefund({ refund_id, user }) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.unscoped().findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (![RS.PENDING, RS.REVIEW].includes(refund.status))
        throw new Error("Only pending or review refunds can be approved");

      refund.status = RS.APPROVED;
      refund.updated_by_id = user.id;

      refund.reason_log = [
        ...(refund.reason_log || []),
        { action: "approved", user_id: user.id, timestamp: new Date() }
      ];

      await refund.save({ transaction: t, user });
      return { refund };
    });
  },

  /* =========================================================================
     🔹 4️⃣ PROCESS (approved → processed)
     ========================================================================= */
  async processRefund({ refund_id, user }) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.unscoped().findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (refund.status !== RS.APPROVED)
        throw new Error("Only approved refunds may be processed");

      const deposit = await Deposit.findByPk(refund.deposit_id, { transaction: t });
      if (!deposit) throw new Error("Linked deposit not found");

      const balance = Number(deposit.remaining_balance ?? 0);
      const refundAmount = Number(refund.refund_amount);

      if (refundAmount > balance)
        throw new Error(`Refund amount exceeds available balance (${balance})`);

      // Update deposit balances
      deposit.remaining_balance = balance - refundAmount;
      deposit.refund_amount =
        Number(deposit.refund_amount ?? 0) + refundAmount;

      await deposit.save({ transaction: t });

      // ✅ CORRECT: Deposit refund ledger
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
          created_by_id: user.id
        },
        { transaction: t }
      );

      refund.status = RS.PROCESSED;
      refund.updated_by_id = user.id;

      refund.reason_log = [
        ...(refund.reason_log || []),
        { action: "processed", user_id: user.id, timestamp: new Date() }
      ];

      await refund.save({ transaction: t, user });

      return { refund, deposit };
    });
  },

  /* =========================================================================
     🔹 5️⃣ REJECT (pending / review → rejected)
     ========================================================================= */
  async rejectRefund(refund_id, user, reason) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.unscoped().findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (![RS.PENDING, RS.REVIEW].includes(refund.status))
        throw new Error("Only pending or review refunds can be rejected");

      refund.status = RS.REJECTED;
      refund.reason = reason || refund.reason;
      refund.updated_by_id = user.id;

      refund.reason_log = [
        ...(refund.reason_log || []),
        { action: "rejected", reason, user_id: user.id, timestamp: new Date() }
      ];

      await refund.save({ transaction: t, user });
      return { refund };
    });
  },

  /* =========================================================================
     🔹 6️⃣ CANCEL (pending / approved → cancelled)
     ========================================================================= */
  async cancelRefund(refund_id, user, reason) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.unscoped().findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (![RS.PENDING, RS.APPROVED].includes(refund.status))
        throw new Error("Only pending or approved refunds can be cancelled");

      refund.status = RS.CANCELLED;
      refund.reason = reason || refund.reason;
      refund.updated_by_id = user.id;

      refund.reason_log = [
        ...(refund.reason_log || []),
        { action: "cancelled", reason, user_id: user.id, timestamp: new Date() }
      ];

      await refund.save({ transaction: t, user });
      return { refund };
    });
  },

  /* =========================================================================
     🔹 7️⃣ VOID (any → voided)
     ========================================================================= */
  async voidRefund({ refund_id, user, reason }) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.unscoped().findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      refund.status = RS.VOIDED;
      refund.reason = reason || refund.reason;
      refund.updated_by_id = user.id;

      refund.reason_log = [
        ...(refund.reason_log || []),
        { action: "voided", reason, user_id: user.id, timestamp: new Date() }
      ];

      await refund.save({ transaction: t, user });
      return { refund };
    });
  },

  /* =========================================================================
     🔹 8️⃣ REVERSE (processed → reversed)
     ========================================================================= */
  async reverseRefund({ refund_id, user }) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.unscoped().findByPk(refund_id, { transaction: t });
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

      await deposit.save({ transaction: t });

      refund.status = RS.REVERSED;
      refund.updated_by_id = user.id;

      refund.reason_log = [
        ...(refund.reason_log || []),
        { action: "reversed", user_id: user.id, timestamp: new Date() }
      ];

      await refund.save({ transaction: t, user });
      return { refund, deposit };
    });
  },

  /* =========================================================================
     🔹 9️⃣ RESTORE (voided / reversed → pending)
     ========================================================================= */
  async restoreRefund({ refund_id, user }) {
    return sequelize.transaction(async (t) => {

      const refund = await RefundDeposit.unscoped().findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (![RS.VOIDED, RS.REVERSED].includes(refund.status))
        throw new Error("Only voided or reversed refunds can be restored");

      refund.status = RS.PENDING;
      refund.updated_by_id = user.id;

      refund.reason_log = [
        ...(refund.reason_log || []),
        { action: "restored", user_id: user.id, timestamp: new Date() }
      ];

      await refund.save({ transaction: t, user });
      return { refund };
    });
  }
};
