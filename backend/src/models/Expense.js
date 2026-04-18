// 📁 backend/src/models/Expense.js
// ============================================================================
// 💸 Expense Model – ENTERPRISE FINAL (AUTO NUMBER + MULTI-TENANT SAFE)
// ============================================================================

import { DataTypes, Model } from "sequelize";
import {
  EXPENSE_CATEGORIES,
  CURRENCY,
  LEDGER_REFERENCE_TYPES,
  PAYMENT_METHODS,
  EXPENSE_STATUS,
  EXPENSE_TRANSITIONS,
  LEDGER_TYPES,
  LEDGER_DIRECTIONS,
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

      /* 🔹 AUDIT USERS */
      Expense.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Expense.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Expense.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
      Expense.belongsTo(models.User, { as: "approvedBy", foreignKey: "approved_by_id" });
      Expense.belongsTo(models.User, { as: "postedBy", foreignKey: "posted_by_id" });
      Expense.belongsTo(models.User, { as: "reversedBy", foreignKey: "reversed_by_id" });
      Expense.belongsTo(models.User, { as: "voidedBy", foreignKey: "voided_by_id" });

      Expense.belongsTo(models.Employee, {
        as: "employee",
        foreignKey: "employee_id",
        onDelete: "SET NULL",
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

      /* 🔹 CORE */
      expense_number: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
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

      /* 🔹 RELATIONS */
      account_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      employee_id: DataTypes.UUID,
      ledger_id: DataTypes.UUID,

      /* 🔹 STATUS */
      status: {
        type: DataTypes.ENUM(...Object.values(EXPENSE_STATUS)),
        defaultValue: EXPENSE_STATUS.DRAFT,
      },

      /* 🔹 TENANT */
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      facility_id: DataTypes.UUID,

      /* 🔹 BASE AUDIT */
      created_by_id: DataTypes.UUID,
      updated_by_id: DataTypes.UUID,
      deleted_by_id: DataTypes.UUID,

      /* 🔹 APPROVAL */
      approved_by_id: DataTypes.UUID,
      approved_at: DataTypes.DATE,

      /* 🔹 LIFECYCLE AUDIT */
      posted_by_id: DataTypes.UUID,
      posted_at: DataTypes.DATE,

      reversed_by_id: DataTypes.UUID,
      reversed_at: DataTypes.DATE,

      voided_by_id: DataTypes.UUID,
      voided_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "Expense",
      tableName: "expenses",
      underscored: true,
      paranoid: true,
      timestamps: true,

      indexes: [
        {
          unique: true,
          fields: ["organization_id", "expense_number"], // ✅ MULTI-TENANT SAFE
        },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["account_id"] },
        { fields: ["status"] },
      ],
    }
  );

  /* ============================================================
     🔢 AUTO NUMBER + AUDIT (RUNS BEFORE VALIDATION)
  ============================================================ */
  Expense.beforeValidate(async (expense, options) => {
    /* 🔹 Audit */
    if (options?.user) {
      expense.created_by_id = options.user.id;
    }

    /* 🔒 Skip if already set */
    if (expense.expense_number) return;

    if (!expense.organization_id) {
      throw new Error("Missing organization_id for expense numbering");
    }

    /* 🔥 Tenant-safe numbering */
    const last = await Expense.findOne({
      where: {
        organization_id: expense.organization_id,
      },
      order: [["createdAt", "DESC"]],
      transaction: options?.transaction,
    });

    let nextNumber = 1;

    if (last?.expense_number) {
      const match = last.expense_number.match(/EXP-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    expense.expense_number = `EXP-${String(nextNumber).padStart(5, "0")}`;
  });

  /* ============================================================
    🔹 UPDATE CONTROL + LIFECYCLE ENFORCEMENT (FINAL)
  ============================================================ */
  Expense.beforeUpdate((expense, options) => {
    // 🔥 SAFE USER RESOLUTION (DO NOT RELY ONLY ON options.user)
    const userId =
      options?.user?.id ||
      expense.updated_by_id ||
      expense.created_by_id ||
      null;

    // 🔹 Always track updater if available
    if (userId) {
      expense.updated_by_id = userId;
    }

    /* 🔒 LOCK AFTER POSTED */
    if (expense._previousDataValues.status === EXPENSE_STATUS.POSTED) {
      throw new Error("Posted expense cannot be modified");
    }

    /* 🔥 TRANSITION ENFORCEMENT */
    if (expense.changed("status")) {
      const prev = expense._previousDataValues.status;
      const next = expense.status;

      const allowed = EXPENSE_TRANSITIONS[prev] || {};

      if (!allowed[next]) {
        throw new Error(`Invalid status transition: ${prev} → ${next}`);
      }

      /* 🔥 LIFECYCLE AUDIT (NO EARLY RETURN!) */
      if (next === EXPENSE_STATUS.APPROVED) {
        expense.approved_by_id = userId;
        expense.approved_at = new Date();
      }

      if (next === EXPENSE_STATUS.POSTED) {
        expense.posted_by_id = userId;
        expense.posted_at = new Date();
      }

      if (next === EXPENSE_STATUS.REVERSED) {
        expense.reversed_by_id = userId;
        expense.reversed_at = new Date();
      }

      if (next === EXPENSE_STATUS.VOIDED) {
        expense.voided_by_id = userId;
        expense.voided_at = new Date();
      }
    }
  });

  /* ============================================================
     🔥 LEDGER: CREATE ON POST (CREATE)
  ============================================================ */
  Expense.afterCreate(async (expense, options) => {
    try {
      if (expense.status !== EXPENSE_STATUS.POSTED) return;
      if (expense.ledger_id) return;

      const { CashLedger } = await import("../models/index.js");

      const ledger = await CashLedger.create(
        {
          date: expense.date,
          type: LEDGER_TYPES.EXPENSE,
          direction: LEDGER_DIRECTIONS.OUT,
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

      await expense.update(
        { ledger_id: ledger.id },
        { transaction: options.transaction, hooks: false }
      );
    } catch (err) {
      console.error("❌ Expense ledger create failed:", err);
    }
  });

  /* ============================================================
     🔥 LEDGER: POST + REVERSE (UPDATE)
  ============================================================ */
  Expense.afterUpdate(async (expense, options) => {
    try {
      const { CashLedger } = await import("../models/index.js");

      /* 🔹 POST */
      if (
        expense.changed("status") &&
        expense.status === EXPENSE_STATUS.POSTED &&
        !expense.ledger_id
      ) {
        const ledger = await CashLedger.create(
          {
            date: expense.date,
            type: LEDGER_TYPES.EXPENSE,
            direction: LEDGER_DIRECTIONS.OUT,
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

        await expense.update(
          { ledger_id: ledger.id },
          { transaction: options.transaction, hooks: false }
        );
      }

      /* 🔹 REVERSE */
      if (
        expense.changed("status") &&
        expense.status === EXPENSE_STATUS.REVERSED
      ) {
        await CashLedger.create(
          {
            date: new Date(),
            type: LEDGER_TYPES.ADJUSTMENT,
            direction: LEDGER_DIRECTIONS.IN,
            account_id: expense.account_id,
            amount: expense.amount,
            currency: expense.currency,
            reference_type: LEDGER_REFERENCE_TYPES.ADJUSTMENT,
            reference_id: expense.id,
            organization_id: expense.organization_id,
            facility_id: expense.facility_id,
          },
          { transaction: options.transaction }
        );
      }
    } catch (err) {
      console.error("❌ Expense lifecycle hook failed:", err);
    }
  });

  return Expense;
};