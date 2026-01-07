// 📁 backend/src/models/RefundTransaction.js
import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class RefundTransaction extends Model {
    static associate(models) {
      // 🔗 Parent Refund
      RefundTransaction.belongsTo(models.Refund, { as: "refund", foreignKey: "refund_id" });

      // 🔗 Parent Invoice
      RefundTransaction.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });

      // 🔗 Scope
      RefundTransaction.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      RefundTransaction.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });
      RefundTransaction.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });

      // 🔹 Audit (users)
      RefundTransaction.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      RefundTransaction.belongsTo(models.User, { as: "approvedBy", foreignKey: "approved_by_id" });
      RefundTransaction.belongsTo(models.User, { as: "rejectedBy", foreignKey: "rejected_by_id" });
      RefundTransaction.belongsTo(models.User, { as: "processedBy", foreignKey: "processed_by_id" });
      RefundTransaction.belongsTo(models.User, { as: "cancelledBy", foreignKey: "cancelled_by_id" });
      RefundTransaction.belongsTo(models.User, { as: "reversedBy", foreignKey: "reversed_by_id" });
    }
  }

  RefundTransaction.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Parents
      refund_id: { type: DataTypes.UUID, allowNull: false },
      invoice_id: { type: DataTypes.UUID, allowNull: false },   // ✅ added
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      patient_id: { type: DataTypes.UUID, allowNull: false },

      // 💵 Details
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0.01 },
      },
      method: { type: DataTypes.STRING },
      note: { type: DataTypes.TEXT },

      // 🔄 Lifecycle status
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected", "processed", "cancelled", "reversed"),
        allowNull: false,
        defaultValue: "pending",
      },

      // 🔹 Audit fields
      approved_by_id: { type: DataTypes.UUID },
      approved_at: { type: DataTypes.DATE },

      rejected_by_id: { type: DataTypes.UUID },
      rejected_at: { type: DataTypes.DATE },
      reject_reason: { type: DataTypes.TEXT },

      processed_by_id: { type: DataTypes.UUID },
      processed_at: { type: DataTypes.DATE },

      cancelled_by_id: { type: DataTypes.UUID },
      cancelled_at: { type: DataTypes.DATE },

      reversed_by_id: { type: DataTypes.UUID },
      reversed_at: { type: DataTypes.DATE },

      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "RefundTransaction",
      tableName: "refund_transactions",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
      },
      indexes: [
        { fields: ["refund_id"] },
        { fields: ["invoice_id"] },        // ✅ added
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["patient_id"] },
        { fields: ["status"] },
      ],
    }
  );

  return RefundTransaction;
};
