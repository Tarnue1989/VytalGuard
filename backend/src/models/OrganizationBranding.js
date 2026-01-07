// 📁 backend/src/models/OrganizationBranding.js
import { DataTypes, Model } from "sequelize";
import { THEME_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class OrganizationBranding extends Model {
    static associate(models) {
      // 🔹 Parent Organization
      OrganizationBranding.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });

      // 🔹 Default letterhead
      OrganizationBranding.belongsTo(models.LetterheadTemplate, { as: "defaultLetterhead", foreignKey: "default_letterhead_id" });

      // 🔹 Audit
      OrganizationBranding.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      OrganizationBranding.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      OrganizationBranding.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  OrganizationBranding.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Scope
      organization_id: { type: DataTypes.UUID, allowNull: false, unique: true },

      // 🏷️ Status
      status: { type: DataTypes.ENUM(...THEME_STATUS), allowNull: false, defaultValue: THEME_STATUS[0] },

      // 🎨 Theme & Assets
      theme: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {
          primary: "#0f62fe",
          secondary: "#6f6f6f",
          surface: "#ffffff",
          text: "#111827",
        },
      },
      logo_url: { type: DataTypes.STRING(400) },
      logo_print_url: { type: DataTypes.STRING(400) },
      favicon_url: { type: DataTypes.STRING(400) },
      default_letterhead_id: { type: DataTypes.UUID },
      contact: { type: DataTypes.JSONB },
      meta: { type: DataTypes.JSONB },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "OrganizationBranding",
      tableName: "organization_brandings",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["status"] },
      ],
      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
      },
      scopes: {
        withDeleted: { paranoid: false },
        byOrg(orgId) {
          return { where: { organization_id: orgId } };
        },
      },
    }
  );

  return OrganizationBranding;
};
