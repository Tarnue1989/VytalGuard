// 📁 backend/src/models/StockReturn.js
import { DataTypes, Model } from "sequelize";
import { STOCK_RETURN_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class StockReturn extends Model {
    static associate(models) {
      StockReturn.belongsTo(models.MasterItem, { as: "masterItem", foreignKey: "master_item_id" });
      StockReturn.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
      StockReturn.belongsTo(models.CentralStock, { as: "centralStock", foreignKey: "central_stock_id" });

      // 🔗 Tenant scope
      StockReturn.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      StockReturn.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Audit
      StockReturn.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      StockReturn.belongsTo(models.User, { as: "approvedBy", foreignKey: "approved_by_id" });
    }
  }

  StockReturn.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Item references
      master_item_id: { type: DataTypes.UUID, allowNull: false },
      central_stock_id: { type: DataTypes.UUID },

      // 📦 Return details
      quantity: { type: DataTypes.INTEGER, allowNull: false },
      reason: { type: DataTypes.TEXT },

      // 📌 Status
      status: {
        type: DataTypes.ENUM(...Object.values(STOCK_RETURN_STATUS)),
        allowNull: false,
        defaultValue: Object.values(STOCK_RETURN_STATUS)[0],
      },

      // 🔹 Lifecycle
      approved_by_id: { type: DataTypes.UUID },
      approved_at: { type: DataTypes.DATE },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "StockReturn",
      tableName: "stock_returns",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["department_id"] },
        { fields: ["master_item_id"] },
        { fields: ["status"] },
      ],
    }
  );

  return StockReturn;
};
