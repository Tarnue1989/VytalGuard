// 📁 backend/src/models/LabResult.js
import { DataTypes, Model } from "sequelize";
import { LAB_RESULT_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class LabResult extends Model {
    static associate(models) {
      // 🔗 Core relations
      LabResult.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      LabResult.belongsTo(models.LabRequest, { as: "labRequest", foreignKey: "lab_request_id" });
      LabResult.belongsTo(models.LabRequestItem, { as: "labRequestItem", foreignKey: "lab_request_item_id" }); // ✅ strict per-item
      LabResult.belongsTo(models.RegistrationLog, { as: "registrationLog", foreignKey: "registration_log_id" });
      LabResult.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      LabResult.belongsTo(models.Employee, { as: "doctor", foreignKey: "doctor_id" });
      LabResult.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
      LabResult.belongsTo(models.BillableItem, { as: "billableItem", foreignKey: "billable_item_id" });

      // Org / Facility
      LabResult.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      LabResult.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      LabResult.belongsTo(models.User, { as: "enteredBy", foreignKey: "entered_by_id" });
      LabResult.belongsTo(models.User, { as: "reviewedBy", foreignKey: "reviewed_by_id" });
      LabResult.belongsTo(models.User, { as: "verifiedBy", foreignKey: "verified_by_id" });
      LabResult.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      LabResult.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      LabResult.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });

      // 🔗 Backlink from LabRequestItem
      models.LabRequestItem.hasOne(models.LabResult, {
        as: "result",
        foreignKey: "lab_request_item_id",
      });
    }
  }

  LabResult.init(
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
      lab_request_id: { type: DataTypes.UUID, allowNull: false }, // still keep for querying
      lab_request_item_id: { type: DataTypes.UUID, allowNull: false }, // ✅ strict per-item link
      registration_log_id: { type: DataTypes.UUID, allowNull: true },
      consultation_id: { type: DataTypes.UUID, allowNull: true },
      department_id: { type: DataTypes.UUID, allowNull: true },
      doctor_id: { type: DataTypes.UUID, allowNull: true },
      billable_item_id: { type: DataTypes.UUID, allowNull: true },

      // 📋 Result details
      result: { type: DataTypes.TEXT, allowNull: false },
      notes: { type: DataTypes.TEXT },
      doctor_notes: { type: DataTypes.TEXT },
      result_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("CURRENT_DATE"),
      },
      attachment_url: { type: DataTypes.STRING },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...LAB_RESULT_STATUS),
        allowNull: false,
        defaultValue: LAB_RESULT_STATUS[0], // "draft"
      },

      reviewed_at: { type: DataTypes.DATE },
      verified_at: { type: DataTypes.DATE },

      // Audit
      entered_by_id: { type: DataTypes.UUID },
      reviewed_by_id: { type: DataTypes.UUID },
      verified_by_id: { type: DataTypes.UUID },
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "LabResult",
      tableName: "lab_results",
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
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["patient_id"] },
        { fields: ["lab_request_id"] },
        { fields: ["lab_request_item_id"], unique: true }, // ✅ enforce 1 result per item
        { fields: ["registration_log_id"] },
        { fields: ["consultation_id"] },
        { fields: ["doctor_id"] },
        { fields: ["result_date"] },
        { fields: ["status"] },
      ],
    }
  );

  return LabResult;
};
