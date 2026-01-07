// 📁 backend/src/models/Tax.js
import { DataTypes, Model } from "sequelize";
import { TAX_TYPE, TAX_STATUS } from "../constants/enums.js"; // 🔹 enums must exist

export default (sequelize) => {
  class Tax extends Model {
    static associate(models) {
      // 🔹 Tenant Scoping
      Tax.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Tax.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Applied To Invoices
      Tax.hasMany(models.InvoiceItem, { as: "invoiceItems", foreignKey: "tax_id" });

      // 🔹 Audit
      Tax.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Tax.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Tax.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  Tax.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔹 Tenant Scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: true }, // org-wide tax if null

      // 🔹 Tax Info
      name: { type: DataTypes.STRING, allowNull: false },
      code: { type: DataTypes.STRING, allowNull: true },
      description: { type: DataTypes.TEXT },
      type: { type: DataTypes.ENUM(...TAX_TYPE), allowNull: false }, // percentage | fixed | exempt
      rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        comment: "If percentage: 7 = 7%, if fixed: amount in currency",
      },

      status: {
        type: DataTypes.ENUM(...TAX_STATUS),
        allowNull: false,
        defaultValue: "active",
      },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Tax",
      tableName: "taxes",
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
        active: { where: { status: "active", deleted_at: null } },

        // 🔑 Tenant scope helper
        tenant(facilityId) {
          if (!facilityId) return {}; // safeguard for superadmin/global
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        {
          unique: true,
          fields: ["organization_id", "facility_id", "code"],
          name: "uq_tax_code_per_facility",
        },
        {
          fields: ["organization_id", "facility_id", "status"],
          name: "idx_tax_scope_status",
        },
      ],
    }
  );

  return Tax;
};
