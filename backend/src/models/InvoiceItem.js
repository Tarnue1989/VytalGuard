// 📁 backend/src/models/InvoiceItem.js
import { DataTypes, Model } from "sequelize";
import { INVOICE_LINE_EXTENSION_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class InvoiceItem extends Model {
    static associate(models) {
      // 🔹 Parent Invoice
      InvoiceItem.belongsTo(models.Invoice, {
        as: "invoice",
        foreignKey: "invoice_id",
      });

      // 🔹 Billable Item
      InvoiceItem.belongsTo(models.BillableItem, {
        as: "billableItem",
        foreignKey: "billable_item_id",
      });

      // 🔹 Feature Module
      InvoiceItem.belongsTo(models.FeatureModule, {
        as: "featureModule",
        foreignKey: "feature_module_id",
      });

      // 🔹 Discount / Tax
      InvoiceItem.belongsTo(models.Discount, {
        as: "discount",
        foreignKey: "discount_id",
      });

      InvoiceItem.belongsTo(models.Tax, {
        as: "tax",
        foreignKey: "tax_id",
      });

      // 🔹 Policies
      InvoiceItem.belongsTo(models.DiscountPolicy, {
        as: "discountPolicy",
        foreignKey: "discount_policy_id",
      });

      InvoiceItem.belongsTo(models.TaxPolicy, {
        as: "taxPolicy",
        foreignKey: "tax_policy_id",
      });

      // 🔹 Tenant
      InvoiceItem.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      InvoiceItem.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔹 Audit
      InvoiceItem.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      InvoiceItem.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });

      InvoiceItem.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });

      // 🔁 Reverse link
      InvoiceItem.hasMany(models.LabRequestItem, {
        as: "labRequestItems",
        foreignKey: "invoice_item_id",
      });
    }
  }

  InvoiceItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      /* ================= LINKS ================= */
      invoice_id: { type: DataTypes.UUID, allowNull: false },
      billable_item_id: { type: DataTypes.UUID, allowNull: false },
      feature_module_id: { type: DataTypes.UUID, allowNull: false },

      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      discount_id: { type: DataTypes.UUID },
      tax_id: { type: DataTypes.UUID },

      discount_policy_id: { type: DataTypes.UUID },
      tax_policy_id: { type: DataTypes.UUID },

      /* ================= DETAILS ================= */
      description: { type: DataTypes.STRING },

      unit_price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },

      quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },

      /* ================= FINANCIAL ================= */
      discount_amount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      tax_amount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      total_price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },

      net_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },

      /* ================= 🏥 INSURANCE SPLIT ================= */
      insurance_amount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      patient_amount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      note: { type: DataTypes.TEXT },

      /* ================= TRACKING ================= */
      entity_id: { type: DataTypes.UUID },

      status: {
        type: DataTypes.ENUM(...Object.values(INVOICE_LINE_EXTENSION_STATUS)),
        defaultValue: INVOICE_LINE_EXTENSION_STATUS.APPLIED,
      },

      /* ================= AUDIT ================= */
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },

      /* ================= VIRTUAL ================= */
      subtotal: {
        type: DataTypes.VIRTUAL,
        get() {
          const price = parseFloat(this.unit_price || 0);
          const qty = parseInt(this.quantity || 0);
          return price * qty;
        },
      },

      total: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.net_amount ?? 0;
        },
      },
    },
    {
      sequelize,
      modelName: "InvoiceItem",
      tableName: "invoice_items",
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
        applied: { where: { status: "applied", deleted_at: null } },
        voided: { where: { status: "voided", deleted_at: null } },

        tenant(facilityId) {
          return facilityId ? { where: { facility_id: facilityId } } : {};
        },
      },

      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["invoice_id"] },
        { fields: ["billable_item_id"] },
        { fields: ["feature_module_id"] },
        { fields: ["discount_id"] },
        { fields: ["tax_id"] },
        { fields: ["discount_policy_id"] },
        { fields: ["tax_policy_id"] },
        { fields: ["entity_id"] },
        { fields: ["status"] },
      ],
    }
  );

  /* ============================================================
     🔁 HOOKS
  ============================================================ */

  // 🔹 Sync tenant + audit
  InvoiceItem.beforeCreate(async (item, options) => {
    const { Invoice } = await import("../models/index.js");

    const invoice = await Invoice.findByPk(item.invoice_id, {
      transaction: options?.transaction,
    });

    if (!invoice) throw new Error("Invalid invoice_id");

    item.organization_id ||= invoice.organization_id;
    item.facility_id ||= invoice.facility_id;

    if (options.user) {
      item.created_by_id = options.user.id;
      item.updated_by_id = options.user.id;
    }
  });

  // 🔁 Calculate values
  InvoiceItem.beforeValidate((item) => {
    const price = parseFloat(item.unit_price || 0);
    const qty = parseInt(item.quantity || 0);

    const subtotal = price * qty;
    const discount = parseFloat(item.discount_amount || 0);
    const tax = parseFloat(item.tax_amount || 0);

    const net = subtotal - discount + tax;

    item.total_price = subtotal;
    item.net_amount = net;

    // 🔥 Insurance split (will be updated later in billingService)
    item.insurance_amount ||= 0;
    item.patient_amount ||= net;
  });

  // 🔒 Prevent editing locked invoice
  InvoiceItem.beforeUpdate(async (item, options) => {
    const { Invoice } = await import("../models/index.js");

    const invoice = await Invoice.findByPk(item.invoice_id, {
      transaction: options?.transaction,
    });

    if (invoice?.is_locked) {
      throw new Error("Cannot modify items of a locked invoice");
    }

    if (options.user) {
      item.updated_by_id = options.user.id;
    }
  });

  // 🔹 Audit delete
  InvoiceItem.beforeDestroy((item, options) => {
    if (options.user) {
      item.deleted_by_id = options.user.id;
    }
  });

  // 🔁 Recalculate invoice
  InvoiceItem.afterCreate(async (item, options) => {
    const { Invoice } = await import("../models/index.js");
    return Invoice.recalculate(item.invoice_id, options?.transaction);
  });

  InvoiceItem.afterUpdate(async (item, options) => {
    const { Invoice } = await import("../models/index.js");
    return Invoice.recalculate(item.invoice_id, options?.transaction);
  });

  InvoiceItem.afterDestroy(async (item, options) => {
    const { Invoice } = await import("../models/index.js");
    return Invoice.recalculate(item.invoice_id, options?.transaction);
  });

  return InvoiceItem;
};