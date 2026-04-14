// 📁 backend/src/models/Expense.js
import { DataTypes, Model } from "sequelize";
import {
  EXPENSE_CATEGORIES,
  CURRENCY,
  LEDGER_REFERENCE_TYPES,
  PAYMENT_METHODS,
  EXPENSE_STATUS,
} from "../constants/enums.js";

export default (sequelize) => {
  class Expense extends Model {
    static associate(models) {
      Expense.belongsTo(models.Account, {
        as: "account",
        foreignKey: "account_id",
        onDelete: "RESTRICT",
      });

      Expense.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      Expense.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      Expense.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      Expense.belongsTo(models.User, {
        as: "approvedBy",
        foreignKey: "approved_by_id",
      });

      // 🔥 Payroll ready
      Expense.belongsTo(models.Employee, {
        as: "employee",
        foreignKey: "employee_id",
      });
    }
  }

  Expense.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      /* ============================================================
         🔹 CORE
      ============================================================ */
      expense_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
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

      payment_method: {
        type: DataTypes.ENUM(...Object.values(PAYMENT_METHODS)),
        allowNull: false,
      },

      description: DataTypes.TEXT,

      /* ============================================================
         🔹 RELATIONS
      ============================================================ */
      account_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      employee_id: DataTypes.UUID,

      ledger_id: DataTypes.UUID,

      /* ============================================================
         🔹 STATUS / CONTROL
      ============================================================ */
      status: {
        type: DataTypes.ENUM(...Object.values(EXPENSE_STATUS)),
        defaultValue: EXPENSE_STATUS.DRAFT,
      },

      /* ============================================================
         🔹 TENANT
      ============================================================ */
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      facility_id: DataTypes.UUID,

      /* ============================================================
         🔹 AUDIT
      ============================================================ */
      created_by_id: DataTypes.UUID,

      approved_by_id: DataTypes.UUID,

      approved_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "Expense",
      tableName: "expenses",
      underscored: true,
      paranoid: true,
      timestamps: true,

      indexes: [
        { unique: true, fields: ["expense_number"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["account_id"] },
        { fields: ["status"] },
      ],
    }
  );

  /* ============================================================
     🔥 AUTO LEDGER ENTRY (SAFE + NO LOOP)
  ============================================================ */
  Expense.afterCreate(async (expense, options) => {
    try {
      // ❌ Only POSTED goes to ledger
      if (expense.status !== EXPENSE_STATUS.POSTED) return;

      const { CashLedger } = await import("../models/index.js");

      // ❌ Prevent duplicate ledger
      if (expense.ledger_id) return;

      const ledger = await CashLedger.create(
        {
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
        },
        { transaction: options.transaction }
      );

      // ✅ IMPORTANT: use update to avoid infinite hook loop
      await expense.update(
        { ledger_id: ledger.id },
        { transaction: options.transaction, hooks: false }
      );
    } catch (err) {
      console.error("❌ Expense ledger hook failed:", err);
    }
  });

  return Expense;
};