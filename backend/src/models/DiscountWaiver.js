// 📁 backend/src/models/DiscountWaiver.js
import { DataTypes, Model } from "sequelize";
import { DISCOUNT_WAIVER_STATUS, DISCOUNT_TYPE } from "../constants/enums.js";

/* ============================================================
   🔖 Local enum map
============================================================ */
const WS = {
  PENDING: DISCOUNT_WAIVER_STATUS[0],
  APPROVED: DISCOUNT_WAIVER_STATUS[1],
  APPLIED: DISCOUNT_WAIVER_STATUS[2],
  REJECTED: DISCOUNT_WAIVER_STATUS[3],
  VOIDED: DISCOUNT_WAIVER_STATUS[4],
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

      type: { type: DataTypes.ENUM(...DISCOUNT_TYPE), allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: false },
      percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      applied_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      remaining_balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

      status: {
        type: DataTypes.ENUM(...DISCOUNT_WAIVER_STATUS),
        allowNull: false,
        defaultValue: WS.PENDING,
      },

      approved_by_employee_id: { type: DataTypes.UUID },
      approved_by_id: { type: DataTypes.UUID },
      approved_at: { type: DataTypes.DATE },

      rejected_by_id: { type: DataTypes.UUID },
      rejected_at: { type: DataTypes.DATE },

      voided_by_id: { type: DataTypes.UUID },
      voided_at: { type: DataTypes.DATE },
      void_reason: { type: DataTypes.STRING(255), allowNull: true },

      finalized_by_id: { type: DataTypes.UUID, allowNull: true },
      finalized_at: { type: DataTypes.DATE, allowNull: true },

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
    if (!invoice) throw new Error("Invalid invoice_id for Discount Waiver");

    const total = parseFloat(invoice.total || 0);

    let intendedAmount = 0;

    if (waiver.percentage) {
      intendedAmount = (total * parseFloat(waiver.percentage)) / 100;
    } else if (waiver.amount) {
      intendedAmount = parseFloat(waiver.amount);
    }

    if (intendedAmount > total) {
      throw new Error("Discount amount cannot exceed invoice total");
    }

    waiver.applied_total = intendedAmount;
    waiver.remaining_balance = 0;
  });

  /* ============================================================
    🔁 APPLY WAIVER (FINAL – TRIGGER ONLY)
  ============================================================ */
  DiscountWaiver.afterUpdate(async (waiver, options) => {
    try {
      if (!["applied", "finalized"].includes(waiver.status)) return;

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