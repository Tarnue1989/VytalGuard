// 📁 backend/src/models/Supplier.js
import { DataTypes, Model } from "sequelize";
import { SUPPLIER_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Supplier extends Model {
    static associate(models) {
      // 🔹 Org / Facility scope
      Supplier.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Supplier.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Audit
      Supplier.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Supplier.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Supplier.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });

      // 🔹 Stock linkage
      Supplier.hasMany(models.CentralStock, { as: "suppliedStocks", foreignKey: "supplier_id" });
    }
  }

  Supplier.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 📋 Supplier details
      name: { type: DataTypes.STRING, allowNull: false },
      contact_name: { type: DataTypes.STRING },
      contact_email: {
        type: DataTypes.STRING,
        validate: {
          isEmail: { msg: "Contact email must be a valid email address" },
        },
      },
      contact_phone: {
        type: DataTypes.STRING,
        validate: {
          is: {
            args: [/^[0-9+\-\s()]*$/],
            msg: "Contact phone must be a valid phone number",
          },
        },
      },
      address: { type: DataTypes.TEXT },

      // 📌 Status
      status: {
        type: DataTypes.ENUM(...Object.values(SUPPLIER_STATUS)), // ✅ FIX
        allowNull: false,
        defaultValue: SUPPLIER_STATUS.ACTIVE, // ✅ FIX
      },

      notes: { type: DataTypes.TEXT },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "Supplier",
      tableName: "suppliers",
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
        { fields: ["name"] },
        { fields: ["status"] },
      ],
      uniqueKeys: {
        unique_supplier_per_scope: {
          fields: ["organization_id", "facility_id", "name"],
        },
      },
    }
  );

  return Supplier;
};
