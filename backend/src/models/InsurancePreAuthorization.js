// 📁 backend/src/models/InsurancePreAuthorization.js
import { DataTypes, Model } from "sequelize";
import { INSURANCE_PREAUTH_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class InsurancePreAuthorization extends Model {
    static associate(models) {
      // 🔗 Links
      InsurancePreAuthorization.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      InsurancePreAuthorization.belongsTo(models.InsuranceProvider, { as: "provider", foreignKey: "provider_id" });
      InsurancePreAuthorization.belongsTo(models.BillableItem, { as: "serviceItem", foreignKey: "billable_item_id" });
      InsurancePreAuthorization.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });
      InsurancePreAuthorization.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });

      // 🔹 Org / Facility
      InsurancePreAuthorization.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      InsurancePreAuthorization.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Audit
      InsurancePreAuthorization.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      InsurancePreAuthorization.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      InsurancePreAuthorization.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  InsurancePreAuthorization.init(
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
      patient_id: { type: DataTypes.UUID, allowNull: false },
      provider_id: { type: DataTypes.UUID, allowNull: false },
      billable_item_id: { type: DataTypes.UUID, allowNull: false },
      invoice_id: { type: DataTypes.UUID, allowNull: true },
      consultation_id: { type: DataTypes.UUID, allowNull: true },

      // 📌 PreAuth details
      preauth_number: { type: DataTypes.STRING(100), allowNull: false },
      request_date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
      response_date: { type: DataTypes.DATEONLY },
      amount_requested: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      amount_approved: { type: DataTypes.DECIMAL(12, 2) },
      validity_date: { type: DataTypes.DATEONLY }, // until when approval is valid
      notes: { type: DataTypes.TEXT },
      rejection_reason: { type: DataTypes.TEXT },

      // 📌 Lifecycle
      status: {
        type: DataTypes.ENUM(...INSURANCE_PREAUTH_STATUS),
        allowNull: false,
        defaultValue: INSURANCE_PREAUTH_STATUS[0], // "pending"
      },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "InsurancePreAuthorization",
      tableName: "insurance_preauthorizations",
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
        pending: { where: { status: "pending" } },
        approved: { where: { status: "approved" } },
        rejected: { where: { status: "rejected" } },
        cancelled: { where: { status: "cancelled" } }, // include if in enum
        tenant(facilityId) {
          if (!facilityId) return {}; // superadmin fallback
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["patient_id"] },
        { fields: ["provider_id"] },
        { fields: ["billable_item_id"] },
        { fields: ["invoice_id"] },
        { fields: ["status"] },
        { fields: ["preauth_number"], unique: true },
      ],
    }
  );

  return InsurancePreAuthorization;
};
