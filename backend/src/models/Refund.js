// 📁 backend/src/models/Refund.js
import { DataTypes, Model } from "sequelize";
import { REFUND_STATUS } from "../constants/enums.js";
import { recalcInvoice } from "../utils/invoiceUtil.js";

/* ============================================================
   🔖 Local enum map
============================================================ */
const RS = {
  PENDING: REFUND_STATUS[0],
  APPROVED: REFUND_STATUS[1],
  REJECTED: REFUND_STATUS[2],
  PROCESSED: REFUND_STATUS[3],
  CANCELLED: REFUND_STATUS[4],
  REVERSED: REFUND_STATUS[5],
};

export default (sequelize) => {
  class Refund extends Model {
    static associate(models) {
      // 🔹 Parent Payment
      Refund.belongsTo(models.Payment, { as: "payment", foreignKey: "payment_id" });

      // 🔹 Parent Invoice
      Refund.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });

      // 🔹 Patient
      Refund.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });

      // 🔹 Org / Facility
      Refund.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Refund.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Audit (users)
      Refund.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Refund.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Refund.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });

      Refund.belongsTo(models.User, { as: "approvedBy", foreignKey: "approved_by_id" });
      Refund.belongsTo(models.User, { as: "rejectedBy", foreignKey: "rejected_by_id" });
      Refund.belongsTo(models.User, { as: "processedBy", foreignKey: "processed_by_id" });
      Refund.belongsTo(models.User, { as: "cancelledBy", foreignKey: "cancelled_by_id" });

      // 🔹 Linked Transactions
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

      /* ============================================================
         🔗 Foreign Keys (Parent Entities)
      ============================================================ */
      payment_id: { type: DataTypes.UUID, allowNull: false },
      invoice_id: { type: DataTypes.UUID, allowNull: false },
      patient_id: { type: DataTypes.UUID, allowNull: false },

      /* ============================================================
         🏢 Tenant Scope
      ============================================================ */
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      /* ============================================================
         💵 Refund Details
      ============================================================ */
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      reason: { type: DataTypes.TEXT },

      // 🧾 Payment method copied from Payment for summary/reporting
      method: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Copied from payment.method for reporting consistency",
      },

      status: {
        type: DataTypes.ENUM(...REFUND_STATUS),
        allowNull: false,
        defaultValue: RS.PENDING,
      },

      /* ============================================================
         🔹 Lifecycle Audit Fields
      ============================================================ */
      approved_by_id: { type: DataTypes.UUID },
      approved_at: { type: DataTypes.DATE },

      rejected_by_id: { type: DataTypes.UUID },
      rejected_at: { type: DataTypes.DATE },

      processed_by_id: { type: DataTypes.UUID },
      processed_at: { type: DataTypes.DATE },

      cancelled_by_id: { type: DataTypes.UUID },
      cancelled_at: { type: DataTypes.DATE },

      // 🔹 Generic audit
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

      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
      },

      scopes: {
        withDeleted: { paranoid: false },
        pending: { where: { status: RS.PENDING, deleted_at: null } },
        approved: { where: { status: RS.APPROVED, deleted_at: null } },
        rejected: { where: { status: RS.REJECTED, deleted_at: null } },
        processed: { where: { status: RS.PROCESSED, deleted_at: null } },
        cancelled: { where: { status: RS.CANCELLED, deleted_at: null } },
        tenant(facilityId) {
          if (!facilityId) return {};
          return { where: { facility_id: facilityId } };
        },
      },

      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["payment_id"] },
        { fields: ["invoice_id"] },
        { fields: ["patient_id"] },
        { fields: ["status"] },
        { fields: ["method"] }, // ✅ index for summary aggregation
      ],
    }
  );

  /* ============================================================
     🔁 Hooks
  ============================================================ */
  Refund.beforeCreate(async (refund) => {
    const { Payment } = await import("../models/index.js");
    const payment = await Payment.findByPk(refund.payment_id, { include: ["invoice"] });
    if (!payment) throw new Error("Invalid payment_id for refund");

    refund.organization_id = payment.organization_id;
    refund.facility_id = payment.facility_id;
    refund.invoice_id = payment.invoice_id;
    refund.patient_id = payment.invoice?.patient_id || payment.patient_id || null;
    refund.method = payment.method || null; // ✅ Auto-copy method from payment
  });

  Refund.afterUpdate(async (refund, options) => {
    const userId = options?.user?.id || null;
    const now = new Date();

    if (refund.changed("status")) {
      const updates = {};
      if (refund.status === RS.APPROVED)  { updates.approved_by_id  = userId; updates.approved_at  = now; }
      if (refund.status === RS.REJECTED)  { updates.rejected_by_id  = userId; updates.rejected_at  = now; }
      if (refund.status === RS.PROCESSED) { updates.processed_by_id = userId; updates.processed_at = now; }
      if (refund.status === RS.CANCELLED) { updates.cancelled_by_id = userId; updates.cancelled_at = now; }

      if (Object.keys(updates).length) {
        // ✅ Prevent recursion
        await refund.update(updates, { transaction: options?.transaction, hooks: false });
      }
    }

    // 🔁 Auto-recalculate invoice on status change
    if ([RS.APPROVED, RS.PROCESSED].includes(refund.status) && refund.invoice_id) {
      await recalcInvoice(refund.invoice_id, options?.transaction);
    }
  });

  return Refund;
};
