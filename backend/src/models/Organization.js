// 📁 backend/src/models/Organization.js
import { DataTypes, Model } from "sequelize";
import { ORG_STATUS } from "../constants/enums.js"; // adjust path if needed

export default (sequelize) => {
  class Organization extends Model {
    static associate(models) {
      // 🔹 Organization → Facilities (one-to-many)
      Organization.hasMany(models.Facility, {
        as: "facilities",
        foreignKey: "organization_id",
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      // 🔹 Audit relationships (standardized aliases)
      Organization.belongsTo(models.User, {
        foreignKey: "created_by_id",
        as: "createdBy",
      });
      Organization.belongsTo(models.User, {
        foreignKey: "updated_by_id",
        as: "updatedBy",
      });
      Organization.belongsTo(models.User, {
        foreignKey: "deleted_by_id",
        as: "deletedBy",
      });
    }
  }

  Organization.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(ORG_STATUS)),
        allowNull: false,
        defaultValue: ORG_STATUS.ACTIVE,
      },
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "Organization",
      tableName: "organizations",
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
        active: { where: { status: "active" } },
        inactive: { where: { status: "inactive" } },
      },
    }
  );

  return Organization;
};
