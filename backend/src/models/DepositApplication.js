// 📁 backend/src/models/DepositApplication.js
import { DataTypes, Model } from "sequelize";
import { CURRENCY } from "../constants/enums.js";

export default (sequelize) => {
  class DepositApplication extends Model {
    static associate(models) {
      DepositApplication.belongsTo(models.Deposit, {
        as: "deposit",
        foreignKey: "deposit_id",
      });

      DepositApplication.belongsTo(models.Invoice, {
        as: "invoice",
        foreignKey: "invoice_id",
      });

      DepositApplication.belongsTo(models.User, {
        as: "appliedBy",
        foreignKey: "applied_by_id",
      });

      DepositApplication.belongsTo(models.User, {
        as: "reversedBy",
        foreignKey: "reversed_by_id",
      });
    }
  }

  DepositApplication.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      // 🔗 Links
      deposit_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      invoice_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      // 💱 🔥 CRITICAL (MATCH DEPOSIT + INVOICE)
      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      // 💵 Amount
      applied_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },

      applied_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      applied_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      // 🔁 Reversal tracking
      reversed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      reversed_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      // 🔹 Audit
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      deleted_at: {
        type: DataTypes.DATE,
      },
    },
    {
      sequelize,
      modelName: "DepositApplication",
      tableName: "deposit_applications",
      paranoid: true,
      underscored: true,

      indexes: [
        { fields: ["deposit_id"] },
        { fields: ["invoice_id"] },
        { fields: ["applied_by_id"] },
      ],
    }
  );

  /* ============================================================
     🔁 Hooks (CRITICAL SAFETY)
  ============================================================ */

  // 🔥 Ensure currency + validation
  DepositApplication.beforeValidate(async (app) => {
    const { Deposit, Invoice } = await import("../models/index.js");

    const deposit = await Deposit.findByPk(app.deposit_id);
    if (!deposit) throw new Error("Invalid deposit_id");

    const invoice = await Invoice.findByPk(app.invoice_id);
    if (!invoice) throw new Error("Invalid invoice_id");

    // 🔥 enforce same currency
    if (deposit.currency !== invoice.currency) {
      throw new Error("Currency mismatch between deposit and invoice");
    }

    // 🔥 assign currency automatically
    app.currency = deposit.currency;
  });

  return DepositApplication;
};