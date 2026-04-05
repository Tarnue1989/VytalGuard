// 📁 backend/src/models/RegistrationLog.js
import { DataTypes, Model } from "sequelize";
import {
  REGISTRATION_LOG_STATUS,
  REGISTRATION_METHODS,
  REGISTRATION_CATEGORIES,
  PAYER_TYPES,
} from "../constants/enums.js";

export default (sequelize) => {
  class RegistrationLog extends Model {
    static associate(models) {
      // 🔹 Core Links
      RegistrationLog.belongsTo(models.Patient, {
        as: "patient",
        foreignKey: "patient_id",
        onDelete: "CASCADE",
      });

      RegistrationLog.belongsTo(models.Employee, {
        as: "registrar",
        foreignKey: "registrar_id",
        onDelete: "SET NULL",
      });

      RegistrationLog.belongsTo(models.Invoice, {
        as: "invoice",
        foreignKey: "invoice_id",
      });

      RegistrationLog.belongsTo(models.BillableItem, {
        as: "registrationType",
        foreignKey: "registration_type_id",
      });

      // 🔹 Insurance (NEW LINK)
      RegistrationLog.belongsTo(models.PatientInsurance, {
        as: "patientInsurance",
        foreignKey: "patient_insurance_id",
      });

      // 🔹 Org / Facility
      RegistrationLog.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
        onDelete: "CASCADE",
      });
      RegistrationLog.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
        onDelete: "CASCADE",
      });

      // 🔹 Audit
      RegistrationLog.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      RegistrationLog.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      RegistrationLog.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });

      // 🔹 Downstream
      RegistrationLog.hasMany(models.Consultation, {
        as: "consultations",
        foreignKey: "registration_log_id",
      });
      RegistrationLog.hasMany(models.TriageRecord, {
        as: "triageRecords",
        foreignKey: "registration_log_id",
      });
      RegistrationLog.hasMany(models.Admission, {
        as: "admissions",
        foreignKey: "registration_log_id",
      });
    }
  }

  RegistrationLog.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Foreign Keys
      patient_id: { type: DataTypes.UUID, allowNull: false },
      registrar_id: { type: DataTypes.UUID, allowNull: true },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      invoice_id: { type: DataTypes.UUID, allowNull: true },
      registration_type_id: { type: DataTypes.UUID, allowNull: true },

      // 🏷️ Lifecycle
      log_status: {
        type: DataTypes.ENUM(...Object.values(REGISTRATION_LOG_STATUS)),
        allowNull: false,
        defaultValue: REGISTRATION_LOG_STATUS.DRAFT,
      },

      // 📝 Info
      registration_method: {
        type: DataTypes.ENUM(...Object.values(REGISTRATION_METHODS)),
        allowNull: false,
        defaultValue: REGISTRATION_METHODS.WALK_IN,
      },

      registration_source: { type: DataTypes.STRING(120), allowNull: true },

      patient_category: {
        type: DataTypes.ENUM(...Object.values(REGISTRATION_CATEGORIES)),
        allowNull: false,
        defaultValue: REGISTRATION_CATEGORIES.GENERAL,
      },

      // 💳 Billing decision (NEW)
      payer_type: {
        type: DataTypes.ENUM(...Object.values(PAYER_TYPES)),
        allowNull: false,
        defaultValue: PAYER_TYPES.CASH,
      },

      // 🔗 Selected insurance policy (NEW)
      patient_insurance_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      visit_reason: { type: DataTypes.TEXT, allowNull: true },
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      registration_time: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      notes: { type: DataTypes.TEXT, allowNull: true },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "RegistrationLog",
      tableName: "registration_logs",
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

        tenant(facilityId) {
          if (!facilityId) return {};
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["patient_id"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["registrar_id"] },
        { fields: ["invoice_id"] },
        { fields: ["payer_type"] }, // 🔥 helpful for billing queries
      ],
    }
  );

  return RegistrationLog;
};