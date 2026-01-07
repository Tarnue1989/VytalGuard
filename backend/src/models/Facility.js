// 📁 backend/src/models/Facility.js
import { DataTypes, Model } from "sequelize";
import { FACILITY_STATUS } from "../constants/enums.js"; // adjust path if needed

export default (sequelize) => {
  class Facility extends Model {
    static associate(models) {
      // 🔹 Facility → Organization (many facilities belong to one organization)
      Facility.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      // 🔹 Facility ⇄ User (many-to-many via UserFacility)
      Facility.belongsToMany(models.User, {
        through: models.UserFacility,
        as: "users",
        foreignKey: "facility_id",
        otherKey: "user_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // 🔹 Facility → UserFacility (one-to-many)
      Facility.hasMany(models.UserFacility, {
        as: "userLinks",
        foreignKey: "facility_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // 🔹 Audit relationships (standardized aliases)
      Facility.belongsTo(models.User, {
        foreignKey: "created_by_id",
        as: "createdBy",
      });
      Facility.belongsTo(models.User, {
        foreignKey: "updated_by_id",
        as: "updatedBy",
      });
      Facility.belongsTo(models.User, {
        foreignKey: "deleted_by_id",
        as: "deletedBy",
      });
    }
  }

  Facility.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      address: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(120),
        allowNull: true,
        validate: {
          isEmailOrEmpty(value) {
            // ✅ Only validate if non-empty
            if (
              value &&
              value.trim() !== "" &&
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
            ) {
              throw new Error("Invalid email format");
            }
          },
        },
      },
      status: {
        type: DataTypes.ENUM(...FACILITY_STATUS),
        allowNull: false,
        defaultValue: FACILITY_STATUS[0], // usually "active"
      },
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "Facility",
      tableName: "facilities",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
        where: {}, // 🔑 can be overridden dynamically
      },
      scopes: {
        withDeleted: { paranoid: false },
        active: { where: { status: "active" } },
        inactive: { where: { status: "inactive" } },

        // 🔑 Tenant scope → match Facility by its own id
        tenant(facilityId) {
          return { where: { id: facilityId } };
        },
      },
    }
  );

  return Facility;
};
