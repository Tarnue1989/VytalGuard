import { DataTypes, Model } from "sequelize";
import { PAYER_TYPES, CURRENCY } from "../constants/enums.js";

export default (sequelize) => {
  class BillableItemPriceHistory extends Model {
    static associate(models) {
      // 🔗 Link to price row
      BillableItemPriceHistory.belongsTo(models.BillableItemPrice, {
        as: "price",
        foreignKey: "billable_item_price_id",
      });

      // 🔗 Direct link to billable item (🔥 CRITICAL ADD)
      BillableItemPriceHistory.belongsTo(models.BillableItem, {
        as: "billableItem",
        foreignKey: "billable_item_id",
      });

      // 🔗 Tenant
      BillableItemPriceHistory.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      BillableItemPriceHistory.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔹 Audit
      BillableItemPriceHistory.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });
    }
  }

  BillableItemPriceHistory.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      /* ================= TENANT ================= */
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      facility_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      /* ================= LINKS ================= */

      // 🔥 CRITICAL (NEW)
      billable_item_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      billable_item_price_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      /* ================= PRICING CONTEXT ================= */

      payer_type: {
        type: DataTypes.ENUM(...Object.values(PAYER_TYPES)),
        allowNull: false,
      },

      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      /* ================= PRICE ================= */

      old_price: {
        type: DataTypes.DECIMAL(12, 2),
      },

      new_price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },

      /* ================= CHANGE TYPE (🔥 NEW) ================= */

      change_type: {
        type: DataTypes.ENUM("price_update", "currency_update", "both"),
        allowNull: false,
        defaultValue: "price_update",
      },

      /* ================= TIMING ================= */

      effective_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      /* ================= AUDIT ================= */

      created_by_id: {
        type: DataTypes.UUID,
      },
    },
    {
      sequelize,
      modelName: "BillableItemPriceHistory",
      tableName: "billable_item_price_histories",
      underscored: true,

      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,

      paranoid: false,

      indexes: [
        { fields: ["billable_item_id"] }, // 🔥 NEW (important for queries)
        { fields: ["billable_item_price_id"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["effective_date"] },
      ],
    }
  );

  return BillableItemPriceHistory;
};