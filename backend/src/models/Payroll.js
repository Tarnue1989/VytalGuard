// 📁 backend/src/models/Payroll.js
import { DataTypes, Model } from "sequelize";
import { PAYROLL_STATUS, CURRENCY } from "../constants/enums.js";

export default (sequelize) => {
  class Payroll extends Model {
    static associate(models) {
      Payroll.belongsTo(models.Employee, {
        as: "employee",
        foreignKey: "employee_id",
      });

      Payroll.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      Payroll.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      Payroll.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      Payroll.belongsTo(models.User, {
        as: "approvedBy",
        foreignKey: "approved_by_id",
      });

      // 🔥 Payment (Expense linkage)
      Payroll.belongsTo(models.Expense, {
        as: "expense",
        foreignKey: "expense_id",
      });
    }
  }

  Payroll.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      /* ============================================================
         🔹 CORE
      ============================================================ */
      payroll_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      employee_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      period: {
        type: DataTypes.STRING, // e.g. "2026-04"
        allowNull: false,
      },

      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      basic_salary: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },

      allowances: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
      },

      deductions: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
      },

      net_salary: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },

      /* ============================================================
         🔹 PAYMENT LINK
      ============================================================ */
      expense_id: DataTypes.UUID,

      paid_at: DataTypes.DATE,

      /* ============================================================
         🔹 STATUS
      ============================================================ */
      status: {
        type: DataTypes.ENUM(...Object.values(PAYROLL_STATUS)),
        defaultValue: PAYROLL_STATUS.DRAFT,
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
      modelName: "Payroll",
      tableName: "payrolls",
      underscored: true,
      paranoid: true,
      timestamps: true,

      indexes: [
        { unique: true, fields: ["payroll_number"] },

        // 🔥 Prevent duplicate payroll per employee per period
        {
          unique: true,
          fields: ["employee_id", "period", "organization_id"],
        },

        { fields: ["employee_id"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["status"] },
      ],
    }
  );

  /* ============================================================
     🔥 AUTO CREATE EXPENSE (WHEN PAID)
  ============================================================ */
  Payroll.afterUpdate(async (payroll, options) => {
    try {
      // Only trigger when moving to PAID
      if (payroll.status !== PAYROLL_STATUS.PAID) return;

      // Already linked → skip
      if (payroll.expense_id) return;

      const { Expense } = await import("../models/index.js");

      const expense = await Expense.create(
        {
          expense_number: `PAY-${payroll.payroll_number}`,
          date: new Date(),
          amount: payroll.net_salary,
          currency: payroll.currency,
          category: "salary", // 🔥 MUST exist in EXPENSE_CATEGORIES
          payment_method: "bank", // 🔥 default (can improve later)
          description: `Salary payment for ${payroll.period}`,

          account_id: null, // ⚠️ MUST be passed in controller ideally
          employee_id: payroll.employee_id,

          status: "posted",

          organization_id: payroll.organization_id,
          facility_id: payroll.facility_id,
        },
        { transaction: options.transaction }
      );

      await payroll.update(
        {
          expense_id: expense.id,
          paid_at: new Date(),
        },
        { transaction: options.transaction, hooks: false }
      );
    } catch (err) {
      console.error("❌ Payroll expense hook failed:", err);
    }
  });

  return Payroll;
};