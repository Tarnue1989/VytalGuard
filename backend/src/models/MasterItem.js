// 📁 backend/src/models/MasterItem.js
import { DataTypes, Model } from "sequelize";
import { MASTER_ITEM_TYPES, MASTER_ITEM_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class MasterItem extends Model {
    static associate(models) {
      // 🔗 Classification and Ownership
      MasterItem.belongsTo(models.MasterItemCategory, {
        as: "category",
        foreignKey: "category_id",
      });
      MasterItem.belongsTo(models.Department, {
        as: "department",
        foreignKey: "department_id",
      });
      MasterItem.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });
      MasterItem.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔗 Module link (NEW)
      MasterItem.belongsTo(models.FeatureModule, {
        as: "featureModule",
        foreignKey: "feature_module_id",
      });

      // 🔗 Billing relations
      MasterItem.hasMany(models.BillableItem, {
        as: "billableItems",
        foreignKey: "master_item_id",
      });

      // 🔹 Audit
      MasterItem.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      MasterItem.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      MasterItem.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  MasterItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: true },

      // 📑 Identity
      name: { type: DataTypes.STRING(150), allowNull: false },
      code: { type: DataTypes.STRING(50), allowNull: true },
      description: { type: DataTypes.TEXT },

      // 🔗 Classification
      item_type: {
        type: DataTypes.ENUM(...Object.values(MASTER_ITEM_TYPES)),
        allowNull: false,
      },
      category_id: { type: DataTypes.UUID },
      department_id: { type: DataTypes.UUID },

      // 🧩 NEW → Link to feature module
      feature_module_id: { type: DataTypes.UUID, allowNull: true },

      // 💊 Medical attributes
      generic_group: { type: DataTypes.STRING },
      strength: { type: DataTypes.STRING },
      dosage_form: { type: DataTypes.STRING },
      unit: { type: DataTypes.STRING, defaultValue: "pcs" },

      // 📦 Inventory attributes
      reorder_level: { type: DataTypes.INTEGER, defaultValue: 0 },
      is_controlled: { type: DataTypes.BOOLEAN, defaultValue: false },
      sample_required: { type: DataTypes.BOOLEAN, defaultValue: false },
      test_method: { type: DataTypes.STRING },

      // 💵 Reference price
      reference_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      currency: { type: DataTypes.STRING, defaultValue: "USD" },

      // 🔹 Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(MASTER_ITEM_STATUS)),
        allowNull: false,
        defaultValue: MASTER_ITEM_STATUS.ACTIVE,
      },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "MasterItem",
      tableName: "master_items",
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
        tenant(facilityId) {
          if (!facilityId) return {};
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["item_type"] },
        { fields: ["feature_module_id"] }, // ✅ added for faster joins
        { fields: ["name"] },
        { fields: ["code"] },
        { fields: ["category_id"] },
        { fields: ["department_id"] },
        { fields: ["status"] },
      ],
      uniqueKeys: {
        unique_item_per_org: {
          fields: ["organization_id", "facility_id", "name", "strength", "category_id"],
        },
      },
    }
  );

  return MasterItem;
};
