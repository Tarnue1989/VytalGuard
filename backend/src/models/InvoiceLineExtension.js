// 📁 backend/src/models/InvoiceLineExtension.js
import { DataTypes, Model } from "sequelize";
import { INVOICE_LINE_EXTENSION_STATUS, DISCOUNT_TYPE } from "../constants/enums.js";

export default (sequelize) => {
  class InvoiceLineExtension extends Model {
    static associate(models) {
      // 🔗 Parent Invoice Item
      InvoiceLineExtension.belongsTo(models.InvoiceItem, {
        as: "invoiceItem",
        foreignKey: "invoice_item_id",
        onDelete: "CASCADE",
      });

      // 🔗 Applied discount/waiver (if any)
      InvoiceLineExtension.belongsTo(models.DiscountWaiver, {
        as: "discountWaiver",
        foreignKey: "discount_waiver_id",
      });

      // 🔗 Applied policy (rule-driven)
      InvoiceLineExtension.belongsTo(models.DiscountPolicy, {
        as: "discountPolicy",
        foreignKey: "discount_policy_id",
      });

      // 🔗 Applied tax (rule-driven or static)
      InvoiceLineExtension.belongsTo(models.TaxPolicy, {
        as: "taxPolicy",
        foreignKey: "tax_policy_id",
      });

      // 🔹 Audit
      InvoiceLineExtension.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      InvoiceLineExtension.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      InvoiceLineExtension.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  InvoiceLineExtension.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Link back to invoice item
      invoice_item_id: { type: DataTypes.UUID, allowNull: false },

      // 🔹 Discount info (for audit only)
      discount_type: {
        type: DataTypes.ENUM(...Object.values(DISCOUNT_TYPE)),
        allowNull: true,
      },

      // 🔹 Status
      status: {
        type: DataTypes.ENUM(...Object.values(INVOICE_LINE_EXTENSION_STATUS)),
        allowNull: false,
        defaultValue: INVOICE_LINE_EXTENSION_STATUS.APPLIED,
      },
      discount_value: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      discount_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      // 🔹 Tax info (for audit only)
      tax_rate: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      tax_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

 
      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
      created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE },
    },
    {
      sequelize,
      modelName: "InvoiceLineExtension",
      tableName: "invoice_line_extensions",
      paranoid: true,
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      defaultScope: {
        attributes: { exclude: ["deleted_by_id", "deleted_at"] },
      },
      scopes: {
        withDeleted: { paranoid: false },
        applied: { where: { status: "applied", deleted_at: null } },
        voided: { where: { status: "voided", deleted_at: null } },
      },
      indexes: [
        { fields: ["invoice_item_id"] },
        { fields: ["discount_policy_id"] },
        { fields: ["discount_waiver_id"] },
        { fields: ["tax_policy_id"] },
      ],
    }
  );

  /* ============================================================
     🔁 Hooks
  ============================================================ */
  // 🔹 Audit on create
  InvoiceLineExtension.beforeCreate((ext, options) => {
    if (options.user) {
      ext.created_by_id = options.user.id;
      ext.updated_by_id = options.user.id;
    }
  });

  // 🔹 Audit + sync with parent InvoiceItem
  InvoiceLineExtension.beforeUpdate(async (ext, options) => {
    if (options.user) {
      ext.updated_by_id = options.user.id;
    }

    // If parent invoice item is voided, mark this extension voided too
    const { InvoiceItem } = await import("../models/index.js");
    const parentItem = await InvoiceItem.findByPk(ext.invoice_item_id, {
      transaction: options?.transaction,
    });
    if (parentItem?.status === "voided") {
      ext.status = "voided";
    }
  });

  // 🔹 Audit on delete
  InvoiceLineExtension.beforeDestroy((ext, options) => {
    if (options.user) {
      ext.deleted_by_id = options.user.id;
    }
  });

  // ✅ Auto-recalculate parent invoice when line extension changes
  InvoiceLineExtension.afterCreate(async (ext, options) => {
    const { InvoiceItem, Invoice } = await import("../models/index.js");
    const item = await InvoiceItem.findByPk(ext.invoice_item_id, {
      transaction: options?.transaction,
    });
    if (item) await Invoice.recalculate(item.invoice_id, options?.transaction);
  });

  InvoiceLineExtension.afterUpdate(async (ext, options) => {
    const { InvoiceItem, Invoice } = await import("../models/index.js");
    const item = await InvoiceItem.findByPk(ext.invoice_item_id, {
      transaction: options?.transaction,
    });
    if (item) await Invoice.recalculate(item.invoice_id, options?.transaction);
  });

  InvoiceLineExtension.afterDestroy(async (ext, options) => {
    const { InvoiceItem, Invoice } = await import("../models/index.js");
    const item = await InvoiceItem.findByPk(ext.invoice_item_id, {
      transaction: options?.transaction,
      paranoid: false,
    });
    if (item) await Invoice.recalculate(item.invoice_id, options?.transaction);
  });

  return InvoiceLineExtension;
};
