// 📁 backend/src/models/InsuranceClaim.js
import { DataTypes, Model } from "sequelize";
import { INSURANCE_CLAIM_STATUS, CURRENCY } from "../constants/enums.js";

export default (sequelize) => {
  class InsuranceClaim extends Model {
    static associate(models) {
      /* ============================================================
         🔗 CORE LINKS
      ============================================================ */
      InsuranceClaim.belongsTo(models.Invoice, {
        as: "invoice",
        foreignKey: "invoice_id",
      });

      InsuranceClaim.belongsTo(models.Patient, {
        as: "patient",
        foreignKey: "patient_id",
      });

      InsuranceClaim.belongsTo(models.InsuranceProvider, {
        as: "provider",
        foreignKey: "provider_id",
      });

      // ✅ NEW (CRITICAL) – exact insurance used
      InsuranceClaim.belongsTo(models.PatientInsurance, {
        as: "patientInsurance",
        foreignKey: "patient_insurance_id",
      });

      /* ============================================================
         🔹 TENANT
      ============================================================ */
      InsuranceClaim.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      InsuranceClaim.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      /* ============================================================
         🔹 AUDIT
      ============================================================ */
      InsuranceClaim.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      InsuranceClaim.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });

      InsuranceClaim.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });

      // ✅ NEW – submission audit
      InsuranceClaim.belongsTo(models.User, {
        as: "submittedBy",
        foreignKey: "submitted_by_id",
      });

      /* ============================================================
         🔁 RESUBMISSION SUPPORT
      ============================================================ */
      InsuranceClaim.belongsTo(models.InsuranceClaim, {
        as: "parentClaim",
        foreignKey: "parent_claim_id",
      });
    }
  }

InsuranceClaim.init(
  {
    /* ============================================================
       🆔 PRIMARY
    ============================================================ */
    id: {
      type: DataTypes.UUID,
      defaultValue: sequelize.literal("gen_random_uuid()"),
      primaryKey: true,
    },

    /* ============================================================
       🏢 TENANT (MULTI-TENANT CONTROL)
    ============================================================ */
    organization_id: { type: DataTypes.UUID, allowNull: false },
    facility_id: { type: DataTypes.UUID, allowNull: false },

    /* ============================================================
       🔗 CORE LINKS
    ============================================================ */
    invoice_id: { type: DataTypes.UUID, allowNull: false },
    patient_id: { type: DataTypes.UUID, allowNull: false },
    provider_id: { type: DataTypes.UUID, allowNull: false },

    // 🔥 EXACT INSURANCE USED (CRITICAL)
    patient_insurance_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    /* ============================================================
       💰 INVOICE BREAKDOWN (SOURCE OF TRUTH)
    ============================================================ */
    invoice_total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },

    insurance_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },

    patient_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },

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

    response_date: {
      type: DataTypes.DATEONLY,
    },

    submission_channel: {
      type: DataTypes.STRING(50), // portal, api, manual
    },

    /* ============================================================
       💰 CLAIM FINANCIAL FLOW
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

    // 🔥 SET DURING APPROVAL (NOT ON CREATE)
    amount_approved: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
    },

    // 🔥 SET DURING PAYMENT
    amount_paid: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
    },
    payment_processed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    payment_reference: {
      type: DataTypes.STRING(120),
    },

    /* ============================================================
       🧊 COVERAGE SNAPSHOT (FOR AUDIT)
    ============================================================ */
    coverage_amount_at_claim: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },

    coverage_currency: {
      type: DataTypes.ENUM(...Object.values(CURRENCY)),
      allowNull: true,
    },

    /* ============================================================
       📝 NOTES & DECISION DATA
    ============================================================ */
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 1000],
      },
    },

    rejection_reason: {
      type: DataTypes.TEXT,
    },

    /* ============================================================
       🔄 LIFECYCLE STATUS
    ============================================================ */
    status: {
      type: DataTypes.ENUM(...Object.values(INSURANCE_CLAIM_STATUS)),
      allowNull: false,
      defaultValue: INSURANCE_CLAIM_STATUS.DRAFT,
    },

    /* ============================================================
       ⏱️ STATUS TIMESTAMPS
    ============================================================ */
    submitted_at: { type: DataTypes.DATE },
    reviewed_at: { type: DataTypes.DATE },
    approved_at: { type: DataTypes.DATE },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

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

    submitted_by_id: { type: DataTypes.UUID },
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

        draft: { where: { status: "draft" } },
        submitted: { where: { status: "submitted" } },
        in_review: { where: { status: "in_review" } },
        approved: { where: { status: "approved" } },
        rejected: { where: { status: "rejected" } },
        paid: { where: { status: "paid" } },

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
        { fields: ["patient_insurance_id"] }, // ✅ NEW
        { fields: ["claim_number"], unique: true },
        { fields: ["status"] },
        { fields: ["parent_claim_id"] },
      ],
    }
  );

  return InsuranceClaim;
};