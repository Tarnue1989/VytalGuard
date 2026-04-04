// 📁 backend/src/models/CentralStock.js
import { DataTypes, Model } from "sequelize";
import { CENTRAL_STOCK_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class CentralStock extends Model {
    static associate(models) {
      // 🔹 Master Item
      CentralStock.belongsTo(models.MasterItem, { as: "masterItem", foreignKey: "master_item_id" });

      // 🔹 Supplier
      CentralStock.belongsTo(models.Supplier, { as: "supplier", foreignKey: "supplier_id" });

      // 🔹 Tenant scope
      CentralStock.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      CentralStock.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Audit
      CentralStock.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      CentralStock.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      CentralStock.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  CentralStock.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Item + Supplier
      master_item_id: { type: DataTypes.UUID, allowNull: false },
      supplier_id: { type: DataTypes.UUID, allowNull: true },

      // 📦 Batch info
      batch_number: { type: DataTypes.STRING, allowNull: false },
      received_date: { type: DataTypes.DATE, allowNull: false },
      expiry_date: { type: DataTypes.DATE },

      // 📊 Stock counts
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      unit_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      is_locked: { type: DataTypes.BOOLEAN, defaultValue: false },

      // 🔹 Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(CENTRAL_STOCK_STATUS)),
        allowNull: false,
        defaultValue: CENTRAL_STOCK_STATUS.ACTIVE,
      },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "CentralStock",
      tableName: "central_stocks",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      defaultScope: { attributes: { exclude: ["deleted_at", "deleted_by_id"] } },
      scopes: {
        withDeleted: { paranoid: false },
        active: { where: { status: CENTRAL_STOCK_STATUS.ACTIVE } },
        inactive: { where: { status: CENTRAL_STOCK_STATUS.INACTIVE } },
        tenant(facilityId) {
          if (!facilityId) return {}; // superadmin fallback (no filter)
          return { where: { facility_id: facilityId } };
        },
      },

      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["master_item_id"] },
        { fields: ["supplier_id"] },
        { fields: ["batch_number"] },
        { fields: ["received_date"] },
        { fields: ["expiry_date"] },
        { fields: ["status"] },
      ],
      uniqueKeys: {
        unique_stock_batch: {
          fields: [
            "organization_id",
            "facility_id",
            "master_item_id",
            "supplier_id",
            "batch_number",
            "received_date",
          ],
        },
      },
    }
  );

  /* ============================================================
     🔁 Hooks
  ============================================================ */
  CentralStock.beforeCreate((stock) => {
    if (stock.quantity < 0) {
      throw new Error("Quantity cannot be negative");
    }
  });

  CentralStock.beforeUpdate((stock) => {
    if (stock.quantity < 0) {
      throw new Error("Quantity cannot be negative");
    }
  });

  return CentralStock;
};
