// 📁 backend/src/models/StockRequestItem.js
import { DataTypes, Model } from "sequelize";
import { STOCK_REQUEST_ITEM_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class StockRequestItem extends Model {
    static associate(models) {
      // 🔹 Parent Stock Request
      StockRequestItem.belongsTo(models.StockRequest, {
        as: "stockRequest",
        foreignKey: "stock_request_id",
        onDelete: "CASCADE",   // ✅ ensure cleanup on parent delete
        hooks: true,
      });

      // 🔹 Master Item
      StockRequestItem.belongsTo(models.MasterItem, {
        as: "masterItem",
        foreignKey: "master_item_id",
      });

      // 🔹 Link to CentralStock (batch-based fulfillment)
      StockRequestItem.belongsTo(models.CentralStock, {
        as: "centralStock",
        foreignKey: "central_stock_id",
      });

      // 🔹 Tenant scope
      StockRequestItem.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });
      StockRequestItem.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔹 Audit
      StockRequestItem.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });
      StockRequestItem.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });
      StockRequestItem.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });

      // 🔹 Lifecycle actors
      StockRequestItem.belongsTo(models.User, {
        as: "approvedBy",
        foreignKey: "approved_by_id",
      });
      StockRequestItem.belongsTo(models.User, {
        as: "rejectedBy",
        foreignKey: "rejected_by_id",
      });
      StockRequestItem.belongsTo(models.User, {
        as: "issuedBy",
        foreignKey: "issued_by_id",
      });
      StockRequestItem.belongsTo(models.User, {
        as: "fulfilledBy",
        foreignKey: "fulfilled_by_id",
      });
    }
  }

  StockRequestItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Parent
      stock_request_id: { type: DataTypes.UUID, allowNull: false },
      master_item_id: { type: DataTypes.UUID, allowNull: false },
      central_stock_id: { type: DataTypes.UUID, allowNull: true }, // optional batch link

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 📦 Item details
      quantity: { type: DataTypes.INTEGER, allowNull: false },
      issued_quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      fulfilled_quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM(...Object.values(STOCK_REQUEST_ITEM_STATUS)),
        allowNull: false,
        defaultValue: Object.values(STOCK_REQUEST_ITEM_STATUS)[0], // pending
      },
      remarks: { type: DataTypes.TEXT },

      // 📝 Reasons / Notes
      rejection_reason: { type: DataTypes.TEXT },
      fulfillment_notes: { type: DataTypes.TEXT },

      // ⏱️ Lifecycle
      approved_by_id: { type: DataTypes.UUID },
      approved_at: { type: DataTypes.DATE },
      rejected_by_id: { type: DataTypes.UUID },
      rejected_at: { type: DataTypes.DATE },
      issued_by_id: { type: DataTypes.UUID },
      issued_at: { type: DataTypes.DATE },
      fulfilled_by_id: { type: DataTypes.UUID },
      fulfilled_at: { type: DataTypes.DATE },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "StockRequestItem",
      tableName: "stock_request_items",
      underscored: true,
      paranoid: true, // ✅ soft deletes
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
      },
      scopes: {
        withDeleted: { paranoid: false },
        active: { where: { deleted_at: null } },
        tenant(facilityId) {
          if (!facilityId) return {};
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["stock_request_id"] },
        { fields: ["master_item_id"] },
        { fields: ["central_stock_id"] },
        { fields: ["status"] },
      ],
      uniqueKeys: {
        unique_item_per_request: {
          fields: ["stock_request_id", "master_item_id"],
        },
      },
    }
  );

  /* ============================================================
     🔁 Hooks → validate business rules
  ============================================================ */
  function validateQuantities(item) {
    if (item.quantity <= 0) throw new Error("Quantity must be greater than zero");
    if (item.issued_quantity < 0) throw new Error("Issued quantity cannot be negative");
    if (item.fulfilled_quantity < 0) throw new Error("Fulfilled quantity cannot be negative");
    if (item.issued_quantity > item.quantity)
      throw new Error("Issued quantity cannot exceed requested quantity");
    if (item.fulfilled_quantity > item.issued_quantity)
      throw new Error("Fulfilled quantity cannot exceed issued quantity");
  }

  StockRequestItem.beforeCreate(validateQuantities);
  StockRequestItem.beforeUpdate(validateQuantities);

  return StockRequestItem;
};
