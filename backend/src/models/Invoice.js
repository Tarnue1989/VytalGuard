// 📁 backend/src/models/Invoice.js
import { DataTypes, Model } from "sequelize";
import {
  INVOICE_STATUS,
  PAYER_TYPES,
  CURRENCY,
} from "../constants/enums.js";

export default (sequelize) => {
  class Invoice extends Model {
    static associate(models) {
      // 🔹 Core
      Invoice.belongsTo(models.Patient, {
        as: "patient",
        foreignKey: "patient_id",
      });

      // 🔹 Org / Facility
      Invoice.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      Invoice.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔹 Invoice Details
      Invoice.hasMany(models.InvoiceItem, {
        as: "items",
        foreignKey: "invoice_id",
        onDelete: "CASCADE",
        hooks: true,
      });

      Invoice.hasMany(models.Payment, {
        as: "payments",
        foreignKey: "invoice_id",
      });

      Invoice.hasMany(models.Refund, {
        as: "refunds",
        foreignKey: "invoice_id",
      });

      Invoice.hasMany(models.DiscountWaiver, {
        as: "waivers",
        foreignKey: "invoice_id",
      });

      Invoice.hasMany(models.Deposit, {
        as: "appliedDeposits",
        foreignKey: "applied_invoice_id",
      });

      // 🔹 Insurance
      Invoice.belongsTo(models.InsuranceProvider, {
        as: "insuranceProvider",
        foreignKey: "insurance_provider_id",
      });

      Invoice.belongsTo(models.InsuranceClaim, {
        as: "insuranceClaim",
        foreignKey: "insurance_claim_id",
      });

      // 🔹 Audit
      Invoice.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      Invoice.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });

      Invoice.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });
    }

    /* ============================================================
       🔁 Central Recalculation Method
    ============================================================ */
    static async recalculate(invoice_id, transaction = null) {
      const { financialService } = await import(
        "../services/financialService.js"
      );
      return await financialService.recalcInvoice(
        invoice_id,
        transaction
      );
    }
  }

  Invoice.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      /* ================= LINKS ================= */
      patient_id: { type: DataTypes.UUID, allowNull: false },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: true },

      /* ================= INFO ================= */
      invoice_number: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },

      invoice_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: sequelize.literal("CURRENT_DATE"),
      },

      module: { type: DataTypes.STRING },

      status: {
        type: DataTypes.ENUM(...Object.values(INVOICE_STATUS)),
        allowNull: false,
        defaultValue: INVOICE_STATUS.DRAFT,
      },

      payer_type: {
        type: DataTypes.ENUM(...Object.values(PAYER_TYPES)),
        allowNull: false,
        defaultValue: PAYER_TYPES.CASH,
      },

      /* ================= 💱 CURRENCY ================= */
      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
        defaultValue: CURRENCY.LRD,
      },

      due_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      is_locked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      /* ================= 💵 TOTALS ================= */
      subtotal: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      total_tax: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      total: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      total_discount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      total_paid: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      refunded_amount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      applied_deposits: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      balance: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      /* ================= 🏥 INSURANCE ================= */
      insurance_provider_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      insurance_claim_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      coverage_amount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },
      insurance_amount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },
      /* ================= 📸 SNAPSHOT (ENTERPRISE) ================= */

      // 🔹 Insurance snapshot (freeze at billing time)
      insurance_provider_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      coverage_amount_initial: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      coverage_currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: true,
      },

      // 🔹 FX snapshot (audit trail)
      fx_rate_used: {
        type: DataTypes.DECIMAL(18, 6),
        allowNull: true,
      },

      fx_from_currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: true,
      },

      fx_to_currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: true,
      },

      fx_timestamp: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      /* ================= NOTES ================= */
      void_reason: { type: DataTypes.TEXT },
      cancel_reason: { type: DataTypes.TEXT },
      notes: { type: DataTypes.TEXT },

      /* ================= AUDIT ================= */
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Invoice",
      tableName: "invoices",
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
          return facilityId
            ? { where: { facility_id: facilityId } }
            : {};
        },
      },

      indexes: [
        { fields: ["patient_id"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["status"] },
        { fields: ["payer_type"] },
        { fields: ["invoice_number"], unique: true },
      ],
    }
  );

  /* ============================================================
     🔁 HOOKS
  ============================================================ */

  // 🔒 Prevent editing locked invoices
  Invoice.beforeUpdate((invoice) => {
    if (invoice.is_locked) {
      throw new Error("Locked invoices cannot be modified");
    }
  });

  // 🔢 Generate invoice number + due date
  Invoice.beforeValidate(async (invoice) => {
    if (!invoice.invoice_number) {
      const lastInvoice = await Invoice.findOne({
        where: {
          organization_id: invoice.organization_id,
          facility_id: invoice.facility_id,
        },
        order: [["created_at", "DESC"]],
      });

      let seq = 1;

      if (lastInvoice?.invoice_number) {
        const match = lastInvoice.invoice_number.match(/(\d+)$/);
        if (match) seq = parseInt(match[1], 10) + 1;
      }

      const year = new Date().getFullYear();
      invoice.invoice_number = `INV-${year}-${String(seq).padStart(5, "0")}`;
    }

    if (!invoice.due_date) {
      const today = new Date();
      today.setDate(today.getDate() + 30);
      invoice.due_date = today.toISOString().slice(0, 10);
    }
  });

  // 🔹 Audit
  Invoice.beforeCreate((invoice, options) => {
    if (options.user) {
      invoice.created_by_id = options.user.id;
      invoice.updated_by_id = options.user.id;
    }
  });

  Invoice.beforeUpdate((invoice, options) => {
    if (options.user) {
      invoice.updated_by_id = options.user.id;
    }
  });

  Invoice.beforeDestroy((invoice, options) => {
    if (options.user) {
      invoice.deleted_by_id = options.user.id;
    }
  });

  return Invoice;
};