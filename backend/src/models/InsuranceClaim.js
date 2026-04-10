import { DataTypes, Model } from "sequelize";
import { INSURANCE_CLAIM_STATUS, CURRENCY } from "../constants/enums.js";

export default (sequelize) => {
  class InsuranceClaim extends Model {
    static associate(models) {
      // 🔗 Core Links
      InsuranceClaim.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });
      InsuranceClaim.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      InsuranceClaim.belongsTo(models.InsuranceProvider, { as: "provider", foreignKey: "provider_id" });

      // 🔹 Tenant
      InsuranceClaim.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      InsuranceClaim.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Audit
      InsuranceClaim.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      InsuranceClaim.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      InsuranceClaim.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });

      // 🔁 Self-reference (resubmissions)
      InsuranceClaim.belongsTo(models.InsuranceClaim, {
        as: "parentClaim",
        foreignKey: "parent_claim_id",
      });
    }
  }

  InsuranceClaim.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      /* ============================================================
         🔗 TENANT
      ============================================================ */
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      /* ============================================================
         🔗 LINKS
      ============================================================ */
      invoice_id: { type: DataTypes.UUID, allowNull: false },
      patient_id: { type: DataTypes.UUID, allowNull: false },
      provider_id: { type: DataTypes.UUID, allowNull: false },

      /* ============================================================
         📌 CLAIM CORE
      ============================================================ */
      claim_number: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },

      claim_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      response_date: { type: DataTypes.DATEONLY },

      /* ============================================================
         💰 FINANCIALS
      ============================================================ */
      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
        defaultValue: CURRENCY.USD,
      },

      amount_claimed: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },

      amount_approved: {
        type: DataTypes.DECIMAL(12, 2),
        validate: { min: 0 },
      },

      amount_paid: {
        type: DataTypes.DECIMAL(12, 2),
        validate: { min: 0 },
      },

      payment_reference: {
        type: DataTypes.STRING(120),
      },

      /* ============================================================
         📝 DETAILS
      ============================================================ */
      rejection_reason: { type: DataTypes.TEXT },

      notes: { type: DataTypes.TEXT },

      submission_channel: {
        type: DataTypes.STRING(50), // portal, api, manual
      },

      /* ============================================================
         🔄 LIFECYCLE STATUS
      ============================================================ */
      status: {
        type: DataTypes.ENUM(...Object.values(INSURANCE_CLAIM_STATUS)),
        allowNull: false,
        defaultValue: INSURANCE_CLAIM_STATUS.SUBMITTED,
      },

      /* ============================================================
         ⏱️ STATUS TIMESTAMPS (ENTERPRISE TRACKING)
      ============================================================ */
      reviewed_at: { type: DataTypes.DATE },
      approved_at: { type: DataTypes.DATE },
      paid_at: { type: DataTypes.DATE },

      /* ============================================================
         🔁 RESUBMISSION SUPPORT
      ============================================================ */
      parent_claim_id: { type: DataTypes.UUID },

      /* ============================================================
         🔹 AUDIT
      ============================================================ */
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
        attributes: {
          exclude: ["deleted_at", "deleted_by_id"],
        },
      },

      scopes: {
        withDeleted: { paranoid: false },

        submitted: {
          where: { status: INSURANCE_CLAIM_STATUS.SUBMITTED },
        },
        in_review: {
          where: { status: INSURANCE_CLAIM_STATUS.IN_REVIEW },
        },
        approved: {
          where: { status: INSURANCE_CLAIM_STATUS.APPROVED },
        },
        rejected: {
          where: { status: INSURANCE_CLAIM_STATUS.REJECTED },
        },
        paid: {
          where: { status: INSURANCE_CLAIM_STATUS.PAID },
        },

        tenant(facilityId) {
          if (!facilityId) return {};
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
        { fields: ["parent_claim_id"] },
      ],
    }
  );

  return InsuranceClaim;
};