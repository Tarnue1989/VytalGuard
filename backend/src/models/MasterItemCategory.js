// 📁 backend/src/models/MasterItemCategory.js
import { DataTypes, Model } from "sequelize";
import { MASTER_ITEM_CATEGORY_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class MasterItemCategory extends Model {
    static associate(models) {
      // 🔗 Org scope
      MasterItemCategory.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      // 🔗 Facility scope (optional)
      MasterItemCategory.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔗 Master Items under this category
      MasterItemCategory.hasMany(models.MasterItem, {
        as: "masterItems",
        foreignKey: "category_id",
      });

      // 🔹 Audit
      MasterItemCategory.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      MasterItemCategory.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      MasterItemCategory.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  MasterItemCategory.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: true }, // ✅ optional facility scope

      // 📑 Identity
      name: { type: DataTypes.STRING(100), allowNull: false },
      code: { type: DataTypes.STRING(50), allowNull: true },
      description: { type: DataTypes.TEXT },

      // 🔹 Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(MASTER_ITEM_CATEGORY_STATUS)), // ✅ fixed
        allowNull: false,
        defaultValue: MASTER_ITEM_CATEGORY_STATUS.ACTIVE, // ✅ use key not array index
      },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "MasterItemCategory",
      tableName: "master_item_categories",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      defaultScope: { attributes: { exclude: ["deleted_at", "deleted_by_id"] } },
      scopes: {
        withDeleted: { paranoid: false },
        active: { where: { deleted_at: null } },
        tenant(facilityId) {
          if (!facilityId) return {}; // safeguard superadmin case
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["name"] },
        { fields: ["code"] },
        { fields: ["status"] },
      ],
      uniqueKeys: {
        unique_category_per_org: { fields: ["organization_id", "name"] },
      },
    }
  );

  return MasterItemCategory;
};
