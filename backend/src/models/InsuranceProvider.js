// 📁 backend/src/models/InsuranceProvider.js
import { DataTypes, Model } from "sequelize";
import { INSURANCE_PROVIDER_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class InsuranceProvider extends Model {
    static associate(models) {
      // 🔹 Org / Facility
      InsuranceProvider.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      InsuranceProvider.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Links
      InsuranceProvider.hasMany(models.Invoice, { as: "invoices", foreignKey: "insurance_provider_id" });
      InsuranceProvider.hasMany(models.InsuranceClaim, { as: "claims", foreignKey: "provider_id" });
      InsuranceProvider.hasMany(models.InsurancePreAuthorization, { as: "preauthorizations", foreignKey: "provider_id" });

      // 🔹 Audit
      InsuranceProvider.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      InsuranceProvider.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      InsuranceProvider.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  InsuranceProvider.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 📌 Provider details
      name: { type: DataTypes.STRING(150), allowNull: false },
      contact_info: { type: DataTypes.STRING },
      address: { type: DataTypes.TEXT },
      phone: { type: DataTypes.STRING },
      email: { type: DataTypes.STRING },

      // 📌 Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(INSURANCE_PROVIDER_STATUS)),
        allowNull: false,
        defaultValue: INSURANCE_PROVIDER_STATUS.ACTIVE,
      },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "InsuranceProvider",
      tableName: "insurance_providers",
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
        tenant(facilityId) {
          if (!facilityId) return {}; // safeguard for superadmin
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["name"] },
        { fields: ["status"] },
      ],
    }
  );

  return InsuranceProvider;
};
