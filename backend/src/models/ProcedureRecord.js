// 📁 backend/src/models/ProcedureRecord.js
import { DataTypes, Model } from "sequelize";
import { PROCEDURE_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class ProcedureRecord extends Model {
    static associate(models) {
      // 🔗 Core relations
      ProcedureRecord.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      ProcedureRecord.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      ProcedureRecord.belongsTo(models.Employee, { as: "performer", foreignKey: "performer_id" });
      ProcedureRecord.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
      ProcedureRecord.belongsTo(models.BillableItem, { as: "billableItem", foreignKey: "billable_item_id" });
      ProcedureRecord.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });

      // Org / Facility
      ProcedureRecord.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      ProcedureRecord.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      ProcedureRecord.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      ProcedureRecord.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      ProcedureRecord.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  ProcedureRecord.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      consultation_id: { type: DataTypes.UUID },
      performer_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID, allowNull: false },
      invoice_id: { type: DataTypes.UUID },

      // Procedure details
      procedure_date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      procedure_type: { type: DataTypes.STRING, allowNull: false }, // e.g., "dialysis", "endoscopy"
      description: { type: DataTypes.TEXT },
      duration_minutes: { type: DataTypes.INTEGER },
      notes: { type: DataTypes.TEXT },
      cost_override: { type: DataTypes.DECIMAL(12, 2) },

      // Lifecycle
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      status: {
        type: DataTypes.ENUM(...Object.values(PROCEDURE_STATUS)),
        allowNull: false,
        defaultValue: PROCEDURE_STATUS.SCHEDULED,
      },
      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "ProcedureRecord",
      tableName: "procedure_records",
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
        { fields: ["performer_id"] },
        { fields: ["procedure_date"] },
        { fields: ["status"] },
      ],
    }
  );

  return ProcedureRecord;
};
