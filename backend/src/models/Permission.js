// 📁 models/Permission.js
import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class Permission extends Model {
    static associate(models) {
      /* ============================================================
         🔗 RELATIONSHIPS
         ============================================================ */

      // 🔹 Permission ⇄ Role (many-to-many via RolePermission)
      Permission.belongsToMany(models.Role, {
        through: models.RolePermission,
        foreignKey: "permission_id",
        otherKey: "role_id",
        as: "roles",
      });

      // 🔹 Permission → FeatureModule (module key linkage)
      //    Allows you to include { model: FeatureModule, as: "featureModule" }
      Permission.belongsTo(models.FeatureModule, {
        foreignKey: "module",
        targetKey: "key",
        as: "featureModule",
      });

      // 🔹 Audit relationships (creator / updater / deleter)
      Permission.belongsTo(models.User, {
        foreignKey: "created_by_id",
        as: "createdBy",
      });
      Permission.belongsTo(models.User, {
        foreignKey: "updated_by_id",
        as: "updatedBy",
      });
      Permission.belongsTo(models.User, {
        foreignKey: "deleted_by_id",
        as: "deletedBy",
      });
    }
  }

  Permission.init(
    {
      /* ============================================================
         🆔 IDENTIFIERS
         ============================================================ */
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      /* ============================================================
         🔑 CORE FIELDS
         ============================================================ */
      key: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
        comment:
          "Unique permission key, e.g. 'appointments:view' or 'invoices:edit'",
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: true,
        comment: "Readable label, e.g. 'View Appointments'",
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: "Optional description of the permission purpose",
      },

      /* ============================================================
         🧩 GROUPING
         ============================================================ */
      module: {
        type: DataTypes.STRING(60),
        allowNull: true,
        comment:
          "Logical module grouping; references FeatureModule.key (e.g. 'appointments', 'billing', 'users')",
      },
      category: {
        type: DataTypes.STRING(60),
        allowNull: true,
        comment:
          "Secondary grouping label, e.g. 'Clinical', 'Finance', 'System', 'User'",
      },
      is_global: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: "Indicates whether this permission is globally available to all tenants",
      },

      /* ============================================================
         🕵️ AUDIT FIELDS
         ============================================================ */
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "Permission",
      tableName: "permissions",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",

      /* ============================================================
         ⚙️ INDEXES + SCOPES
         ============================================================ */
      indexes: [
        { unique: true, fields: ["key"] },
        { fields: ["module"] },
        { fields: ["category"] },
      ],
      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
      },
      scopes: {
        withDeleted: { paranoid: false },
      },
    }
  );

  return Permission;
};
