// 📁 backend/src/models/Order.js
import { DataTypes, Model } from "sequelize";
import {
  ORDER_STATUS,
  ORDER_TYPE,
  ORDER_PRIORITY,
  ORDER_FULFILLMENT_STATUS,
  ORDER_BILLING_STATUS,
} from "../constants/enums.js";

export default (sequelize) => {
  class Order extends Model {
    static associate(models) {
      // 🔗 Core
      Order.belongsTo(models.Patient, {
        as: "patient",
        foreignKey: "patient_id",
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      Order.belongsTo(models.Employee, {
        as: "provider",
        foreignKey: "provider_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      Order.belongsTo(models.Consultation, {
        as: "consultation",
        foreignKey: "consultation_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      // 🔗 Clinical (🔥 FIX ADDED — MATCH LAB REQUEST)
      Order.belongsTo(models.Department, {
        as: "department",
        foreignKey: "department_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      Order.belongsTo(models.RegistrationLog, {
        as: "registrationLog",
        foreignKey: "registration_log_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      // 🔗 Billing
      Order.belongsTo(models.Invoice, {
        as: "invoice",
        foreignKey: "invoice_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      // 🔗 Items
      Order.hasMany(models.OrderItem, {
        as: "items",
        foreignKey: "order_id",
      });

      // 🔗 Tenant
      Order.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      Order.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔗 Audit
      Order.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      Order.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });

      Order.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });

      Order.belongsTo(models.User, {
        as: "statusChangedBy",
        foreignKey: "status_changed_by_id",
      });
    }
  }

  Order.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      // 🧭 Tenant
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🧾 Core
      patient_id: { type: DataTypes.UUID, allowNull: false },
      provider_id: { type: DataTypes.UUID },
      consultation_id: { type: DataTypes.UUID },

      // 🔗 Clinical (🔥 FIX ADDED)
      department_id: { type: DataTypes.UUID },
      registration_log_id: { type: DataTypes.UUID },

      type: {
        type: DataTypes.ENUM(...ORDER_TYPE),
        allowNull: false,
        defaultValue: ORDER_TYPE[0],
      },

      priority: {
        type: DataTypes.ENUM(...ORDER_PRIORITY),
        allowNull: false,
        defaultValue: "routine",
      },

      // 💰 Billing
      invoice_id: { type: DataTypes.UUID },

      billing_status: {
        type: DataTypes.ENUM(...ORDER_BILLING_STATUS),
        allowNull: false,
        defaultValue: "not_billed",
      },

      billed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      currency: {
        type: DataTypes.STRING,
        defaultValue: "LRD",
      },

      total_amount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      // 📦 Fulfillment
      fulfillment_status: {
        type: DataTypes.ENUM(...ORDER_FULFILLMENT_STATUS),
        allowNull: false,
        defaultValue: "pending",
      },

      // 📅 Date
      order_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      // 🔄 Lifecycle
      status: {
        type: DataTypes.ENUM(...ORDER_STATUS),
        allowNull: false,
        defaultValue: ORDER_STATUS[0],
      },

      status_changed_at: { type: DataTypes.DATE },
      status_changed_by_id: { type: DataTypes.UUID },

      // 📝 Meta
      notes: { type: DataTypes.TEXT },

      // 🧾 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: false },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Order",
      tableName: "orders",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",

      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["organization_id", "facility_id"] },
        { fields: ["patient_id"] },
        { fields: ["status"] },
      ],
    }
  );

  /* ================= HOOKS ================= */

  Order.addHook("beforeSave", (order) => {
    if (!order.invoice_id) {
      order.billing_status = "not_billed";
    } else if (order.billing_status === "not_billed") {
      order.billing_status = "billed";
    }

    if (order.invoice_id && !order.billed) {
      order.billed = true;
    }
  });

  Order.addHook("beforeUpdate", (order) => {
    if (order.changed("status")) {
      order.status_changed_at = new Date();
    }
  });

  return Order;
};