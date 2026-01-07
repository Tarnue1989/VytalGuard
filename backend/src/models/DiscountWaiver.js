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
      // 🔗 Links
      DiscountWaiver.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });
      DiscountWaiver.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      DiscountWaiver.belongsTo(models.Employee, {
        as: "approvedByEmployee",
        foreignKey: "approved_by_employee_id",
      });

      // 🔹 Org / Facility
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

      // 🔹 Lifecycle Audit
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

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Links
      invoice_id: { type: DataTypes.UUID, allowNull: false },
      patient_id: { type: DataTypes.UUID, allowNull: false },

      // 📌 Discount info
      type: { type: DataTypes.ENUM(...DISCOUNT_TYPE), allowNull: false }, // percentage | fixed
      reason: { type: DataTypes.TEXT, allowNull: false },
      percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      applied_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      remaining_balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

      // 📌 Lifecycle
      status: {
        type: DataTypes.ENUM(...DISCOUNT_WAIVER_STATUS),
        allowNull: false,
        defaultValue: WS.PENDING,
      },

      // 🔹 Lifecycle audit trail
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

      // 🔹 Audit
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
      scopes: {
        withDeleted: { paranoid: false },
        pending: { where: { status: WS.PENDING, deleted_at: null } },
        approved: { where: { status: WS.APPROVED, deleted_at: null } },
        applied: { where: { status: WS.APPLIED, deleted_at: null } },
        rejected: { where: { status: WS.REJECTED, deleted_at: null } },
        voided: { where: { status: WS.VOIDED, deleted_at: null } },
        tenant(facilityId) {
          return facilityId ? { where: { facility_id: facilityId } } : {};
        },
      },
      indexes: [
        { fields: ["organization_id"], name: "idx_discountwaivers_org_id" },
        { fields: ["facility_id"], name: "idx_discountwaivers_facility_id" },
        { fields: ["invoice_id"], name: "idx_discountwaivers_invoice_id" },
        { fields: ["patient_id"], name: "idx_discountwaivers_patient_id" },
        { fields: ["status"], name: "idx_discountwaivers_status" },
        { fields: ["approved_by_employee_id"], name: "idx_discountwaivers_approver_id" },
        { fields: ["approved_by_id"], name: "idx_discountwaivers_approved_by" },
        { fields: ["rejected_by_id"], name: "idx_discountwaivers_rejected_by" },
        { fields: ["voided_by_id"], name: "idx_discountwaivers_voided_by" },
        { fields: ["finalized_by_id"], name: "idx_discountwaivers_finalized_by" },
      ],
      validate: {
        mustHaveAmountOrPercentage() {
          const hasPercentage = this.percentage !== null && this.percentage !== undefined;
          const hasAmount = this.amount !== null && this.amount !== undefined;

          if (hasPercentage && hasAmount) {
            throw new Error("Discount Waiver cannot have both 'percentage' and 'amount'. Choose one.");
          }
          if (!hasPercentage && !hasAmount) {
            throw new Error("Discount Waiver must have either 'percentage' or 'amount'.");
          }
          if (this.type === "percentage" && parseFloat(this.percentage) > 100) {
            throw new Error("Percentage waiver cannot exceed 100%");
          }
          if (this.type === "fixed" && parseFloat(this.amount) < 0) {
            throw new Error("Fixed waiver amount must be non-negative");
          }
        },
      },
    }
  );

  /* ============================================================
     🔁 Hooks
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
    waiver.remaining_balance = Math.max(intendedAmount - waiver.applied_total, 0);
  });

  DiscountWaiver.afterUpdate(async (waiver, options) => {
    if ([WS.APPROVED, WS.APPLIED].includes(waiver.status)) {
      const { financialService } = await import("../services/financialService.js");
      await financialService.recalcInvoice(waiver.invoice_id, options?.transaction);
    }
  });

  return DiscountWaiver;
};
