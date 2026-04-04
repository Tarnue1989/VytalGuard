// 📁 backend/src/models/RadiologyRecord.js
import { DataTypes, Model } from "sequelize";
import { RADIOLOGY_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class RadiologyRecord extends Model {
    static associate(models) {
      // 🔗 Core relations
      RadiologyRecord.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      RadiologyRecord.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      RadiologyRecord.belongsTo(models.Employee, { as: "radiologist", foreignKey: "radiologist_id" });
      RadiologyRecord.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
      RadiologyRecord.belongsTo(models.BillableItem, { as: "billableItem", foreignKey: "billable_item_id" });
      RadiologyRecord.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });

      // Org / Facility
      RadiologyRecord.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      RadiologyRecord.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      RadiologyRecord.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      RadiologyRecord.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      RadiologyRecord.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
      RadiologyRecord.belongsTo(models.User, { as: "verifiedBy", foreignKey: "verified_by_id" });
    }
  }

  RadiologyRecord.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      consultation_id: { type: DataTypes.UUID },
      department_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID },  // ✅ renamed
      invoice_id: { type: DataTypes.UUID },
      radiologist_id: { type: DataTypes.UUID },
      verified_by_id: { type: DataTypes.UUID },

      // Imaging details
      study_type: { type: DataTypes.STRING, allowNull: false }, // e.g. X-ray, CT, MRI
      study_date: { type: DataTypes.DATE, allowNull: false },
      body_part: { type: DataTypes.STRING },
      modality: { type: DataTypes.STRING },
      findings: { type: DataTypes.TEXT },
      impression: { type: DataTypes.TEXT },
      file_path: { type: DataTypes.TEXT }, // PACS file or attachment

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(RADIOLOGY_STATUS)),
        allowNull: false,
        defaultValue: RADIOLOGY_STATUS.PENDING,
      },
      verified_at: { type: DataTypes.DATE },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "RadiologyRecord",
      tableName: "radiology_records",
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
        { fields: ["study_date"] },
        { fields: ["study_type"] },
        { fields: ["status"] },
        { fields: ["radiologist_id"] },
      ],
    }
  );

  return RadiologyRecord;
};
