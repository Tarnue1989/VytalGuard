// 📁 backend/src/models/PharmacyTransaction.js
import { DataTypes, Model } from "sequelize";
import {
  PHARMACY_TRANSACTION_STATUS,
  PHARMACY_TRANSACTION_TYPE,
} from "../constants/enums.js";

export default (sequelize) => {
  class PharmacyTransaction extends Model {
    static associate(models) {
      // 🔗 Core references
      PharmacyTransaction.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      PharmacyTransaction.belongsTo(models.Prescription, { as: "prescription", foreignKey: "prescription_id" });
      PharmacyTransaction.belongsTo(models.PrescriptionItem, { as: "prescriptionItem", foreignKey: "prescription_item_id" });
      PharmacyTransaction.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      PharmacyTransaction.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
      PharmacyTransaction.belongsTo(models.RegistrationLog, { as: "registrationLog", foreignKey: "registration_log_id" });

      // Stock & billing
      PharmacyTransaction.belongsTo(models.DepartmentStock, { as: "departmentStock", foreignKey: "department_stock_id" });
      PharmacyTransaction.belongsTo(models.InvoiceItem, { as: "invoiceItem", foreignKey: "invoice_item_id" });

      // Staff
      PharmacyTransaction.belongsTo(models.Employee, { as: "doctor", foreignKey: "doctor_id" });
      PharmacyTransaction.belongsTo(models.Employee, { as: "fulfilledBy", foreignKey: "fulfilled_by_id" });
      PharmacyTransaction.belongsTo(models.Employee, { as: "voidedBy", foreignKey: "voided_by_id" });

      // Org / Facility
      PharmacyTransaction.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      PharmacyTransaction.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      PharmacyTransaction.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      PharmacyTransaction.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      PharmacyTransaction.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  PharmacyTransaction.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // References
      patient_id: DataTypes.UUID,
      prescription_id: DataTypes.UUID,
      prescription_item_id: DataTypes.UUID,
      registration_log_id: DataTypes.UUID,
      consultation_id: DataTypes.UUID,
      department_id: DataTypes.UUID,
      doctor_id: DataTypes.UUID,
      invoice_item_id: DataTypes.UUID,
      department_stock_id: { type: DataTypes.UUID, allowNull: false },

      // Quantities
      quantity_dispensed: { type: DataTypes.INTEGER, allowNull: false },

      // Type
      type: {
        type: DataTypes.ENUM(...Object.values(PHARMACY_TRANSACTION_TYPE)),
        allowNull: false,
        defaultValue: PHARMACY_TRANSACTION_TYPE.DISPENSE,
      },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(PHARMACY_TRANSACTION_STATUS)),
        allowNull: false,
        defaultValue: PHARMACY_TRANSACTION_STATUS.PENDING,
      },

      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      notes: DataTypes.TEXT,

      // Fulfillment
      fulfilled_by_id: DataTypes.UUID,
      fulfillment_date: DataTypes.DATE,

      // Voiding
      void_reason: DataTypes.STRING,
      voided_by_id: DataTypes.UUID,
      voided_at: DataTypes.DATE,

      // Audit
      created_by_id: DataTypes.UUID,
      updated_by_id: DataTypes.UUID,
      deleted_by_id: DataTypes.UUID,
    },
    {
      sequelize,
      modelName: "PharmacyTransaction",
      tableName: "pharmacy_transactions",
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
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["patient_id"] },
        { fields: ["prescription_id"] },
        { fields: ["prescription_item_id"] },
        { fields: ["department_stock_id"] },
        { fields: ["doctor_id"] },
        { fields: ["invoice_item_id"] },
        { fields: ["fulfilled_by_id"] },
        { fields: ["voided_by_id"] },
        { fields: ["status"] },
        { fields: ["type"] },
        { fields: ["organization_id", "facility_id", "status"] }, // ✅ composite index
      ],
    }
  );

  // ⚡ Auto-fill fulfillment info when dispensing
  PharmacyTransaction.addHook("beforeSave", (txn, options) => {
    const status = String(txn.status || "").toLowerCase();
    if (["dispensed", "partially_dispensed"].includes(status)) {
      if (!txn.fulfillment_date) txn.fulfillment_date = new Date();
      if (!txn.fulfilled_by_id && options?.user?.id) {
        txn.fulfilled_by_id = options.user.id;
      }
    }
  });

  return PharmacyTransaction;
};
