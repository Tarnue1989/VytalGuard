// 📁 backend/src/models/BillableItemPriceHistory.js
import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class BillableItemPriceHistory extends Model {
    static associate(models) {
      // 🔗 Parent Billable Item
      BillableItemPriceHistory.belongsTo(models.BillableItem, {
        as: "billableItem",
        foreignKey: "billable_item_id",
      });

      // 🔗 Tenant scope
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

      // 🔗 Scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Item
      billable_item_id: { type: DataTypes.UUID, allowNull: false },

      // 💵 Pricing
      old_price: { type: DataTypes.DECIMAL(12, 2) },
      new_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },

      // 💱 Currency tracking
      old_currency: { type: DataTypes.STRING },
      new_currency: { type: DataTypes.STRING },

      // ⏱ Effective from
      effective_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "BillableItemPriceHistory",
      tableName: "billable_item_price_histories",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false, // immutable rows
      paranoid: false,  // immutable rows
      scopes: {
        tenant(facilityId) {
          if (!facilityId) return {}; // superadmin/global
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["billable_item_id"] },
        { fields: ["effective_date"] },
        {
          fields: ["billable_item_id", "effective_date"],
          name: "idx_billable_item_latest_price",
        },
      ],
    }
  );

  return BillableItemPriceHistory;
};
