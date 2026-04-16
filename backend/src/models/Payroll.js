// 📁 backend/src/models/Payroll.js

import { DataTypes, Model } from "sequelize";
import {
  PAYROLL_STATUS,
  PAYROLL_TRANSITIONS,
  CURRENCY,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
} from "../constants/enums.js";

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
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });

      Payroll.belongsTo(models.User, {
        as: "approvedBy",
        foreignKey: "approved_by_id",
      });

      Payroll.belongsTo(models.User, {
        as: "paidBy",
        foreignKey: "paid_by_id",
      });

      Payroll.belongsTo(models.User, {
        as: "voidedBy",
        foreignKey: "voided_by_id",
      });

      // 🔥 Expense link
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

      /* ================= CORE ================= */

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
        type: DataTypes.STRING,
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

      /* ================= PAYMENT CONFIG ================= */

      account_id: {
        type: DataTypes.UUID,
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

      expense_id: DataTypes.UUID,
      paid_at: DataTypes.DATE,

      /* ================= STATUS ================= */

      status: {
        type: DataTypes.ENUM(...Object.values(PAYROLL_STATUS)),
        defaultValue: PAYROLL_STATUS.DRAFT,
      },

      /* ================= TENANT ================= */

      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      facility_id: DataTypes.UUID,

      /* ================= AUDIT ================= */

      created_by_id: DataTypes.UUID,
      updated_by_id: DataTypes.UUID,

      approved_by_id: DataTypes.UUID,
      approved_at: DataTypes.DATE,

      paid_by_id: DataTypes.UUID,

      voided_by_id: DataTypes.UUID,
      voided_at: DataTypes.DATE,
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
     🔥 AUTO CALCULATE NET SALARY (CRITICAL FIX)
  ============================================================ */
  Payroll.beforeValidate((payroll) => {
    payroll.net_salary =
      Number(payroll.basic_salary || 0) +
      Number(payroll.allowances || 0) -
      Number(payroll.deductions || 0);
  });

  /* ============================================================
     🔥 LIFECYCLE + AUDIT CONTROL
  ============================================================ */
  Payroll.beforeUpdate((payroll, options) => {
    const userId =
      options?.user?.id ||
      payroll.updated_by_id ||
      payroll.created_by_id ||
      null;

    if (userId) payroll.updated_by_id = userId;

    if (payroll.changed("status")) {
      const prev = payroll._previousDataValues.status;
      const next = payroll.status;

      const allowed = PAYROLL_TRANSITIONS[prev] || {};
      if (!allowed[next]) {
        throw new Error(`Invalid payroll transition: ${prev} → ${next}`);
      }

      if (next === PAYROLL_STATUS.APPROVED) {
        payroll.approved_by_id = userId;
        payroll.approved_at = new Date();
      }

      if (next === PAYROLL_STATUS.PAID) {
        payroll.paid_by_id = userId;
        payroll.paid_at = new Date();
      }

      if (next === PAYROLL_STATUS.VOIDED) {
        payroll.voided_by_id = userId;
        payroll.voided_at = new Date();
      }
    }
  });

  /* ============================================================
    🔥 PAYROLL FINANCE HOOK (CREATE + REVERSE) — FINAL SAFE
  ============================================================ */
  Payroll.afterUpdate(async (payroll, options) => {
    try {
      const prev = payroll._previousDataValues.status;
      const next = payroll.status;

      // 🔒 enforce transaction safety
      if (!options.transaction) {
        throw new Error("Missing transaction in payroll hook");
      }

      const { Expense } = await import("../models/index.js");

      /* ============================================================
        💰 CREATE EXPENSE (APPROVED → PAID)
      ============================================================ */
      if (prev === PAYROLL_STATUS.APPROVED && next === PAYROLL_STATUS.PAID) {
        if (payroll.expense_id) return;

        if (!payroll.account_id) throw new Error("Missing account_id");
        if (!payroll.category) throw new Error("Missing category");
        if (!payroll.payment_method) throw new Error("Missing payment_method");

        const expense = await Expense.create(
          {
            expense_number: `EXP-PAY-${payroll.payroll_number}`, // ✅ fixed

            date: new Date(),
            amount: payroll.net_salary,
            currency: payroll.currency,

            category: payroll.category,
            payment_method: payroll.payment_method,

            description: `Salary payment for ${payroll.period}`,

            account_id: payroll.account_id,
            employee_id: payroll.employee_id,

            status: "posted",

            organization_id: payroll.organization_id,
            facility_id: payroll.facility_id,

            created_by_id: payroll.paid_by_id,
          },
          { transaction: options.transaction }
        );

        await payroll.update(
          { expense_id: expense.id },
          { transaction: options.transaction, hooks: false }
        );

        return;
      }

      /* ============================================================
        🔁 REVERSE EXPENSE (PAID → VOIDED)
      ============================================================ */
      if (prev === PAYROLL_STATUS.PAID && next === PAYROLL_STATUS.VOIDED) {
        if (!payroll.expense_id) return;

        const original = await Expense.findByPk(payroll.expense_id, {
          transaction: options.transaction,
        });

        if (!original) return;

        // 🚫 prevent duplicate reversal
        const exists = await Expense.findOne({
          where: {
            reference_type: "payroll_reversal",
            reference_id: payroll.id,
          },
          transaction: options.transaction,
        });

        if (exists) return;

        await Expense.create(
          {
            expense_number: `${original.expense_number}-REV-${Date.now()}`, // ✅ fixed

            date: new Date(),
            amount: -parseFloat(original.amount),

            currency: original.currency,
            category: original.category,
            payment_method: original.payment_method,

            description: `REVERSAL: ${original.description}`,

            account_id: original.account_id,
            employee_id: original.employee_id,

            status: "posted",

            organization_id: original.organization_id,
            facility_id: original.facility_id,

            reference_type: "payroll_reversal",
            reference_id: payroll.id,

            created_by_id: payroll.voided_by_id,
          },
          { transaction: options.transaction }
        );

        // ✅ optional but recommended
        await original.update(
          { status: "reversed" },
          { transaction: options.transaction }
        );
      }

    } catch (err) {
      console.error("❌ Payroll finance hook failed:", err);
      throw err;
    }
  });
  /* ============================================================
     🔢 AUTO GENERATE PAYROLL NUMBER (MULTI-TENANT SAFE)
  ============================================================ */
  Payroll.beforeCreate(async (payroll, options) => {
    if (payroll.payroll_number) return;

    const where = {
      organization_id: payroll.organization_id,
    };

    const last = await Payroll.findOne({
      where,
      order: [["createdAt", "DESC"]],
      attributes: ["payroll_number"],
      transaction: options.transaction,
      lock: options.transaction?.LOCK?.UPDATE,
    });

    let nextNumber = 1;

    if (last?.payroll_number) {
      const match = last.payroll_number.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    payroll.payroll_number = `PAY-${String(nextNumber).padStart(5, "0")}`;
  });

  return Payroll;
};