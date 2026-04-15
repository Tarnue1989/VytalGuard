// 📁 backend/src/models/Discount.js
import { DataTypes, Model } from "sequelize";
import { DISCOUNT_TYPE, DISCOUNT_STATUS, CURRENCY } from "../constants/enums.js";

export default (sequelize) => {
  class Discount extends Model {
    static associate(models) {
      // 🔹 Tenant
      Discount.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      Discount.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔹 Invoice linkage
      Discount.belongsTo(models.Invoice, {
        as: "invoice",
        foreignKey: "invoice_id",
      });

      Discount.belongsTo(models.InvoiceItem, {
        as: "invoiceItem",
        foreignKey: "invoice_item_id",
      });

      Discount.hasMany(models.InvoiceItem, {
        as: "invoiceItems",
        foreignKey: "discount_id",
      });

      // 🔹 Policy
      Discount.belongsTo(models.DiscountPolicy, {
        as: "policy",
        foreignKey: "discount_policy_id",
      });

      // 🔹 Audit
      Discount.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Discount.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Discount.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
      Discount.belongsTo(models.User, { as: "voidedBy", foreignKey: "voided_by_id" });
      Discount.belongsTo(models.User, { as: "finalizedBy", foreignKey: "finalized_by_id" });
    }
  }

  Discount.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: true },

      // 🔗 Invoice
      invoice_id: { type: DataTypes.UUID, allowNull: false },
      invoice_item_id: { type: DataTypes.UUID, allowNull: true },

      // 💱 🔥 REQUIRED (MULTI-CURRENCY SAFE)
      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      // 🔗 Policy
      discount_policy_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "discount_policies", key: "id" },
        onDelete: "SET NULL",
      },

      // 📌 Info
      name: { type: DataTypes.STRING, allowNull: false },
      code: { type: DataTypes.STRING },

      reason: { type: DataTypes.TEXT },

      type: {
        type: DataTypes.ENUM(...Object.values(DISCOUNT_TYPE)),
        allowNull: false,
      },

      value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },

      // 💰 🔥 STORE COMPUTED VALUE (IMPORTANT)
      applied_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM(...Object.values(DISCOUNT_STATUS)),
        allowNull: false,
        defaultValue: DISCOUNT_STATUS.DRAFT,
      },

      // 🛑 Lifecycle
      void_reason: { type: DataTypes.STRING(255) },
      voided_by_id: { type: DataTypes.UUID },
      voided_at: { type: DataTypes.DATE },

      finalized_by_id: { type: DataTypes.UUID },
      finalized_at: { type: DataTypes.DATE },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Discount",
      tableName: "discounts",
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
        active: { where: { status: DISCOUNT_STATUS.ACTIVE, deleted_at: null } },
        inactive: { where: { status: DISCOUNT_STATUS.INACTIVE, deleted_at: null } },
        tenant(facilityId) {
          return facilityId ? { where: { facility_id: facilityId } } : {};
        },
      },

      indexes: [
        {
          unique: true,
          fields: ["organization_id", "facility_id", "code"],
          name: "uq_discount_code_per_facility",
        },
        {
          fields: ["organization_id", "facility_id", "status"],
          name: "idx_discount_scope_status",
        },
        {
          fields: ["invoice_id", "invoice_item_id"],
          name: "idx_discount_invoice_links",
        },
        {
          fields: ["discount_policy_id"],
          name: "idx_discount_policy",
        },
      ],

      validate: {
        percentageWithinLimit() {
          if (this.type === DISCOUNT_TYPE.PERCENTAGE && parseFloat(this.value) > 100) {
            throw new Error("Percentage discount cannot exceed 100%");
          }
          if (this.type === DISCOUNT_TYPE.FIXED && parseFloat(this.value) < 0) {
            throw new Error("Fixed discount must be non-negative");
          }
        },
      },
    }
  );

  /* ============================================================
     🔁 HOOKS
  ============================================================ */

  // 🔥 Ensure currency matches invoice
  Discount.beforeValidate(async (discount) => {
    const { Invoice } = await import("../models/index.js");

    const invoice = await Invoice.findByPk(discount.invoice_id);
    if (!invoice) throw new Error("Invalid invoice_id");

    discount.currency = invoice.currency;
  });

  // 🔥 Apply discount logic BEFORE finalize
  Discount.beforeUpdate(async (discount) => {
    if (discount.status !== DISCOUNT_STATUS.FINALIZED) return;

    const { InvoiceItem } = await import("../models/index.js");

    let baseAmount = 0;

    if (discount.invoice_item_id) {
      const item = await InvoiceItem.findByPk(discount.invoice_item_id);
      if (!item) throw new Error("Invalid invoice_item_id");

      baseAmount = parseFloat(item.net_amount || 0);
    } else {
      const items = await InvoiceItem.findAll({
        where: { invoice_id: discount.invoice_id },
      });

      baseAmount = items.reduce((sum, i) => sum + parseFloat(i.net_amount || 0), 0);
    }

    let applied = 0;

    if (discount.type === DISCOUNT_TYPE.PERCENTAGE) {
      applied = baseAmount * (parseFloat(discount.value) / 100);
    } else {
      applied = parseFloat(discount.value);
    }

    discount.applied_amount = applied;
  });

  // 🔥 Recalculate invoice AFTER finalize
  Discount.afterUpdate(async (discount, options) => {
    try {
      if (discount.status !== DISCOUNT_STATUS.FINALIZED) return;

      const { financialService } = await import("../services/financialService.js");

      await financialService.recalcInvoice(
        discount.invoice_id,
        options?.transaction
      );
    } catch (err) {
      console.error("❌ Discount recalc failed:", err.message);
    }
  });

  return Discount;
};