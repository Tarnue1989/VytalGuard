// 📁 backend/src/models/NursingNote.js
import { DataTypes, Model } from "sequelize";
import { NURSING_NOTE_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class NursingNote extends Model {
    static associate(models) {
      // 🔗 Core relations
      NursingNote.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      NursingNote.belongsTo(models.Admission, { as: "admission", foreignKey: "admission_id" });
      NursingNote.belongsTo(models.Employee, { as: "nurse", foreignKey: "nurse_id" });
      NursingNote.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      NursingNote.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });

      // Org / Facility
      NursingNote.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      NursingNote.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      NursingNote.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      NursingNote.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      NursingNote.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  NursingNote.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      admission_id: { type: DataTypes.UUID },
      nurse_id: { type: DataTypes.UUID, allowNull: false },
      consultation_id: { type: DataTypes.UUID },
      department_id: { type: DataTypes.UUID },

      // Note details
      note_date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      shift: { type: DataTypes.STRING }, // morning, evening, night
      subjective: { type: DataTypes.TEXT }, // patient complaint
      objective: { type: DataTypes.TEXT }, // observations
      assessment: { type: DataTypes.TEXT }, // nurse’s assessment
      plan: { type: DataTypes.TEXT }, // care plan / interventions
      handover_notes: { type: DataTypes.TEXT },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(NURSING_NOTE_STATUS)),
        allowNull: false,
        defaultValue: NURSING_NOTE_STATUS.DRAFT,
      },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "NursingNote",
      tableName: "nursing_notes",
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
        { fields: ["admission_id"] },
        { fields: ["nurse_id"] },
        { fields: ["note_date"] },
        { fields: ["status"] },
      ],
    }
  );

  return NursingNote;
};
