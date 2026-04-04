import { DataTypes, Model } from "sequelize";
import { INSURANCE_PROVIDER_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class PatientInsurance extends Model {
    static associate(models) {
      // 🔗 Core Links
      PatientInsurance.belongsTo(models.Patient, {
        as: "patient",
        foreignKey: "patient_id",
      });

      PatientInsurance.belongsTo(models.InsuranceProvider, {
        as: "provider",
        foreignKey: "provider_id",
      });

      // 🔹 Org / Facility
      PatientInsurance.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      PatientInsurance.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔹 Audit
      PatientInsurance.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });
      PatientInsurance.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });
      PatientInsurance.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });

      // 🔹 Reverse Link (IMPORTANT)
      PatientInsurance.hasMany(models.RegistrationLog, {
        as: "registrationLogs",
        foreignKey: "patient_insurance_id",
      });
    }
  }

  PatientInsurance.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Core Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      provider_id: { type: DataTypes.UUID, allowNull: false },

      // 📌 Policy Info
      policy_number: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },

      plan_name: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },

      coverage_limit: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        validate: { min: 0 },
      },

      valid_from: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      valid_to: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      is_primary: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // 📌 Status
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
      modelName: "PatientInsurance",
      tableName: "patient_insurances",
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
        active: { where: { status: INSURANCE_PROVIDER_STATUS.ACTIVE } },

        tenant(facilityId) {
          if (!facilityId) return {};
          return { where: { facility_id: facilityId } };
        },
      },

      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["patient_id"] },
        { fields: ["provider_id"] },
        { fields: ["status"] },
        { fields: ["policy_number"], unique: true },
      ],
    }
  );

  return PatientInsurance;
};