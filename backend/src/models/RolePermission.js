// 📁 models/RolePermission.js
import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class RolePermission extends Model {
    static associate(models) {
      // 🔹 RolePermission → Role
      RolePermission.belongsTo(models.Role, {
        foreignKey: "role_id",
        as: "role",
      });

      // 🔹 RolePermission → Permission
      RolePermission.belongsTo(models.Permission, {
        foreignKey: "permission_id",
        as: "permission",
      });

      // 🔹 Tenant context (Organization / Facility)
      RolePermission.belongsTo(models.Organization, {
        foreignKey: "organization_id",
        as: "organization",
      });
      RolePermission.belongsTo(models.Facility, {
        foreignKey: "facility_id",
        as: "facility",
      });

      // 🔹 Audit relationships
      RolePermission.belongsTo(models.User, {
        foreignKey: "created_by_id",
        as: "createdBy",
      });
      RolePermission.belongsTo(models.User, {
        foreignKey: "updated_by_id",
        as: "updatedBy",
      });
      RolePermission.belongsTo(models.User, {
        foreignKey: "deleted_by_id",
        as: "deletedBy",
      });
    }
  }

  RolePermission.init(
    {
      // 🆔 Primary Key
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Foreign Keys
      role_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      permission_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      // 🏢 Tenant Context
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      facility_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      // 🧾 Audit Fields
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "RolePermission",
      tableName: "role_permissions",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",

      // ✅ Indexes + Constraints
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        {
          unique: true,
          fields: ["role_id", "permission_id", "organization_id", "facility_id"],
          name: "uniq_role_perm_org_fac",
        },
      ],

      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
      },
      scopes: {
        withDeleted: { paranoid: false },
      },
    }
  );

  return RolePermission;
};
