// 📁 backend/src/models/Recommendation.js
import { DataTypes, Model } from "sequelize";
import { RECOMMENDATION_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Recommendation extends Model {
    static associate(models) {
      // 🔗 Patient & Consultation context
      Recommendation.belongsTo(models.Patient, {
        as: "patient",
        foreignKey: "patient_id",
      });
      Recommendation.belongsTo(models.Employee, {
        as: "doctor",
        foreignKey: "doctor_id",
      });
      Recommendation.belongsTo(models.Department, {
        as: "department",
        foreignKey: "department_id",
      });
      Recommendation.belongsTo(models.Consultation, {
        as: "consultation",
        foreignKey: "consultation_id",
      });

      // Optional reverse link
      Recommendation.hasOne(models.Consultation, {
        as: "linkedConsultation",
        foreignKey: "recommendation_id",
      });

      // 🔗 Org / Facility scope
      Recommendation.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });
      Recommendation.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔗 Audit
      Recommendation.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });
      Recommendation.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });
      Recommendation.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });
    }
  }

  Recommendation.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      doctor_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID, allowNull: true },
      consultation_id: { type: DataTypes.UUID, allowNull: true },

      // Domain data
      recommendation_date: { type: DataTypes.DATEONLY, allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: true },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...RECOMMENDATION_STATUS),
        allowNull: false,
        defaultValue: RECOMMENDATION_STATUS[0], // "pending"
      },

      // Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "Recommendation",
      tableName: "recommendations",
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
        { fields: ["patient_id"] },
        { fields: ["doctor_id"] },
        { fields: ["status"] },
      ],
    }
  );

  return Recommendation;
};
