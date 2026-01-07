// 📁 backend/src/models/Surgery.js
import { DataTypes, Model } from "sequelize";
import { SURGERY_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Surgery extends Model {
    static associate(models) {
      // 🔗 Core relations
      Surgery.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      Surgery.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      Surgery.belongsTo(models.Employee, { as: "surgeon", foreignKey: "surgeon_id" });
      Surgery.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
      Surgery.belongsTo(models.BillableItem, { as: "billableItem", foreignKey: "billable_item_id" });
      Surgery.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });

      // Status workflow
      Surgery.belongsTo(models.Employee, { as: "verifiedBy", foreignKey: "verified_by_id" });
      Surgery.belongsTo(models.User, { as: "finalizedBy", foreignKey: "finalized_by_id" });
      Surgery.belongsTo(models.User, { as: "voidedBy", foreignKey: "voided_by_id" });

      // Org / Facility
      Surgery.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Surgery.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      Surgery.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Surgery.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Surgery.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  Surgery.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      consultation_id: { type: DataTypes.UUID },
      surgeon_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID, allowNull: false },
      invoice_id: { type: DataTypes.UUID },

      // Surgery info
      scheduled_date: { type: DataTypes.DATEONLY, allowNull: false },
      surgery_type: { type: DataTypes.STRING },
      duration_minutes: { type: DataTypes.INTEGER },
      anesthesia_type: { type: DataTypes.STRING },
      complications: { type: DataTypes.TEXT },
      notes: { type: DataTypes.TEXT },
      cost_override: { type: DataTypes.DECIMAL(12, 2) },
      document_url: { type: DataTypes.STRING },

      // Lifecycle
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      status: {
        type: DataTypes.ENUM(...SURGERY_STATUS),
        allowNull: false,
        defaultValue: SURGERY_STATUS[0], // "scheduled"
      },

      // Workflow tracking
      finalized_at: { type: DataTypes.DATE },
      finalized_by_id: { type: DataTypes.UUID },
      verified_by_id: { type: DataTypes.UUID },
      verified_at: { type: DataTypes.DATE },
      voided_by_id: { type: DataTypes.UUID },
      voided_at: { type: DataTypes.DATE },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Surgery",
      tableName: "surgeries",
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
        { fields: ["scheduled_date"] },
        { fields: ["status"] },
        { fields: ["surgeon_id"] },
        { fields: ["invoice_id"] },
      ],
    }
  );

  return Surgery;
};
