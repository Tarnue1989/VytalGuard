// 📁 backend/src/models/StockAdjustment.js
import { DataTypes, Model } from "sequelize";
import { ADJUSTMENT_TYPES, STOCK_ADJUSTMENT_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class StockAdjustment extends Model {
    static associate(models) {
      // 🔹 Link to Central Stock
      StockAdjustment.belongsTo(models.CentralStock, { as: "centralStock", foreignKey: "central_stock_id" });

      // 🔹 Tenant scope
      StockAdjustment.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      StockAdjustment.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Audit trail
      StockAdjustment.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      StockAdjustment.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      StockAdjustment.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });

      // ✅ Approval user
      StockAdjustment.belongsTo(models.User, { as: "approvedBy", foreignKey: "approved_by_id" });
    }
  }

  StockAdjustment.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Links
      central_stock_id: { type: DataTypes.UUID, allowNull: false },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      // 🔹 Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(STOCK_ADJUSTMENT_STATUS)),
        allowNull: false,
        defaultValue: STOCK_ADJUSTMENT_STATUS.DRAFT,
      },

      // ⚖️ Adjustment details
      adjustment_type: {
        type: DataTypes.ENUM(...Object.values(ADJUSTMENT_TYPES)),
        allowNull: false,
      },
      quantity: { type: DataTypes.INTEGER, allowNull: false },
      reason: { type: DataTypes.TEXT },



      // ✅ Approval
      approved_by_id: { type: DataTypes.UUID, allowNull: true },
      approved_at: { type: DataTypes.DATE },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "StockAdjustment",
      tableName: "stock_adjustments",
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
        active: { where: { deleted_at: null } },

        // 🔑 Tenant scope → required for setTenantScope
        tenant(facilityId) {
          if (!facilityId) return {}; // safeguard superadmin case
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["central_stock_id"] },
        { fields: ["adjustment_type"] },
        { fields: ["status"] },
      ],
    }
  );

  /* ============================================================
     🔁 Hooks
  ============================================================ */
  StockAdjustment.afterUpdate(async (adjustment, options) => {
    if (
      adjustment.changed("status") &&
      adjustment.status === "approved" &&
      adjustment.approved_at &&
      adjustment.approved_by_id
    ) {
      const db = require("../models");
      const t = options.transaction || (await db.sequelize.transaction());

      try {
        const stock = await db.CentralStock.findByPk(adjustment.central_stock_id, { transaction: t });
        if (!stock) throw new Error("CentralStock not found for adjustment");

        let newQty = stock.quantity;

        if (adjustment.adjustment_type === "increase") {
          newQty += adjustment.quantity;
        } else if (adjustment.adjustment_type === "decrease") {
          if (stock.quantity < adjustment.quantity) {
            throw new Error("Cannot decrease stock below available quantity");
          }
          newQty -= adjustment.quantity;
        } else {
          throw new Error("Unknown adjustment_type");
        }

        await stock.update({ quantity: newQty }, { transaction: t });

        if (!options.transaction) await t.commit();
      } catch (err) {
        if (!options.transaction) await t.rollback();
        throw err;
      }
    }
  });

  return StockAdjustment;
};
