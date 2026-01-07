// 📁 backend/src/models/InsuranceClaim.js
import { DataTypes, Model } from "sequelize";
import { INSURANCE_CLAIM_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class InsuranceClaim extends Model {
    static associate(models) {
      // 🔗 Links
      InsuranceClaim.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });
      InsuranceClaim.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      InsuranceClaim.belongsTo(models.InsuranceProvider, { as: "provider", foreignKey: "provider_id" });

      // 🔹 Org / Facility
      InsuranceClaim.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      InsuranceClaim.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Audit
      InsuranceClaim.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      InsuranceClaim.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      InsuranceClaim.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  InsuranceClaim.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Links
      invoice_id: { type: DataTypes.UUID, allowNull: false },
      patient_id: { type: DataTypes.UUID, allowNull: false },
      provider_id: { type: DataTypes.UUID, allowNull: false },

      // 📌 Claim info
      claim_number: { type: DataTypes.STRING(100), allowNull: false },
      amount_claimed: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      amount_approved: { type: DataTypes.DECIMAL(12, 2) },
      claim_date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
      response_date: { type: DataTypes.DATEONLY },
      rejection_reason: { type: DataTypes.TEXT },

      // 📌 Lifecycle
      status: {
        type: DataTypes.ENUM(...INSURANCE_CLAIM_STATUS),
        allowNull: false,
        defaultValue: INSURANCE_CLAIM_STATUS[0], // e.g. "submitted"
      },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "InsuranceClaim",
      tableName: "insurance_claims",
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
        submitted: { where: { status: "submitted" } },
        approved: { where: { status: "approved" } },
        rejected: { where: { status: "rejected" } },
        tenant(facilityId) {
          if (!facilityId) return {}; // safeguard for superadmin
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["invoice_id"] },
        { fields: ["patient_id"] },
        { fields: ["provider_id"] },
        { fields: ["claim_number"], unique: true },
        { fields: ["status"] },
      ],
    }
  );

  return InsuranceClaim;
};
