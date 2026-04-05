// 📁 backend/src/models/Vital.js
import { DataTypes, Model } from "sequelize";
import { VITAL_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Vital extends Model {
    static associate(models) {
      // 🔹 Patient & Clinical Context
      Vital.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      Vital.belongsTo(models.Admission, { as: "admission", foreignKey: "admission_id" });
      Vital.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      Vital.belongsTo(models.TriageRecord, { as: "triageRecord", foreignKey: "triage_record_id" });
      Vital.belongsTo(models.Employee, { as: "nurse", foreignKey: "nurse_id" });

      // ✅ Registration Log Link (added)
      Vital.belongsTo(models.RegistrationLog, {
        as: "registrationLog",
        foreignKey: "registration_log_id",
      });

      // 🔹 Organization / Facility Scope
      Vital.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
        onDelete: "CASCADE",
      });
      Vital.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
        onDelete: "CASCADE",
      });

      // 🔹 Audit References
      Vital.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Vital.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Vital.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  Vital.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 References
      patient_id: { type: DataTypes.UUID, allowNull: false },
      admission_id: { type: DataTypes.UUID, allowNull: true },
      consultation_id: { type: DataTypes.UUID, allowNull: true },
      triage_record_id: { type: DataTypes.UUID, allowNull: true },
      nurse_id: { type: DataTypes.UUID, allowNull: true },
      registration_log_id: { type: DataTypes.UUID, allowNull: true }, // ✅ added

      // 🔗 Tenant Scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🏷️ Status
      status: {
        type: DataTypes.ENUM(...Object.values(VITAL_STATUS)),
        allowNull: false,
        defaultValue: VITAL_STATUS.OPEN,
      },

      // 🩺 Vital Signs
      bp: { type: DataTypes.STRING(20), allowNull: true },
      pulse: { type: DataTypes.INTEGER, allowNull: true },
      rr: { type: DataTypes.INTEGER, allowNull: true },
      temp: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      oxygen: { type: DataTypes.INTEGER, allowNull: true },
      weight: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      height: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      rbg: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      pain_score: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { min: 0, max: 10 },
      },
      position: { type: DataTypes.STRING(50), allowNull: true },

      // ⏱️ Time
      recorded_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },

      // 🔹 Audit Fields
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },

      // 🔹 Virtual BMI Computation
      bmi: {
        type: DataTypes.VIRTUAL,
        get() {
          const weight = this.getDataValue("weight");
          const height = this.getDataValue("height");
          if (weight && height) {
            const h = height / 100;
            return (weight / (h * h)).toFixed(2);
          }
          return null;
        },
      },
    },
    {
      sequelize,
      modelName: "Vital",
      tableName: "vitals",
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
        { fields: ["recorded_at"] },
        { fields: ["admission_id"] },
        { fields: ["consultation_id"] },
        { fields: ["registration_log_id"] }, // ✅ added index
        { fields: ["status"] },
      ],
    }
  );

  return Vital;
};
