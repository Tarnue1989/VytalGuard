// 📁 models/RefreshToken.js
import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class RefreshToken extends Model {
    static associate(models) {
      // 🔹 Token belongs to a User
      RefreshToken.belongsTo(models.User, {
        as: "user",
        foreignKey: "user_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // 🔹 Token belongs to a Facility
      RefreshToken.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // 🔹 Audit relationships
      RefreshToken.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      RefreshToken.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      RefreshToken.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  RefreshToken.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      facility_id: {
        type: DataTypes.UUID,
        allowNull: true, // ✅ allow null for Super Admin / system accounts
      },
      token: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      ip_address: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },

      // 🕒 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "RefreshToken",
      tableName: "refresh_tokens",
      underscored: true,
      paranoid: true, // ✅ soft delete
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      defaultScope: {
        where: {}, // dynamically populated by setTenantScope()
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
      },
      scopes: {
        withDeleted: { paranoid: false },

        // 🔑 Tenant scope → safely filter by facility
        tenant(facilityId) {
          return { where: { facility_id: facilityId } };
        },
      },
    }
  );

  return RefreshToken;
};
