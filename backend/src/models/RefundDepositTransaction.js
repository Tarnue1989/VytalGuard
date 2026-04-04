// 📁 backend/src/models/RefundDepositTransaction.js
import { DataTypes, Model } from "sequelize";
import {
  REFUND_DEPOSIT_TRANSACTION_STATUS,
  CURRENCY,
} from "../constants/enums.js";

/* ============================================================
   🔖 Enum map (OBJECT SAFE)
============================================================ */
const RTS = {
  CREATED:  REFUND_DEPOSIT_TRANSACTION_STATUS.CREATED,
  PROCESSED: REFUND_DEPOSIT_TRANSACTION_STATUS.PROCESSED,
  FAILED:   REFUND_DEPOSIT_TRANSACTION_STATUS.FAILED,
  REVERSED: REFUND_DEPOSIT_TRANSACTION_STATUS.REVERSED,
};

export default (sequelize) => {
  class RefundDepositTransaction extends Model {
    static associate(models) {
      RefundDepositTransaction.belongsTo(models.RefundDeposit, {
        as: "refundDeposit",
        foreignKey: "refund_deposit_id",
      });

      RefundDepositTransaction.belongsTo(models.Deposit, {
        as: "deposit",
        foreignKey: "deposit_id",
      });

      RefundDepositTransaction.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      RefundDepositTransaction.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      RefundDepositTransaction.belongsTo(models.Patient, {
        as: "patient",
        foreignKey: "patient_id",
      });

      RefundDepositTransaction.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      RefundDepositTransaction.belongsTo(models.User, {
        as: "reversedBy",
        foreignKey: "reversed_by_id",
      });
    }
  }

  RefundDepositTransaction.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },

      // 🔗 Parents
      refund_deposit_id: { type: DataTypes.UUID, allowNull: false },
      deposit_id: { type: DataTypes.UUID, allowNull: false },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      patient_id: { type: DataTypes.UUID, allowNull: false },

      // 💱 🔥 REQUIRED (MATCH DEPOSIT)
      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      // 💵 Amount
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0.01 },
      },

      method: { type: DataTypes.STRING },
      note: { type: DataTypes.TEXT },

      // 🔄 Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(REFUND_DEPOSIT_TRANSACTION_STATUS)),
        allowNull: false,
        defaultValue: REFUND_DEPOSIT_TRANSACTION_STATUS.CREATED,
      },

      // 🔹 Audit
      created_by_id: DataTypes.UUID,
      reversed_by_id: DataTypes.UUID,

      created_at: { type: DataTypes.DATE },
      updated_at: { type: DataTypes.DATE },
      reversed_at: { type: DataTypes.DATE },
      deleted_at: { type: DataTypes.DATE },
      deleted_by_id: DataTypes.UUID,
    },
    {
      sequelize,
      modelName: "RefundDepositTransaction",
      tableName: "refund_deposit_transactions",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",

      indexes: [
        { fields: ["refund_deposit_id"] },
        { fields: ["deposit_id"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["patient_id"] },
        { fields: ["status"] },
      ],
    }
  );

  /* ============================================================
     🔁 Hooks
  ============================================================ */

  // 🔥 Enforce currency from deposit
  RefundDepositTransaction.beforeValidate(async (tx) => {
    const { Deposit } = await import("../models/index.js");

    const deposit = await Deposit.findByPk(tx.deposit_id);
    if (!deposit) throw new Error("Invalid deposit_id");

    tx.currency = deposit.currency;
  });

  return RefundDepositTransaction;
};