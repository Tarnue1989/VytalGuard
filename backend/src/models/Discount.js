// 📁 backend/src/models/Discount.js
import { DataTypes, Model } from "sequelize";
import { DISCOUNT_TYPE, DISCOUNT_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Discount extends Model {
    static associate(models) {
      // 🔹 Tenant scope
      Discount.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });
      Discount.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔹 Direct invoice / invoice item links
      Discount.belongsTo(models.Invoice, {
        as: "invoice",
        foreignKey: "invoice_id",
      });
      Discount.belongsTo(models.InvoiceItem, {
        as: "invoiceItem",
        foreignKey: "invoice_item_id",
      });

      // 🔹 Reverse link (if invoice_items also reference discounts)
      Discount.hasMany(models.InvoiceItem, {
        as: "invoiceItems",
        foreignKey: "discount_id",
      });

      // 🔹 Link to Discount Policy
      Discount.belongsTo(models.DiscountPolicy, {
        as: "policy",
        foreignKey: "discount_policy_id",
      });

      // 🔹 Audit: User references
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

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: true },

      // 🔗 Invoice linkage
      invoice_id: { type: DataTypes.UUID, allowNull: false },
      invoice_item_id: { type: DataTypes.UUID, allowNull: true },

      // 🔗 Discount Policy linkage
      discount_policy_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "discount_policies", key: "id" },
        onDelete: "SET NULL",
      },

      // 📌 Discount info
      name: { type: DataTypes.STRING, allowNull: false },
      code: { type: DataTypes.STRING, allowNull: true },
      reason: { type: DataTypes.TEXT },
      type: { type: DataTypes.ENUM(...DISCOUNT_TYPE), allowNull: false }, // percentage | fixed
      value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        comment: "If percentage: 10 = 10%, if fixed: absolute amount",
      },

      status: {
        type: DataTypes.ENUM(...DISCOUNT_STATUS),
        allowNull: false,
        defaultValue: "draft",
      },

      // 🛑 Lifecycle control
      void_reason: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: "Reason why discount was voided",
      },
      voided_by_id: { type: DataTypes.UUID, allowNull: true },
      voided_at: { type: DataTypes.DATE, allowNull: true },

      finalized_by_id: { type: DataTypes.UUID, allowNull: true },
      finalized_at: { type: DataTypes.DATE, allowNull: true },

      // 🔹 Audit trail
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
        active: { where: { status: "active", deleted_at: null } },
        inactive: { where: { status: "inactive", deleted_at: null } },
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
          if (this.type === "percentage" && parseFloat(this.value) > 100) {
            throw new Error("Percentage discount cannot exceed 100%");
          }
          if (this.type === "fixed" && parseFloat(this.value) < 0) {
            throw new Error("Fixed discount value must be non-negative");
          }
        },
      },
    }
  );
  /* ============================================================
    🔁 APPLY DISCOUNT (FINAL – TRIGGER ONLY)
  ============================================================ */
  Discount.afterUpdate(async (discount, options) => {
    try {
      if (discount.status !== "finalized") return;

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
