// 📁 backend/src/models/RefundDepositTransaction.js
import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class RefundDepositTransaction extends Model {
    static associate(models) {
      // 🔗 Parent RefundDeposit
      RefundDepositTransaction.belongsTo(models.RefundDeposit, {
        as: "refundDeposit",
        foreignKey: "refund_deposit_id",
      });

      // 🔗 Parent Deposit
      RefundDepositTransaction.belongsTo(models.Deposit, {
        as: "deposit",
        foreignKey: "deposit_id",
      });

      // 🔗 Scope
      RefundDepositTransaction.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      RefundDepositTransaction.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      RefundDepositTransaction.belongsTo(models.Patient, {
        as: "patient",
        foreignKey: "patient_id",
      });

      // 🔹 Audit (users)
      RefundDepositTransaction.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      RefundDepositTransaction.belongsTo(models.User, {
        as: "reversedBy",
        foreignKey: "reversed_by_id",
      });
    }
  }

  RefundDepositTransaction.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },

      // 🔗 Parents
      refund_deposit_id: { type: DataTypes.UUID, allowNull: false },
      deposit_id: { type: DataTypes.UUID, allowNull: false },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      patient_id: { type: DataTypes.UUID, allowNull: false },

      // 💵 Details
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0.01 },
      },

      method: { type: DataTypes.STRING, allowNull: true },
      note: { type: DataTypes.TEXT },

      // 🔄 Lifecycle status (deposit refund transaction)
      status: {
        type: DataTypes.ENUM(
          "created",
          "processed",
          "reversed"
        ),
        allowNull: false,
        defaultValue: "created",
      },

      // 🔹 Audit
      created_by_id: DataTypes.UUID,
      reversed_by_id: DataTypes.UUID,

      created_at: { type: DataTypes.DATE },
      updated_at: { type: DataTypes.DATE },
      reversed_at: { type: DataTypes.DATE },
      deleted_at: { type: DataTypes.DATE },
      deleted_by_id: DataTypes.UUID,
    },
    {
      sequelize,
      modelName: "RefundDepositTransaction",
      tableName: "refund_deposit_transactions",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",

      indexes: [
        { fields: ["refund_deposit_id"] },
        { fields: ["deposit_id"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["patient_id"] },
        { fields: ["status"] },
      ],
    }
  );

  return RefundDepositTransaction;
};
