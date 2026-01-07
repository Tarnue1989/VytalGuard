// 📁 backend/src/models/BillableItem.js
// ============================================================================
// 💰 BillableItem Model (Enterprise Edition)
// 🔹 Auto-integrated with AutoBillingRule (including FeatureModule linkage)
// 🔹 Tracks price history, handles afterCreate/afterUpdate automation
// 🔹 Includes tenant scoping, audit trails, and price sync logic
// ============================================================================

import { DataTypes, Model } from "sequelize";
import { BILLABLE_ITEM_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class BillableItem extends Model {
    static associate(models) {
      // 🔗 Core Links
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

      // 🔗 Optional Overrides
      BillableItem.belongsTo(models.Department, {
        as: "department",
        foreignKey: "department_id",
      });
      BillableItem.belongsTo(models.MasterItemCategory, {
        as: "category",
        foreignKey: "category_id",
      });

      // 🔗 Relations
      BillableItem.hasMany(models.InvoiceItem, {
        as: "invoiceItems",
        foreignKey: "billable_item_id",
      });
      BillableItem.hasMany(models.BillableItemPriceHistory, {
        as: "priceHistory",
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
      BillableItem.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
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

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Master link
      master_item_id: { type: DataTypes.UUID, allowNull: false },

      // 📑 Optional overrides
      department_id: { type: DataTypes.UUID, allowNull: true },
      category_id: { type: DataTypes.UUID, allowNull: true },

      // 📑 Item details
      name: { type: DataTypes.STRING(150), allowNull: false },
      code: { type: DataTypes.STRING(100), allowNull: true },
      description: { type: DataTypes.TEXT },

      // 💵 Pricing
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      currency: { type: DataTypes.STRING(10), defaultValue: "USD" },
      taxable: { type: DataTypes.BOOLEAN, defaultValue: false },
      discountable: { type: DataTypes.BOOLEAN, defaultValue: true },
      override_allowed: { type: DataTypes.BOOLEAN, defaultValue: true },

      status: {
        type: DataTypes.ENUM(...BILLABLE_ITEM_STATUS),
        allowNull: false,
        defaultValue: BILLABLE_ITEM_STATUS[0],
      },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "BillableItem",
      tableName: "billable_items",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      uniqueKeys: {
        unique_price_per_scope: {
          fields: ["organization_id", "facility_id", "master_item_id"],
        },
      },
      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
      },
      scopes: {
        withDeleted: { paranoid: false },
        active: { where: { status: "active", deleted_at: null } },
        inactive: { where: { status: "inactive", deleted_at: null } },
        tenant(facilityId) {
          if (!facilityId) return {};
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["status"] },
        { fields: ["name"] },
        { fields: ["code"] },
        { fields: ["category_id"] },
      ],
    }
  );

  /* ============================================================
     💵 Price History Tracker
  ============================================================ */
  BillableItem.afterUpdate(async (item) => {
    const priceChanged = item.changed("price");
    const currencyChanged = item.changed("currency");
    if (!priceChanged && !currencyChanged) return;

    const oldPrice = item.previous("price");
    const newPrice = item.price;
    const oldCurrency = item.previous("currency");
    const newCurrency = item.currency;
    if (oldPrice === newPrice && oldCurrency === newCurrency) return;

    const { BillableItemPriceHistory } = await import("../models/index.js");
    await BillableItemPriceHistory.create({
      billable_item_id: item.id,
      organization_id: item.organization_id,
      facility_id: item.facility_id,
      old_price: oldPrice,
      new_price: newPrice,
      old_currency: oldCurrency,
      new_currency: newCurrency,
      effective_date: new Date(),
      created_by_id: item.updated_by_id,
    });
  });

  /* ============================================================
     ⚙️ Auto-create AutoBillingRule (with FeatureModule ID)
  ============================================================ */
  BillableItem.afterCreate(async (item, options) => {
    try {
      const { AutoBillingRule, MasterItem, FeatureModule } = await import("../models/index.js");
      const transaction = options?.transaction;

      const exists = await AutoBillingRule.findOne({
        where: { billable_item_id: item.id },
        transaction,
      });
      if (exists) return;

      let triggerModule = "manual";
      let triggerFeatureModuleId = null;

      try {
        const master = await MasterItem.findByPk(item.master_item_id, {
          attributes: ["item_type", "feature_module_id"],
          include: [{ model: FeatureModule, as: "featureModule", attributes: ["id", "key"] }],
          transaction,
        });

        if (master?.feature_module_id) triggerFeatureModuleId = master.feature_module_id;
        if (!triggerFeatureModuleId && master?.featureModule?.id)
          triggerFeatureModuleId = master.featureModule.id;

        if (master?.featureModule?.key)
          triggerModule = master.featureModule.key.replaceAll("_", "-").toLowerCase();
        else if (master?.item_type)
          triggerModule = master.item_type.replaceAll("_", "-").toLowerCase();
      } catch (err) {
        console.warn("⚠️ trigger_module fallback → manual:", err.message);
      }

      await AutoBillingRule.create(
        {
          organization_id: item.organization_id,
          facility_id: item.facility_id,
          billable_item_id: item.id,
          trigger_feature_module_id: triggerFeatureModuleId,
          trigger_module: triggerModule,
          auto_generate: true,
          charge_mode: "fixed",
          default_price: item.price || 0,
          status: "active",
          created_by_id: item.created_by_id || null,
        },
        { transaction }
      );

      console.info(
        `💰 [AutoBillingRule] Auto-created rule for BillableItem="${item.name}" | trigger="${triggerModule}"`
      );
    } catch (err) {
      console.error("⚠️ Failed to auto-create AutoBillingRule:", err.message);
    }
  });

  /* ============================================================
     🔄 Auto-sync AutoBillingRule (trigger + feature + price)
  ============================================================ */
  BillableItem.afterUpdate(async (item, options) => {
    try {
      const { AutoBillingRule, MasterItem, FeatureModule } = await import("../models/index.js");
      const transaction = options?.transaction;

      let rule = await AutoBillingRule.findOne({
        where: { billable_item_id: item.id },
        transaction,
      });

      const master = await MasterItem.findByPk(item.master_item_id, {
        attributes: ["item_type", "feature_module_id"],
        include: [{ model: FeatureModule, as: "featureModule", attributes: ["id", "key"] }],
        transaction,
      });

      let triggerModule = "manual";
      let triggerFeatureModuleId = null;

      if (master?.feature_module_id) triggerFeatureModuleId = master.feature_module_id;
      if (!triggerFeatureModuleId && master?.featureModule?.id)
        triggerFeatureModuleId = master.featureModule.id;

      if (master?.featureModule?.key)
        triggerModule = master.featureModule.key.replaceAll("_", "-").toLowerCase();
      else if (master?.item_type)
        triggerModule = master.item_type.replaceAll("_", "-").toLowerCase();

      if (!rule) {
        await AutoBillingRule.create(
          {
            organization_id: item.organization_id,
            facility_id: item.facility_id,
            billable_item_id: item.id,
            trigger_feature_module_id: triggerFeatureModuleId,
            trigger_module: triggerModule,
            auto_generate: true,
            charge_mode: "fixed",
            default_price: item.price || 0,
            status: "active",
            created_by_id: item.updated_by_id || null,
          },
          { transaction }
        );
        console.info(`💰 [AutoBillingRule] Created missing rule for BillableItem="${item.name}"`);
      } else {
        const updates = {};
        if (rule.trigger_module !== triggerModule) updates.trigger_module = triggerModule;
        if (rule.trigger_feature_module_id !== triggerFeatureModuleId)
          updates.trigger_feature_module_id = triggerFeatureModuleId;
        if (rule.default_price !== item.price) updates.default_price = item.price;

        if (Object.keys(updates).length > 0) {
          await rule.update(updates, { transaction });
          console.info(
            `💰 [AutoBillingRule] Synced rule for BillableItem="${item.name}" | trigger="${triggerModule}"`
          );
        }
      }
    } catch (err) {
      console.error("⚠️ Failed to sync AutoBillingRule:", err.message);
    }
  });

  /* ============================================================
     🚫 Auto-deactivate AutoBillingRule on delete
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
        console.info(`🧹 [AutoBillingRule] Deactivated rule for BillableItem="${item.name}"`);
      }
    } catch (err) {
      console.error("⚠️ Failed to deactivate AutoBillingRule:", err.message);
    }
  });

  return BillableItem;
};
