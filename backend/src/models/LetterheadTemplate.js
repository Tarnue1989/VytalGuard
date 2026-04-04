// 📁 backend/src/models/LetterheadTemplate.js
import { DataTypes, Model } from "sequelize";
import { LETTERHEAD_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class LetterheadTemplate extends Model {
    static associate(models) {
      // 🔹 Org / Facility scope
      LetterheadTemplate.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      LetterheadTemplate.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Audit
      LetterheadTemplate.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      LetterheadTemplate.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      LetterheadTemplate.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  LetterheadTemplate.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🏷️ Details
      name: { type: DataTypes.STRING(150), allowNull: false },
      status: {
        type: DataTypes.ENUM(...Object.values(LETTERHEAD_STATUS)),
        allowNull: false,
        defaultValue: LETTERHEAD_STATUS.ACTIVE,
      },
      header_html: { type: DataTypes.TEXT, allowNull: false },
      footer_html: { type: DataTypes.TEXT },
      logo_url: { type: DataTypes.STRING(400) },
      watermark_url: { type: DataTypes.STRING(400) },

      // ⚙️ Options
      pdf_options: { type: DataTypes.JSONB },
      version: { type: DataTypes.INTEGER, defaultValue: 1 },
      effective_from: { type: DataTypes.DATE },
      effective_to: { type: DataTypes.DATE },
      meta: { type: DataTypes.JSONB },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "LetterheadTemplate",
      tableName: "letterhead_templates",
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
        active: { where: { deleted_at: null } },

        // 🔑 Tenant scope → required for setTenantScope
        tenant(facilityId) {
          if (!facilityId) return {}; // safeguard superadmin case
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

  return LetterheadTemplate;
};
