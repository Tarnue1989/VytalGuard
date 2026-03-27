// 📁 backend/src/models/OrganizationBranding.js
import { DataTypes, Model } from "sequelize";
import { THEME_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class OrganizationBranding extends Model {
    static associate(models) {
      // 🔹 Parent Organization
      OrganizationBranding.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
        onDelete: "CASCADE",
      });

      // 🔥 Reverse link (REQUIRED for include)
      models.Organization.hasOne(OrganizationBranding, {
        as: "branding",
        foreignKey: "organization_id",
      });

      // 🔹 Audit
      OrganizationBranding.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      OrganizationBranding.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });

      OrganizationBranding.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });
    }

    /* ============================================================
       🔹 HELPERS
    ============================================================ */
    getContact(key) {
      return this.contact?.[key] || "";
    }

    get primaryColor() {
      return this.theme?.primary || "#0f62fe";
    }
  }

  OrganizationBranding.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      /* ============================================================
         🔗 SCOPE
      ============================================================ */
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },

      /* ============================================================
         🏷️ STATUS
      ============================================================ */
      status: {
        type: DataTypes.ENUM(...THEME_STATUS),
        allowNull: false,
        defaultValue: THEME_STATUS[0],
      },

      /* ============================================================
         🎨 THEME
      ============================================================ */
      theme: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {
          primary: "#0f62fe",
          secondary: "#6f6f6f",
          surface: "#ffffff",
          text: "#111827",
        },
        validate: {
          isValidTheme(value) {
            const hex = /^#([0-9A-F]{3}){1,2}$/i;

            ["primary", "secondary", "surface", "text"].forEach((k) => {
              if (value[k] && !hex.test(value[k])) {
                throw new Error(`Invalid color for ${k}`);
              }
            });
          },
        },
      },

      /* ============================================================
         🖼️ ASSETS (FILE UPLOAD READY)
      ============================================================ */
      logo_url: {
        type: DataTypes.STRING(400),
      },

      logo_print_url: {
        type: DataTypes.STRING(400),
      },

      favicon_url: {
        type: DataTypes.STRING(400),
      },
      /* ============================================================
         🏢 BRAND IDENTITY
      ============================================================ */
      company_name: { type: DataTypes.STRING(255) },
      tagline: { type: DataTypes.STRING(255) },

      /* ============================================================
         📄 LETTERHEAD
      ============================================================ */
      default_letterhead_id: { type: DataTypes.UUID },
      letterhead_header: { type: DataTypes.TEXT },
      letterhead_footer: { type: DataTypes.TEXT },

      /* ============================================================
         📞 CONTACT
      ============================================================ */
      contact: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {
          email: "",
          phone: "",
          address: "",
          website: "",
        },
      },

      /* ============================================================
         🌐 SOCIAL
      ============================================================ */
      social_links: {
        type: DataTypes.JSONB,
        defaultValue: {
          facebook: "",
          twitter: "",
          linkedin: "",
          instagram: "",
        },
      },

      /* ============================================================
         📧 EMAIL BRANDING
      ============================================================ */
      email_from_name: { type: DataTypes.STRING(255) },
      email_footer: { type: DataTypes.TEXT },

      /* ============================================================
         🌍 SYSTEM SETTINGS
      ============================================================ */
      currency: {
        type: DataTypes.STRING(10),
        defaultValue: "USD",
      },

      locale: {
        type: DataTypes.STRING(20),
        defaultValue: "en-US",
      },

      timezone: {
        type: DataTypes.STRING(50),
        defaultValue: "UTC",
      },

      /* ============================================================
         🧠 UI SETTINGS
      ============================================================ */
      ui_settings: {
        type: DataTypes.JSONB,
        defaultValue: {
          dark_mode: false,
          compact_mode: false,
        },
      },

      /* ============================================================
         🧠 META
      ============================================================ */
      meta: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },

      /* ============================================================
         🔹 AUDIT
      ============================================================ */
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
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
        { unique: true, fields: ["organization_id"] },
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

        active: {
          where: { status: THEME_STATUS[0] },
        },
      },
    }
  );

  return OrganizationBranding;
};