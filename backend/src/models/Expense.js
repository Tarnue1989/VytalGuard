// 📁 backend/src/models/Expense.js
import { DataTypes, Model } from "sequelize";
import {
  EXPENSE_CATEGORIES,
  CURRENCY,
  LEDGER_REFERENCE_TYPES,
} from "../constants/enums.js";

export default (sequelize) => {
  class Expense extends Model {
    static associate(models) {
      Expense.belongsTo(models.Account, { as: "account", foreignKey: "account_id" });

      Expense.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Expense.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      Expense.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
    }
  }

  Expense.init(
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

      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },

      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      category: {
        type: DataTypes.ENUM(...Object.values(EXPENSE_CATEGORIES)),
        allowNull: false,
      },

      description: DataTypes.TEXT,

      account_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      ledger_id: DataTypes.UUID,

      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID },

      created_by_id: DataTypes.UUID,
    },
    {
      sequelize,
      modelName: "Expense",
      tableName: "expenses",
      underscored: true,
      paranoid: true,
      timestamps: true,
    }
  );

  /* 🔥 AUTO LEDGER ENTRY */
  Expense.afterCreate(async (expense) => {
    const { CashLedger } = await import("../models/index.js");

    const ledger = await CashLedger.create({
      date: expense.date,
      type: "expense",
      direction: "out",
      account_id: expense.account_id,
      amount: expense.amount,
      currency: expense.currency,
      reference_type: LEDGER_REFERENCE_TYPES.EXPENSE,
      reference_id: expense.id,
      organization_id: expense.organization_id,
      facility_id: expense.facility_id,
    });

    expense.ledger_id = ledger.id;
    await expense.save();
  });

  return Expense;
};