// 📁 models/UserFacility.js
import { DataTypes, Model } from "sequelize";
import { USER_FACILITY_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class UserFacility extends Model {
    static associate(models) {
      // 🔹 Relationships
      UserFacility.belongsTo(models.User, {
        as: "user",
        foreignKey: "user_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      UserFacility.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      UserFacility.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      UserFacility.belongsTo(models.Role, {
        as: "role",
        foreignKey: "role_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      // 🔹 Audit relationships
      UserFacility.belongsTo(models.User, { foreignKey: "created_by_id", as: "createdBy" });
      UserFacility.belongsTo(models.User, { foreignKey: "updated_by_id", as: "updatedBy" });
      UserFacility.belongsTo(models.User, { foreignKey: "deleted_by_id", as: "deletedBy" });
    }
  }

  UserFacility.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },
      user_id: { type: DataTypes.UUID, allowNull: false },

      // 🔹 Org-level links (Org Owner)
      organization_id: { type: DataTypes.UUID, allowNull: true },

      // 🔹 Facility-level links (Admins, Heads, Managers, Staff)
      facility_id: { type: DataTypes.UUID, allowNull: true },

      role_id: { type: DataTypes.UUID, allowNull: true },

      is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      is_active: {
        type: DataTypes.ENUM(...USER_FACILITY_STATUS),
        allowNull: false,
        defaultValue: "active",
      },

      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "UserFacility",
      tableName: "user_facilities",
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
        active: { where: { is_active: "active" } },
        inactive: { where: { is_active: "inactive" } },
        byFacility(facilityId) {
          return { where: { facility_id: facilityId } };
        },
        byOrganization(orgId) {
          return { where: { organization_id: orgId } };
        },
      },
    }
  );

  return UserFacility;
};
