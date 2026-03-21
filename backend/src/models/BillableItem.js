// 📁 backend/src/models/BillableItem.js
import { DataTypes, Model } from "sequelize";
import { BILLABLE_ITEM_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class BillableItem extends Model {
    static associate(models) {
      BillableItem.belongsTo(models.MasterItem, {
        as: "masterItem",
        foreignKey: "master_item_id",
      });
      BillableItem.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });
      BillableItem.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      BillableItem.belongsTo(models.Department, {
        as: "department",
        foreignKey: "department_id",
      });
      BillableItem.belongsTo(models.MasterItemCategory, {
        as: "category",
        foreignKey: "category_id",
      });

      BillableItem.hasMany(models.BillableItemPriceHistory, {
        as: "priceHistory",
        foreignKey: "billable_item_id",
      });

      BillableItem.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });
      BillableItem.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });
    }
  }

  BillableItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      master_item_id: { type: DataTypes.UUID, allowNull: false },

      department_id: { type: DataTypes.UUID, allowNull: true },
      category_id: { type: DataTypes.UUID, allowNull: true },

      name: { type: DataTypes.STRING(150), allowNull: false },
      code: { type: DataTypes.STRING(100) },
      description: { type: DataTypes.TEXT },

      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      currency: { type: DataTypes.STRING(10), defaultValue: "USD" },

      taxable: { type: DataTypes.BOOLEAN, defaultValue: false },
      discountable: { type: DataTypes.BOOLEAN, defaultValue: true },
      override_allowed: { type: DataTypes.BOOLEAN, defaultValue: true },

      status: {
        type: DataTypes.ENUM(...BILLABLE_ITEM_STATUS),
        defaultValue: BILLABLE_ITEM_STATUS[0],
      },

      created_by_id: DataTypes.UUID,
      updated_by_id: DataTypes.UUID,
      deleted_by_id: DataTypes.UUID,
    },
    {
      sequelize,
      modelName: "BillableItem",
      tableName: "billable_items",
      paranoid: true,
      underscored: true,
    }
  );

  /* ============================================================
     ✅ SAFE AFTER CREATE
  ============================================================ */
  BillableItem.afterCreate(async (item, options) => {
    try {
      const transaction = options?.transaction;

      const {
        AutoBillingRule,
        MasterItem,
        FeatureModule,
      } = await import("../models/index.js");

      const exists = await AutoBillingRule.findOne({
        where: { billable_item_id: item.id },
        transaction,
      });
      if (exists) return;

      const master = await MasterItem.findByPk(item.master_item_id, {
        attributes: ["feature_module_id"],
        include: [
          {
            model: FeatureModule,
            as: "featureModule",
            attributes: ["id"],
          },
        ],
        transaction,
      });

      const triggerFeatureModuleId =
        master?.feature_module_id ||
        master?.featureModule?.id ||
        null;

      /* 🔥 SAFETY GUARD */
      if (!triggerFeatureModuleId) {
        console.warn(
          `⚠️ Skip AutoBillingRule create (no feature module) item=${item.id}`
        );
        return;
      }

      await AutoBillingRule.create(
        {
          organization_id: item.organization_id,
          facility_id: item.facility_id,
          billable_item_id: item.id,
          trigger_feature_module_id: triggerFeatureModuleId,
          auto_generate: true,
          charge_mode: "fixed",
          default_price: item.price || 0,
          status: "active",
          created_by_id: item.created_by_id || null,
        },
        { transaction }
      );

    } catch (err) {
      console.error("⚠️ afterCreate hook error (IGNORED):", err.message);
    }
  });

  /* ============================================================
     ✅ SINGLE SAFE AFTER UPDATE
  ============================================================ */
  BillableItem.afterUpdate(async (item, options) => {
    try {
      const transaction = options?.transaction;

      const {
        BillableItemPriceHistory,
        AutoBillingRule,
        MasterItem,
        FeatureModule,
      } = await import("../models/index.js");

      /* ================= PRICE HISTORY ================= */
      const priceChanged = item.changed("price");
      const currencyChanged = item.changed("currency");

      if (priceChanged || currencyChanged) {
        await BillableItemPriceHistory.create(
          {
            billable_item_id: item.id,
            organization_id: item.organization_id,
            facility_id: item.facility_id,
            old_price: item.previous("price"),
            new_price: item.price,
            old_currency: item.previous("currency"),
            new_currency: item.currency,
            effective_date: new Date(),
            created_by_id: item.updated_by_id,
          },
          { transaction }
        );
      }

      /* ================= AUTO BILLING ================= */
      let rule = await AutoBillingRule.findOne({
        where: { billable_item_id: item.id },
        transaction,
      });

      const master = await MasterItem.findByPk(item.master_item_id, {
        attributes: ["feature_module_id"],
        include: [
          {
            model: FeatureModule,
            as: "featureModule",
            attributes: ["id"],
          },
        ],
        transaction,
      });

      const triggerFeatureModuleId =
        master?.feature_module_id ||
        master?.featureModule?.id ||
        null;

      if (!triggerFeatureModuleId) return;

      if (!rule) {
        await AutoBillingRule.create(
          {
            organization_id: item.organization_id,
            facility_id: item.facility_id,
            billable_item_id: item.id,
            trigger_feature_module_id: triggerFeatureModuleId,
            auto_generate: true,
            charge_mode: "fixed",
            default_price: item.price || 0,
            status: "active",
            created_by_id: item.updated_by_id || null,
          },
          { transaction }
        );
      } else {
        const updates = {};

        if (rule.default_price !== item.price) {
          updates.default_price = item.price;
        }

        if (rule.trigger_feature_module_id !== triggerFeatureModuleId) {
          updates.trigger_feature_module_id = triggerFeatureModuleId;
        }

        if (Object.keys(updates).length > 0) {
          await rule.update(updates, { transaction });
        }
      }

    } catch (err) {
      console.error("⚠️ afterUpdate hook error (IGNORED):", err.message);
    }
  });

  /* ============================================================
     ✅ SAFE DELETE
  ============================================================ */
  BillableItem.afterDestroy(async (item, options) => {
    try {
      const { AutoBillingRule } = await import("../models/index.js");
      const transaction = options?.transaction;

      const rule = await AutoBillingRule.findOne({
        where: { billable_item_id: item.id },
        transaction,
      });

      if (rule) {
        await rule.update({ status: "inactive" }, { transaction });
      }
    } catch (err) {
      console.error("⚠️ afterDestroy error:", err.message);
    }
  });

  return BillableItem;
};