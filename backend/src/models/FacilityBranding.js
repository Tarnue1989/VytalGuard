// 📁 backend/src/models/FacilityBranding.js
import { DataTypes, Model } from "sequelize";
import { THEME_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class FacilityBranding extends Model {
    static associate(models) {
      // 🔹 Org + Facility scope
      FacilityBranding.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      FacilityBranding.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Default letterhead
      FacilityBranding.belongsTo(models.LetterheadTemplate, { as: "defaultLetterhead", foreignKey: "default_letterhead_id" });

      // 🔹 Audit
      FacilityBranding.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      FacilityBranding.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      FacilityBranding.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  FacilityBranding.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false, unique: true },

      // 🏷️ Status
      status: {
        type: DataTypes.ENUM(...Object.values(THEME_STATUS)),
        allowNull: false,
        defaultValue: THEME_STATUS.ACTIVE,
      },

      // 🎨 Theme & Assets
      theme: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
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
      modelName: "FacilityBranding",
      tableName: "facility_brandings",
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
        // 🔑 Needed for setTenantScope
        tenant(facilityId) {
          if (!facilityId) return {}; // superadmin fallback (no filter)
          return { where: { facility_id: facilityId } };
        },
      },

      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
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
        byFacility(facilityId) {
          return { where: { facility_id: facilityId } };
        },
      },
    }
  );

  return FacilityBranding;
};
