import { DataTypes, Model } from "sequelize";
import {
  BILLABLE_ITEM_STATUS,
  MASTER_ITEM_TYPES,
  BILLING_MODE,
} from "../constants/enums.js";

export default (sequelize) => {
  class BillableItem extends Model {
    static associate(models) {
      // 🔗 Core
      BillableItem.belongsTo(models.MasterItem, {
        as: "masterItem",
        foreignKey: "master_item_id",
      });

      // 🔗 Tenant
      BillableItem.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      BillableItem.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔗 Classification
      BillableItem.belongsTo(models.Department, {
        as: "department",
        foreignKey: "department_id",
      });

      BillableItem.belongsTo(models.MasterItemCategory, {
        as: "category",
        foreignKey: "category_id",
      });

      // 🔥 MULTI-PRICE SUPPORT
      BillableItem.hasMany(models.BillableItemPrice, {
        as: "prices",
        foreignKey: "billable_item_id",
      });

      // 🔹 Audit
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

      /* ================= TENANT ================= */
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      /* ================= LINK ================= */
      master_item_id: { type: DataTypes.UUID, allowNull: false },

      /* ================= CLASSIFICATION ================= */
      department_id: { type: DataTypes.UUID, allowNull: true },
      category_id: { type: DataTypes.UUID, allowNull: true },

      // 🔥 CRITICAL (DENORMALIZED FROM MASTER)
      item_type: {
        type: DataTypes.ENUM(...Object.values(MASTER_ITEM_TYPES)),
        allowNull: false,
      },

      /* ================= IDENTITY ================= */
      name: { type: DataTypes.STRING(150), allowNull: false },
      code: { type: DataTypes.STRING(100) },
      description: { type: DataTypes.TEXT },

      /* ================= BILLING ================= */

      billing_mode: {
        type: DataTypes.ENUM(...Object.values(BILLING_MODE)),
        defaultValue: BILLING_MODE.FIXED,
      },

      /* ================= DEFAULT PRICE (FALLBACK ONLY) ================= */
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },

      currency: {
        type: DataTypes.STRING(10),
        defaultValue: "USD",
      },

      /* ================= FLAGS ================= */
      taxable: { type: DataTypes.BOOLEAN, defaultValue: false },
      discountable: { type: DataTypes.BOOLEAN, defaultValue: true },
      override_allowed: { type: DataTypes.BOOLEAN, defaultValue: true },

      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      /* ================= STATUS ================= */
      status: {
        type: DataTypes.ENUM(...Object.values(BILLABLE_ITEM_STATUS)),
        defaultValue: BILLABLE_ITEM_STATUS.ACTIVE,
      },

      /* ================= AUDIT ================= */
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
     🔥 BEFORE CREATE — SYNC FROM MASTER ITEM
  ============================================================ */
  BillableItem.beforeCreate(async (item, options) => {
    try {
      const { MasterItem } = await import("../models/index.js");

      const master = await MasterItem.findByPk(item.master_item_id, {
        attributes: ["item_type"],
        transaction: options?.transaction,
      });

      if (master) {
        item.item_type = master.item_type;
      }
    } catch (err) {
      console.error("⚠️ beforeCreate sync error:", err.message);
    }
  });

  /* ============================================================
     🔥 AFTER CREATE — AUTO BILLING RULE
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

      if (!triggerFeatureModuleId) return;

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
      console.error("⚠️ afterCreate hook error:", err.message);
    }
  });

  /* ============================================================
     🔥 AFTER UPDATE — SYNC BILLING RULE
  ============================================================ */
  BillableItem.afterUpdate(async (item, options) => {
    try {
      const transaction = options?.transaction;

      const {
        AutoBillingRule,
        MasterItem,
        FeatureModule,
      } = await import("../models/index.js");

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
      console.error("⚠️ afterUpdate hook error:", err.message);
    }
  });

  /* ============================================================
     🔥 AFTER DELETE — DISABLE BILLING RULE
  ============================================================ */
  BillableItem.afterDestroy(async (item, options) => {
    try {
      const { AutoBillingRule } = await import("../models/index.js");

      const rule = await AutoBillingRule.findOne({
        where: { billable_item_id: item.id },
        transaction: options?.transaction,
      });

      if (rule) {
        await rule.update({ status: "inactive" }, { transaction: options?.transaction });
      }
    } catch (err) {
      console.error("⚠️ afterDestroy error:", err.message);
    }
  });

  return BillableItem;
};