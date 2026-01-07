// 📁 backend/src/models/DeliveryRecord.js
import { DataTypes, Model } from "sequelize";
import { DELIVERY_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class DeliveryRecord extends Model {
    static associate(models) {
      // 🔗 Core relations
      DeliveryRecord.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      DeliveryRecord.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      DeliveryRecord.belongsTo(models.Employee, { as: "doctor", foreignKey: "doctor_id" });
      DeliveryRecord.belongsTo(models.Employee, { as: "midwife", foreignKey: "midwife_id" });
      DeliveryRecord.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
      DeliveryRecord.belongsTo(models.BillableItem, { as: "billableItem", foreignKey: "billable_item_id" });
      DeliveryRecord.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });

      // Status users
      DeliveryRecord.belongsTo(models.Employee, { as: "verifiedBy", foreignKey: "verified_by_id" });
      DeliveryRecord.belongsTo(models.User, { as: "finalizedBy", foreignKey: "finalized_by_id" });
      DeliveryRecord.belongsTo(models.User, { as: "voidedBy", foreignKey: "voided_by_id" });

      // Org / Facility
      DeliveryRecord.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      DeliveryRecord.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      DeliveryRecord.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      DeliveryRecord.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      DeliveryRecord.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  DeliveryRecord.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      consultation_id: { type: DataTypes.UUID },
      doctor_id: { type: DataTypes.UUID },
      midwife_id: { type: DataTypes.UUID },
      department_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID },
      invoice_id: { type: DataTypes.UUID },

      // Delivery info
      delivery_date: { type: DataTypes.DATEONLY, allowNull: false },
      delivery_type: { type: DataTypes.STRING, allowNull: false },

      baby_count: { type: DataTypes.INTEGER },
      delivery_mode: { type: DataTypes.STRING },
      birth_weight: { type: DataTypes.STRING },
      birth_length: { type: DataTypes.STRING },
      newborn_weight: { type: DataTypes.STRING },
      newborn_gender: { type: DataTypes.STRING },
      apgar_score: { type: DataTypes.STRING },
      complications: { type: DataTypes.TEXT },
      notes: { type: DataTypes.TEXT },

      // Lifecycle
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      status: {
        type: DataTypes.ENUM(...DELIVERY_STATUS),
        allowNull: false,
        defaultValue: DELIVERY_STATUS[0], // "scheduled"
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
      modelName: "DeliveryRecord",
      tableName: "delivery_records",
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
        active: { where: { status: "active" } },
        inactive: { where: { status: "inactive" } },
        // 🔑 Needed for setTenantScope
        tenant(facilityId) {
          if (!facilityId) return {}; // superadmin fallback (no filter)
          return { where: { facility_id: facilityId } };
        },
      },

      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["patient_id"] },
        { fields: ["delivery_date"] },
        { fields: ["status"] },
        { fields: ["midwife_id"] },
        { fields: ["invoice_id"] },
      ],
    }
  );

  return DeliveryRecord;
};
