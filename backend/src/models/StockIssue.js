// 📁 backend/src/models/StockIssue.js
import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class StockIssue extends Model {
    static associate(models) {
      // 🔹 Link to request item + request
      StockIssue.belongsTo(models.StockRequestItem, {
        as: "stockRequestItem",
        foreignKey: "stock_request_item_id",
      });
      StockIssue.belongsTo(models.StockRequest, {
        as: "stockRequest",
        foreignKey: "stock_request_id",
      });

      // 🔹 Link to CentralStock (batch)
      StockIssue.belongsTo(models.CentralStock, {
        as: "centralStock",
        foreignKey: "central_stock_id",
      });

      // 🔹 Master item (redundant but useful for reporting)
      StockIssue.belongsTo(models.MasterItem, {
        as: "masterItem",
        foreignKey: "master_item_id",
      });

      // 🔹 Tenant scope
      StockIssue.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });
      StockIssue.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });
      StockIssue.belongsTo(models.Department, {
        as: "department",
        foreignKey: "department_id",
      });

      // 🔹 Audit
      StockIssue.belongsTo(models.User, {
        as: "issuedBy",
        foreignKey: "issued_by_id",
      });
      StockIssue.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });
      StockIssue.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });
    }
  }

  StockIssue.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 References
      stock_request_id: { type: DataTypes.UUID, allowNull: false },
      stock_request_item_id: { type: DataTypes.UUID, allowNull: false },
      central_stock_id: { type: DataTypes.UUID, allowNull: false },
      master_item_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Tenant
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID, allowNull: false },

      // 📦 Issued details
      quantity: { type: DataTypes.INTEGER, allowNull: false },

      // ⏱️ Lifecycle
      issued_by_id: { type: DataTypes.UUID },
      issued_at: { type: DataTypes.DATE },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "StockIssue",
      tableName: "stock_issues",
      underscored: true,
      paranoid: false, // ✅ no soft delete, always permanent
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["department_id"] },
        { fields: ["stock_request_id"] },
        { fields: ["stock_request_item_id"] },
        { fields: ["central_stock_id"] },
        { fields: ["master_item_id"] },
      ],
    }
  );

  return StockIssue;
};
