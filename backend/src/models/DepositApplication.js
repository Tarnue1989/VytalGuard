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

      /* ================= LINKS ================= */
      deposit_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      invoice_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      /* ================= CURRENCY ================= */
      // 🔥 Always store deposit (source) currency
      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      /* ================= AMOUNTS ================= */
      // 💵 Amount in deposit currency
      applied_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },

      // 💱 Converted amount (invoice currency)
      converted_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },

      /* ================= FX TRACKING ================= */
      fx_rate_used: {
        type: DataTypes.DECIMAL(12, 6),
        allowNull: true,
      },

      fx_from_currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: true,
      },

      fx_to_currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: true,
      },

      /* ================= TIMING ================= */
      applied_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      applied_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      /* ================= REVERSAL ================= */
      reversed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      reversed_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      /* ================= AUDIT ================= */
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
     🔁 HOOKS (FIXED FOR FX SUPPORT)
  ============================================================ */

  DepositApplication.beforeValidate(async (app) => {
    const { Deposit, Invoice } = await import("../models/index.js");

    const deposit = await Deposit.findByPk(app.deposit_id);
    if (!deposit) throw new Error("Invalid deposit_id");

    const invoice = await Invoice.findByPk(app.invoice_id);
    if (!invoice) throw new Error("Invalid invoice_id");

    // ❌ REMOVED: currency mismatch blocking

    // ✅ Always store deposit currency (source currency)
    app.currency = deposit.currency;

    // OPTIONAL SAFETY: ensure amount exists
    if (app.applied_amount == null || Number(app.applied_amount) <= 0) {
      throw new Error("Invalid applied amount");
    }
  });

  return DepositApplication;
};