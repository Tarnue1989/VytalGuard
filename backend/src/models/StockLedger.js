// 📁 backend/src/models/StockLedger.js
import { DataTypes, Model } from "sequelize";
import { STOCK_LEDGER_TYPE } from "../constants/enums.js";

export default (sequelize) => {
  class StockLedger extends Model {
    static associate(models) {
      // 🔗 Core references
      StockLedger.belongsTo(models.MasterItem, { as: "masterItem", foreignKey: "master_item_id" });
      StockLedger.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      StockLedger.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });
      StockLedger.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });

      // 🔗 Related transactions
      StockLedger.belongsTo(models.CentralStock, { as: "centralStock", foreignKey: "central_stock_id" });
      StockLedger.belongsTo(models.StockRequest, { as: "stockRequest", foreignKey: "stock_request_id" });
      StockLedger.belongsTo(models.StockRequestItem, { as: "stockRequestItem", foreignKey: "stock_request_item_id" });
      StockLedger.belongsTo(models.StockAdjustment, { as: "stockAdjustment", foreignKey: "stock_adjustment_id" });

      // 🔗 Audit
      StockLedger.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
    }
  }

  StockLedger.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID, allowNull: true },

      // 🔗 Source entities
      master_item_id: { type: DataTypes.UUID, allowNull: false },
      central_stock_id: { type: DataTypes.UUID },
      stock_request_id: { type: DataTypes.UUID },
      stock_request_item_id: { type: DataTypes.UUID },
      stock_adjustment_id: { type: DataTypes.UUID },

      // 📑 Ledger entry
      ledger_type: {
        type: DataTypes.ENUM(...Object.values(STOCK_LEDGER_TYPE)),
        allowNull: false,
      },
      quantity: { type: DataTypes.INTEGER, allowNull: false },
      balance_after: { type: DataTypes.INTEGER },
      note: { type: DataTypes.TEXT },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "StockLedger",
      tableName: "stock_ledgers",
      underscored: true,
      timestamps: true,
      paranoid: false, // ✅ Ledger should never be deleted
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["department_id"] },
        { fields: ["master_item_id"] },
        { fields: ["ledger_type"] },
      ],
    }
  );

  return StockLedger;
};
