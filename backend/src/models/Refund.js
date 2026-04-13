// 📁 backend/src/models/Refund.js
import { DataTypes, Model } from "sequelize";
import { REFUND_STATUS, CURRENCY } from "../constants/enums.js";

/* ============================================================
   🔖 Local enum map
============================================================ */
const RS = {
  PENDING: REFUND_STATUS.PENDING,
  APPROVED: REFUND_STATUS.APPROVED,
  REJECTED: REFUND_STATUS.REJECTED,
  PROCESSED: REFUND_STATUS.PROCESSED,
  CANCELLED: REFUND_STATUS.CANCELLED,
  REVERSED: REFUND_STATUS.REVERSED,
  VOIDED: REFUND_STATUS.VOIDED,
};

export default (sequelize) => {
  class Refund extends Model {
    static associate(models) {
      Refund.belongsTo(models.Payment, { as: "payment", foreignKey: "payment_id" });
      Refund.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });
      Refund.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });

      Refund.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Refund.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      Refund.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Refund.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Refund.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });

      Refund.belongsTo(models.User, { as: "approvedBy", foreignKey: "approved_by_id" });
      Refund.belongsTo(models.User, { as: "rejectedBy", foreignKey: "rejected_by_id" });
      Refund.belongsTo(models.User, { as: "processedBy", foreignKey: "processed_by_id" });
      Refund.belongsTo(models.User, { as: "cancelledBy", foreignKey: "cancelled_by_id" });

      Refund.hasMany(models.RefundTransaction, {
        as: "transactions",
        foreignKey: "refund_id",
        onDelete: "CASCADE",
      });
    }
  }

  Refund.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      refund_number: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },

      payment_id: { type: DataTypes.UUID, allowNull: false },
      invoice_id: { type: DataTypes.UUID, allowNull: false },
      patient_id: { type: DataTypes.UUID, allowNull: false },

      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },

      reason: { type: DataTypes.TEXT },

      method: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM(...Object.values(REFUND_STATUS)),
        allowNull: false,
        defaultValue: REFUND_STATUS.PENDING,
      },

      approved_by_id: { type: DataTypes.UUID },
      approved_at: { type: DataTypes.DATE },

      rejected_by_id: { type: DataTypes.UUID },
      rejected_at: { type: DataTypes.DATE },

      processed_by_id: { type: DataTypes.UUID },
      processed_at: { type: DataTypes.DATE },

      cancelled_by_id: { type: DataTypes.UUID },
      cancelled_at: { type: DataTypes.DATE },

      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Refund",
      tableName: "refunds",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
    }
  );

  /* ============================================================
     🔁 Hooks
  ============================================================ */

  Refund.beforeValidate(async (refund) => {
    const { Payment } = await import("../models/index.js");

    const payment = await Payment.findByPk(refund.payment_id, { include: ["invoice"] });
    if (!payment) throw new Error("Invalid payment_id");

    refund.organization_id = payment.organization_id;
    refund.facility_id = payment.facility_id;
    refund.invoice_id = payment.invoice_id;
    refund.patient_id = payment.patient_id;
    refund.method = payment.method;
    refund.currency = payment.currency;
  });

  Refund.beforeCreate(async (refund) => {
    if (!refund.refund_number) {
      const last = await Refund.findOne({
        where: {
          organization_id: refund.organization_id,
          facility_id: refund.facility_id,
        },
        order: [["created_at", "DESC"]],
      });

      let seq = 1;

      if (last?.refund_number) {
        const match = last.refund_number.match(/(\d+)$/);
        if (match) seq = parseInt(match[1], 10) + 1;
      }

      const year = new Date().getFullYear();
      refund.refund_number = `REF-${year}-${String(seq).padStart(5, "0")}`;
    }
  });

  // 🔥 Lifecycle ONLY (NO RECALC HERE)
  Refund.afterUpdate(async (refund, options) => {
    const userId = options?.user?.id || null;
    const now = new Date();

    if (refund.changed("status")) {
      const updates = {};

      if (refund.status === RS.APPROVED) {
        updates.approved_by_id = userId;
        updates.approved_at = now;
      }

      if (refund.status === RS.REJECTED) {
        updates.rejected_by_id = userId;
        updates.rejected_at = now;
      }

      if (refund.status === RS.PROCESSED) {
        updates.processed_by_id = userId;
        updates.processed_at = now;
      }

      if ([RS.CANCELLED, RS.VOIDED, RS.REVERSED].includes(refund.status)) {
        updates.cancelled_by_id = userId;
        updates.cancelled_at = now;
      }

      if (Object.keys(updates).length) {
        await refund.update(updates, {
          transaction: options?.transaction,
          hooks: false,
        });
      }
    }
  });

  return Refund;
};