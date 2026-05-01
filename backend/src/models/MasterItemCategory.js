// 📁 backend/src/models/MasterItemCategory.js
import { DataTypes, Model } from "sequelize";
import { MASTER_ITEM_CATEGORY_STATUS, ORDER_TYPE } from "../constants/enums.js";

export default (sequelize) => {
  class MasterItemCategory extends Model {
    static associate(models) {
      // 🔗 Org scope
      MasterItemCategory.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      // 🔗 Facility (kept optional for legacy, but NOT USED)
      MasterItemCategory.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔗 Master Items
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

      /* ========================================================
         🔗 TENANT (GLOBAL CATEGORY RULE)
      ======================================================== */
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      facility_id: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null, // 🔥 ALWAYS NULL (GLOBAL)
      },

      /* ========================================================
         📑 IDENTITY
      ======================================================== */
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      code: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      description: {
        type: DataTypes.TEXT,
      },

      /* ========================================================
         🔥 ORDER TYPE (SOURCE OF TRUTH)
      ======================================================== */
      order_type: {
        type: DataTypes.ENUM(...Object.values(ORDER_TYPE)),
        allowNull: false,
        defaultValue: ORDER_TYPE.SERVICE,
      },

      /* ========================================================
         🔹 STATUS
      ======================================================== */
      status: {
        type: DataTypes.ENUM(...Object.values(MASTER_ITEM_CATEGORY_STATUS)),
        allowNull: false,
        defaultValue: MASTER_ITEM_CATEGORY_STATUS.ACTIVE,
      },

      /* ========================================================
         🔹 AUDIT
      ======================================================== */
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
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

      /* ========================================================
         🔧 DEFAULT SCOPE
      ======================================================== */
      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
      },

      /* ========================================================
         🔧 SCOPES (🔥 FIXED)
      ======================================================== */
      scopes: {
        withDeleted: { paranoid: false },

        active: {
          where: { deleted_at: null },
        },

        /* 🔥 GLOBAL TENANT SCOPE */
        tenant(orgId) {
          return {
            where: {
              organization_id: orgId,
              facility_id: null, // 🔥 GLOBAL ONLY
            },
          };
        },
      },

      /* ========================================================
         📊 INDEXES
      ======================================================== */
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["name"] },
        { fields: ["code"] },
        { fields: ["status"] },
      ],

      /* ========================================================
         🔐 UNIQUE (ORG LEVEL)
      ======================================================== */
      uniqueKeys: {
        unique_category_per_org: {
          fields: ["organization_id", "name"],
        },
      },
    }
  );

  return MasterItemCategory;
};