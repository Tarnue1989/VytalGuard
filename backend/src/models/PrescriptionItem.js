// 📁 backend/src/models/PrescriptionItem.js
import { DataTypes, Model } from "sequelize";
import { PRESCRIPTION_ITEM_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class PrescriptionItem extends Model {
    static associate(models) {
      // 🔗 Core relations
      PrescriptionItem.belongsTo(models.Prescription, { as: "prescription", foreignKey: "prescription_id" });
      PrescriptionItem.belongsTo(models.MasterItem, { as: "medication", foreignKey: "medication_id" });
      PrescriptionItem.belongsTo(models.BillableItem, { as: "billableItem", foreignKey: "billable_item_id" });
      PrescriptionItem.belongsTo(models.InvoiceItem, { as: "invoiceItem", foreignKey: "invoice_item_id" });
      PrescriptionItem.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });

      // Org / Facility
      PrescriptionItem.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      PrescriptionItem.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      PrescriptionItem.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      PrescriptionItem.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      PrescriptionItem.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });

      // 🔁 Reverse link: PharmacyTransaction → PrescriptionItem
      PrescriptionItem.hasMany(models.PharmacyTransaction, {
        as: "transactions",
        foreignKey: "prescription_item_id",
      });
    }
  }

  PrescriptionItem.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // References
      prescription_id: { type: DataTypes.UUID, allowNull: false },
      medication_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID, allowNull: false },
      invoice_item_id: { type: DataTypes.UUID, allowNull: true },
      patient_id: { type: DataTypes.UUID },

      // Clinical fields
      dosage: { type: DataTypes.STRING },
      route: { type: DataTypes.STRING },
      duration: { type: DataTypes.STRING },
      quantity: { type: DataTypes.INTEGER },
      instructions: { type: DataTypes.TEXT },
      refill_allowed: { type: DataTypes.BOOLEAN, defaultValue: false },
      refill_count: { type: DataTypes.INTEGER, defaultValue: 0 },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(PRESCRIPTION_ITEM_STATUS)),
        allowNull: false,
        defaultValue: PRESCRIPTION_ITEM_STATUS.DRAFT,
      },
      dispensed_qty: { type: DataTypes.INTEGER, defaultValue: 0 }, // ✅ partial dispensing
      dispensed_at: { type: DataTypes.DATE, allowNull: true },
      cancelled_at: { type: DataTypes.DATE, allowNull: true },

      // Billing
      billed: { type: DataTypes.BOOLEAN, defaultValue: false },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "PrescriptionItem",
      tableName: "prescription_items",
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
          return facilityId ? { where: { facility_id: facilityId } } : {};
        },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["prescription_id"] },
        { fields: ["patient_id"] },
        { fields: ["billable_item_id"] },
        { fields: ["status"] },
        {
          unique: true,
          fields: ["prescription_id", "billable_item_id", "organization_id", "facility_id"], // ✅ multi-tenant safety
          name: "unique_prescription_item_per_medication_tenant",
        },
      ],
    }
  );

  // ⚡ Auto-mark billed when invoice item is linked
  PrescriptionItem.addHook("beforeSave", (item) => {
    item.billed = !!item.invoice_item_id;
  });

  return PrescriptionItem;
};
