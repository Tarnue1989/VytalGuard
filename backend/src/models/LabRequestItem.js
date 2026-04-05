// 📁 backend/src/models/LabRequestItem.js
import { DataTypes, Model } from "sequelize";
import { LAB_REQUEST_ITEM_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class LabRequestItem extends Model {
    static associate(models) {
      // 🔗 Parent request
      LabRequestItem.belongsTo(models.LabRequest, {
        as: "labRequest",
        foreignKey: "lab_request_id",
      });

      // 🔗 The specific lab test (billable item)
      LabRequestItem.belongsTo(models.BillableItem, {
        as: "labTest",
        foreignKey: "lab_test_id",
      });

      // 🔗 Optional invoice linkage
      LabRequestItem.belongsTo(models.InvoiceItem, {
        as: "invoiceItem",
        foreignKey: "invoice_item_id",
      });

      // 🔗 Lab results (1 item → many results allowed)
      LabRequestItem.hasMany(models.LabResult, {
        as: "labResults",
        foreignKey: "lab_request_item_id",
      });

      // Org / Facility
      LabRequestItem.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });
      LabRequestItem.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // Audit
      LabRequestItem.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });
      LabRequestItem.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });
      LabRequestItem.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });
    }
  }

  LabRequestItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Core references
      lab_request_id: { type: DataTypes.UUID, allowNull: false },
      lab_test_id: { type: DataTypes.UUID, allowNull: false },
      invoice_item_id: { type: DataTypes.UUID, allowNull: true },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(LAB_REQUEST_ITEM_STATUS)),
        allowNull: false,
        defaultValue: LAB_REQUEST_ITEM_STATUS.DRAFT,
      },
      notes: { type: DataTypes.TEXT },
      billed: { type: DataTypes.BOOLEAN, defaultValue: false },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "LabRequestItem",
      tableName: "lab_request_items",
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
        tenant(facilityId) {
          if (!facilityId) return {};
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["lab_request_id"] },
        { fields: ["lab_test_id"] },
        { fields: ["status"] },
        {
          unique: true,
          fields: ["lab_request_id", "lab_test_id"],
          name: "unique_lab_request_item_per_test",
        },
      ],
    }
  );

  // ⚡ Auto-mark billed when invoice is linked
  LabRequestItem.addHook("beforeSave", (item) => {
    if (item.invoice_item_id && !item.billed) {
      item.billed = true;
    }
  });

  return LabRequestItem;
};
