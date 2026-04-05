import { DataTypes, Model } from "sequelize";
import { PAYER_TYPES, CURRENCY } from "../constants/enums.js";

export default (sequelize) => {
  class BillableItemPrice extends Model {
    static associate(models) {
      // 🔗 Core
      BillableItemPrice.belongsTo(models.BillableItem, {
        as: "billableItem",
        foreignKey: "billable_item_id",
      });

      // 🔗 Tenant
      BillableItemPrice.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      BillableItemPrice.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔹 Audit
      BillableItemPrice.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      BillableItemPrice.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });

      // 🔥 HISTORY LINK
      BillableItemPrice.hasMany(models.BillableItemPriceHistory, {
        as: "history",
        foreignKey: "billable_item_price_id",
      });
    }
  }

  BillableItemPrice.init(
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

      /* ================= LINK ================= */
      billable_item_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      /* ================= PRICING ================= */

      payer_type: {
        type: DataTypes.ENUM(...Object.values(PAYER_TYPES)),
        allowNull: false,
      },

      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },

      is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      /* ================= AUDIT ================= */
      created_by_id: DataTypes.UUID,
      updated_by_id: DataTypes.UUID,
      deleted_by_id: DataTypes.UUID,
    },
    {
      sequelize,
      modelName: "BillableItemPrice",
      tableName: "billable_item_prices",
      paranoid: true,
      underscored: true,

      indexes: [
        { fields: ["billable_item_id"] },
        { fields: ["payer_type"] },
        { fields: ["currency"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },

        // 🔥 Prevent duplicates per payer + currency
        {
          unique: true,
          fields: ["billable_item_id", "payer_type", "currency"],
        },
      ],
    }
  );

  /* ============================================================
     🔥 AFTER UPDATE — CREATE PRICE HISTORY (MULTI-CURRENCY SAFE)
  ============================================================ */
  BillableItemPrice.afterUpdate(async (item, options) => {
    try {
      const transaction = options?.transaction;

      const { BillableItemPriceHistory } = await import("../models/index.js");

      const priceChanged = item.changed("price");
      const currencyChanged = item.changed("currency");

      if (!priceChanged && !currencyChanged) return;

      // 🔥 DETERMINE CHANGE TYPE
      let changeType = "price_update";
      if (priceChanged && currencyChanged) changeType = "both";
      else if (currencyChanged) changeType = "currency_update";

      await BillableItemPriceHistory.create(
        {
          organization_id: item.organization_id,
          facility_id: item.facility_id,

          // 🔥 CRITICAL LINKS
          billable_item_id: item.billable_item_id,
          billable_item_price_id: item.id,

          payer_type: item.payer_type,
          currency: item.currency,

          old_price: item.previous("price"),
          new_price: item.price,

          change_type: changeType,

          effective_date: new Date(),
          created_by_id: item.updated_by_id,
        },
        { transaction }
      );
    } catch (err) {
      console.error("⚠️ Price history hook error:", err.message);
    }
  });

  return BillableItemPrice;
};