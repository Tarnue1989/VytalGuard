// 📁 backend/src/models/DepositApplication.js
import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class DepositApplication extends Model {
    static associate(models) {
      DepositApplication.belongsTo(models.Deposit, {
        as: "deposit",
        foreignKey: "deposit_id",
      });
      DepositApplication.belongsTo(models.Invoice, {
        as: "invoice",
        foreignKey: "invoice_id",
      });
      DepositApplication.belongsTo(models.User, {
        as: "appliedBy",
        foreignKey: "applied_by_id",
      });
      // 🔹 Add association for reversal user
      DepositApplication.belongsTo(models.User, {
        as: "reversedBy",
        foreignKey: "reversed_by_id",
      });
    }
  }

  DepositApplication.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      deposit_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      invoice_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      applied_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },

      applied_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      applied_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      // ✅ Reversal tracking
      reversed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      reversed_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      // 🔹 Audit fields
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deleted_at: {
        type: DataTypes.DATE,
      },
    },
    {
      sequelize,
      modelName: "DepositApplication",
      tableName: "deposit_applications",
      paranoid: true,
      underscored: true,
    }
  );

  return DepositApplication;
};
