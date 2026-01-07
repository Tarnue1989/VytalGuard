// 📁 models/User.js
import { DataTypes, Model } from "sequelize";
import { USER_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class User extends Model {
    static associate(models) {
      // 🔹 User ⇄ Facility (many-to-many via UserFacility)
      User.belongsToMany(models.Facility, {
        through: models.UserFacility,
        as: "facilities",
        foreignKey: "user_id",
        otherKey: "facility_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // 🔹 User ⇄ Role (many-to-many via UserFacility)
      User.belongsToMany(models.Role, {
        through: models.UserFacility,
        as: "roles",
        foreignKey: "user_id",
        otherKey: "role_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // 🔹 User → UserFacility (one-to-many)
      User.hasMany(models.UserFacility, {
        as: "facilityLinks",
        foreignKey: "user_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // 🔹 User → Employee
      User.hasOne(models.Employee, {
        as: "employee",
        foreignKey: "user_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      // 🔹 User → Organization
      User.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      // 🔹 Audit relationships
      User.belongsTo(models.User, { foreignKey: "created_by_id", as: "createdByUser" });
      User.belongsTo(models.User, { foreignKey: "updated_by_id", as: "updatedByUser" });
      User.belongsTo(models.User, { foreignKey: "deleted_by_id", as: "deletedByUser" });

      // 🔹 User → Permission (indirect via Role → RolePermission)
      //    This gives: user.getPermissions()
      User.belongsToMany(models.Permission, {
        through: {
          model: models.UserFacility,
          unique: false, // because multiple facilities may apply
        },
        foreignKey: "user_id",
        otherKey: "role_id",
        as: "permissionsViaRoles",
      });
    }

    // 🔹 Virtual full name
    get full_name() {
      return [this.first_name, this.last_name].filter(Boolean).join(" ");
    }

    // 🔹 Resolve permissions (collect from all roles)
    async getPermissions() {
      const roles = await this.getRoles({
        include: [{ association: "permissions" }], // Role → Permission
      });

      const permissions = roles.flatMap((r) =>
        r.permissions ? r.permissions.map((p) => p.key) : []
      );

      return [...new Set(permissions)]; // unique keys
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
      },
      email: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      first_name: { type: DataTypes.STRING(150), allowNull: true },
      last_name: { type: DataTypes.STRING(150), allowNull: true },

      // 🔹 Security & reset
      password_reset_token: { type: DataTypes.STRING, allowNull: true },
      password_reset_expiry: { type: DataTypes.DATE, allowNull: true },
      login_attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
      locked_until: { type: DataTypes.DATE, allowNull: true },
      must_reset_password: { type: DataTypes.BOOLEAN, defaultValue: false },

      // 🔹 Status
      status: {
        type: DataTypes.ENUM(...USER_STATUS),
        allowNull: false,
        defaultValue: USER_STATUS[0],
      },
      last_login_at: { type: DataTypes.DATE, allowNull: true },

      // 🔹 Flags
      is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // 🔹 Organization
      organization_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "organizations", key: "id" },
      },

      // 🔹 Token version (for logoutAll / revoke)
      token_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      // 🔹 Audit fields
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id", "password_hash"] },
      },
      scopes: {
        withDeleted: { paranoid: false },
        active: { where: { status: "active" } },

        // 🔹 Facility isolation scope
        byFacility(facilityId) {
          return {
            include: [
              {
                association: "facilityLinks",
                where: { facility_id: facilityId },
                required: true,
              },
            ],
          };
        },

        // 🔹 Organization isolation scope
        byOrganization(orgId) {
          return { where: { organization_id: orgId } };
        },

        // 🔹 Lite scope for dropdowns
        lite: {
          where: { status: "active" },
          attributes: ["id", "username", "email"],
          order: [["username", "ASC"]],
        },
      },
    }
  );

  return User;
};
