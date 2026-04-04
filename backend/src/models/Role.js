// 📁 models/Role.js
import { DataTypes, Model } from "sequelize";
import { ROLE_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Role extends Model {
    static associate(models) {
      // 🔹 Role → Facility
      Role.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // 🔹 Role → Organization (if org-wide role)
      Role.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // 🔹 Role → UserFacility (one-to-many)
      Role.hasMany(models.UserFacility, {
        as: "userAssignments",
        foreignKey: "role_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      // 🔹 Role ⇄ FeatureModule (many-to-many via FeatureAccess)
      Role.belongsToMany(models.FeatureModule, {
        through: models.FeatureAccess,
        foreignKey: "role_id",
        otherKey: "module_id",
        as: "modules",
      });

      // 🔹 Role ⇄ Permission (many-to-many via RolePermission)
      Role.belongsToMany(models.Permission, {
        through: models.RolePermission,
        foreignKey: "role_id",
        otherKey: "permission_id",
        as: "permissions",
      });

      // 🔹 Audit relationships
      Role.belongsTo(models.User, { foreignKey: "created_by_id", as: "createdBy" });
      Role.belongsTo(models.User, { foreignKey: "updated_by_id", as: "updatedBy" });
      Role.belongsTo(models.User, { foreignKey: "deleted_by_id", as: "deletedBy" });
    }
  }

  Role.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      facility_id: { type: DataTypes.UUID, allowNull: true },
      organization_id: { type: DataTypes.UUID, allowNull: true },

      name: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      description: { type: DataTypes.TEXT, allowNull: true },

      role_type: {
        type: DataTypes.ENUM("system", "custom"),
        allowNull: false,
        defaultValue: "custom",
      },

      status: {
        type: DataTypes.ENUM(...Object.values(ROLE_STATUS)),
        allowNull: false,
        defaultValue: ROLE_STATUS.ACTIVE,
      },
      is_system: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.role_type === "system";
        },
      },

      // ✅ Org Owner can decide if role must always be tied to a facility
      requires_facility: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },



      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "Role",
      tableName: "roles",
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
        systemRoles: { where: { role_type: "system" } },
        nonSystemRoles: { where: { role_type: "custom" } },
        active: { where: { status: "active" } },
        inactive: { where: { status: "inactive" } },

        // 🔑 Tenant scope for setTenantScope()
        tenant(facilityId) {
          if (!facilityId) return {}; // safeguard
          return { where: { facility_id: facilityId } };
        },
      },
    }
  );

  return Role;
};
