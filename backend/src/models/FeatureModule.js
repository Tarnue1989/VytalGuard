// 📁 backend/src/models/FeatureModule.js
import { DataTypes, Model } from "sequelize";
import { FEATURE_MODULE_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class FeatureModule extends Model {
    static associate(models) {
      FeatureModule.belongsToMany(models.Role, {
        through: models.FeatureAccess,
        foreignKey: "module_id",
        otherKey: "role_id",
        as: "roles",
      });

      FeatureModule.hasMany(models.FeatureAccess, {
        foreignKey: "module_id",
        as: "access",
      });

      FeatureModule.belongsTo(models.FeatureModule, {
        foreignKey: "parent_id",
        as: "parent",
      });

      FeatureModule.hasMany(models.FeatureModule, {
        foreignKey: "parent_id",
        as: "children",
      });

      FeatureModule.hasMany(models.MasterItem, {
        foreignKey: "feature_module_id",
        as: "masterItems",
      });

      FeatureModule.belongsTo(models.User, { foreignKey: "created_by_id", as: "createdBy" });
      FeatureModule.belongsTo(models.User, { foreignKey: "updated_by_id", as: "updatedBy" });
      FeatureModule.belongsTo(models.User, { foreignKey: "deleted_by_id", as: "deletedBy" });
    }
  }

  FeatureModule.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },

      name: { type: DataTypes.STRING(150), allowNull: false },

      key: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
        validate: { is: /^[a-z0-9\-_]+$/i },
      },

      icon: DataTypes.STRING(80),
      category: DataTypes.STRING(80),
      description: DataTypes.TEXT,

      tags: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },

      visibility: {
        type: DataTypes.ENUM("public", "private", "hidden"),
        defaultValue: "public",
      },

      enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
      order_index: { type: DataTypes.INTEGER, defaultValue: 0 },

      /* ================= DB-DRIVEN DASHBOARD ================= */
      show_on_dashboard: { type: DataTypes.BOOLEAN, defaultValue: false },

      dashboard_type: {
        type: DataTypes.ENUM(
          "kpi",
          "chart",
          "queue",
          "global_kpi",
          "global_chart",
          "none"
        ),
        defaultValue: "none",
      },

      dashboard_order: { type: DataTypes.INTEGER, defaultValue: 0 },

      /* ================= TENANT SCOPE (CRITICAL) ================= */
      tenant_scope: {
        type: DataTypes.ENUM("global", "org", "facility"),
        allowNull: false,
        defaultValue: "org",
      },

      status: {
        type: DataTypes.ENUM(...FEATURE_MODULE_STATUS),
        allowNull: false,
        defaultValue: FEATURE_MODULE_STATUS[0],
      },

      route: {
        type: DataTypes.STRING,
        validate: { is: /^[a-zA-Z0-9_\-/\.]*$/ },
      },

      parent_id: DataTypes.UUID,
      created_by_id: DataTypes.UUID,
      updated_by_id: DataTypes.UUID,
      deleted_by_id: DataTypes.UUID,
    },
    {
      sequelize,
      modelName: "FeatureModule",
      tableName: "feature_modules",
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
        active: { where: { status: "active", enabled: true } },
        inactive: { where: { status: "inactive" } },
      },

      indexes: [
        { fields: ["key"] },
        { fields: ["category"] },
        { fields: ["tenant_scope"] },
        { fields: ["status"] },
        { fields: ["enabled"] },
        { fields: ["show_on_dashboard"] },
        { fields: ["dashboard_type"] },
        { fields: ["dashboard_order"] },
      ],
    }
  );

  return FeatureModule;
};
