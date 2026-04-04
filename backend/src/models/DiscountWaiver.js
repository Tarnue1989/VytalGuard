// 📁 backend/src/models/DiscountWaiver.js
import { DataTypes, Model } from "sequelize";
import {
  DISCOUNT_WAIVER_STATUS,
  DISCOUNT_TYPE,
  CURRENCY,
} from "../constants/enums.js";

/* ============================================================
   🔖 Local enum map (OBJECT SAFE)
============================================================ */
const WS = {
  PENDING: DISCOUNT_WAIVER_STATUS.PENDING,
  APPROVED: DISCOUNT_WAIVER_STATUS.APPROVED,
  APPLIED: DISCOUNT_WAIVER_STATUS.APPLIED,
  REJECTED: DISCOUNT_WAIVER_STATUS.REJECTED,
  VOIDED: DISCOUNT_WAIVER_STATUS.VOIDED,
};

export default (sequelize) => {
  class DiscountWaiver extends Model {
    static associate(models) {
      DiscountWaiver.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });
      DiscountWaiver.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });

      DiscountWaiver.belongsTo(models.Employee, {
        as: "approvedByEmployee",
        foreignKey: "approved_by_employee_id",
      });

      DiscountWaiver.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      DiscountWaiver.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔹 Audit
      DiscountWaiver.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      DiscountWaiver.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      DiscountWaiver.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });

      DiscountWaiver.belongsTo(models.User, { as: "approvedBy", foreignKey: "approved_by_id" });
      DiscountWaiver.belongsTo(models.User, { as: "rejectedBy", foreignKey: "rejected_by_id" });
      DiscountWaiver.belongsTo(models.User, { as: "voidedBy", foreignKey: "voided_by_id" });
      DiscountWaiver.belongsTo(models.User, { as: "finalizedBy", foreignKey: "finalized_by_id" });
    }
  }

  DiscountWaiver.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      invoice_id: { type: DataTypes.UUID, allowNull: false },
      patient_id: { type: DataTypes.UUID, allowNull: false },

      // 💱 🔥 REQUIRED (MATCH INVOICE)
      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      status: {
        type: DataTypes.ENUM(...Object.values(DISCOUNT_WAIVER_STATUS)),
        allowNull: false,
        defaultValue: DISCOUNT_WAIVER_STATUS.PENDING,
      },

      type: {
        type: DataTypes.ENUM(...Object.values(DISCOUNT_TYPE)),
        allowNull: false,
      },

      reason: { type: DataTypes.TEXT, allowNull: false },

      percentage: { type: DataTypes.DECIMAL(5, 2) },
      amount: { type: DataTypes.DECIMAL(12, 2) },

      // 💰 Computed
      applied_total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },

      remaining_balance: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },

      // 🔹 Approval
      approved_by_employee_id: { type: DataTypes.UUID },
      approved_by_id: { type: DataTypes.UUID },
      approved_at: { type: DataTypes.DATE },

      rejected_by_id: { type: DataTypes.UUID },
      rejected_at: { type: DataTypes.DATE },

      voided_by_id: { type: DataTypes.UUID },
      voided_at: { type: DataTypes.DATE },
      void_reason: { type: DataTypes.STRING(255) },

      finalized_by_id: { type: DataTypes.UUID },
      finalized_at: { type: DataTypes.DATE },

      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "DiscountWaiver",
      tableName: "discount_waivers",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",

      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
      },
    }
  );

  /* ============================================================
     🔁 BEFORE VALIDATE (CALCULATE TOTAL)
  ============================================================ */
  DiscountWaiver.beforeValidate(async (waiver) => {
    const { Invoice } = await import("../models/index.js");

    const invoice = await Invoice.findByPk(waiver.invoice_id);
    if (!invoice) throw new Error("Invalid invoice_id");

    // 🔥 enforce currency
    waiver.currency = invoice.currency;

    const total = parseFloat(invoice.total || 0);

    let intendedAmount = 0;

    if (waiver.percentage) {
      intendedAmount = (total * parseFloat(waiver.percentage)) / 100;
    } else if (waiver.amount) {
      intendedAmount = parseFloat(waiver.amount);
    }

    if (intendedAmount > total) {
      throw new Error("Discount cannot exceed invoice total");
    }

    waiver.applied_total = intendedAmount;
    waiver.remaining_balance = total - intendedAmount;
  });

  /* ============================================================
     🔁 APPLY WAIVER
  ============================================================ */
  DiscountWaiver.afterUpdate(async (waiver, options) => {
    try {
      // 🔥 ONLY APPLY FINANCIAL IMPACT WHEN ACTUALLY APPLIED
      if (waiver.status !== WS.APPLIED) return;

      const { financialService } = await import("../services/financialService.js");

      await financialService.recalcInvoice(
        waiver.invoice_id,
        options?.transaction
      );
    } catch (err) {
      console.error("❌ Waiver recalc failed:", err.message);
    }
  });

  return DiscountWaiver;
};