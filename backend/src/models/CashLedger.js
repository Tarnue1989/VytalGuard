// 📁 backend/src/models/CashLedger.js
import { DataTypes, Model } from "sequelize";
import {
  LEDGER_TYPES,
  LEDGER_DIRECTIONS,
  LEDGER_REFERENCE_TYPES,
  CURRENCY,
} from "../constants/enums.js";

export default (sequelize) => {
  class CashLedger extends Model {
    static associate(models) {
      CashLedger.belongsTo(models.Account, { as: "account", foreignKey: "account_id" });

      CashLedger.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      CashLedger.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      CashLedger.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
    }
  }

  CashLedger.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      type: {
        type: DataTypes.ENUM(...Object.values(LEDGER_TYPES)),
        allowNull: false,
      },

      direction: {
        type: DataTypes.ENUM(...Object.values(LEDGER_DIRECTIONS)),
        allowNull: false,
      },

      account_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      from_account_id: DataTypes.UUID,
      to_account_id: DataTypes.UUID,

      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },

      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      reference_type: {
        type: DataTypes.ENUM(...Object.values(LEDGER_REFERENCE_TYPES)),
      },

      reference_id: DataTypes.UUID,

      reversal_of_id: DataTypes.UUID,

      description: DataTypes.TEXT,

      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID },

      created_by_id: DataTypes.UUID,
    },
    {
      sequelize,
      modelName: "CashLedger",
      tableName: "cash_ledger",
      underscored: true,
      paranoid: true,
      timestamps: true,
    }
  );

  /* ============================================================
    🔥 AUTO BALANCE ENGINE (FINAL — PRODUCTION SAFE)
  ============================================================ */

  /* ================= AFTER CREATE ================= */
  CashLedger.afterCreate(async (entry, options) => {
    if (!options.transaction) {
      throw new Error("❌ CashLedger must be used inside a transaction");
    }

    const { Account } = entry.sequelize.models;
    const t = options.transaction;

    const account = await Account.findByPk(entry.account_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!account) return;

    const current = parseFloat(account.balance || 0);
    const amt = parseFloat(entry.amount || 0);

    let newBalance = current;

    if (entry.direction === "in") {
      newBalance += amt;
    } else if (entry.direction === "out") {
      newBalance -= amt;
    }

    await account.update(
      { balance: newBalance },
      { transaction: t }
    );
  });


  /* ================= AFTER DESTROY (REVERSAL) ================= */
  CashLedger.afterDestroy(async (entry, options) => {
    if (!options.transaction) {
      throw new Error("❌ CashLedger must be used inside a transaction");
    }

    const { Account } = entry.sequelize.models;
    const t = options.transaction;

    const account = await Account.findByPk(entry.account_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!account) return;

    const current = parseFloat(account.balance || 0);
    const amt = parseFloat(entry.amount || 0);

    let newBalance = current;

    if (entry.direction === "in") {
      newBalance -= amt;
    } else {
      newBalance += amt;
    }

    await account.update(
      { balance: newBalance },
      { transaction: t }
    );
  });
  return CashLedger;
};