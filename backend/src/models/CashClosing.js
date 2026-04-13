// 📁 backend/src/models/CashClosing.js
import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class CashClosing extends Model {
    static associate(models) {
      CashClosing.belongsTo(models.Account, { as: "account", foreignKey: "account_id" });

      CashClosing.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      CashClosing.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      CashClosing.belongsTo(models.User, { as: "closedBy", foreignKey: "closed_by_id" });
    }
  }

  CashClosing.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      account_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      opening_balance: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
      },

      closing_balance: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
      },

      total_in: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
      },

      total_out: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
      },

      is_locked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID },

      closed_by_id: DataTypes.UUID,
      closed_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "CashClosing",
      tableName: "cash_closing",
      underscored: true,
      paranoid: true,
      timestamps: true,
    }
  );

  return CashClosing;
};