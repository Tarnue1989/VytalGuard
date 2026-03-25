// 📁 backend/src/models/OrderItem.js
import { DataTypes, Model } from "sequelize";
import {
  ORDER_ITEM_STATUS,
  ORDER_BILLING_STATUS,
} from "../constants/enums.js";

export default (sequelize) => {
  class OrderItem extends Model {
    static associate(models) {
      OrderItem.belongsTo(models.Order, {
        as: "order",
        foreignKey: "order_id",
      });

      OrderItem.belongsTo(models.BillableItem, {
        as: "billableItem",
        foreignKey: "billable_item_id",
      });

      OrderItem.belongsTo(models.InvoiceItem, {
        as: "invoiceItem",
        foreignKey: "invoice_item_id",
      });

      OrderItem.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      OrderItem.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      OrderItem.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      OrderItem.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });

      OrderItem.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });
    }
  }

  OrderItem.init(
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
      order_id: { type: DataTypes.UUID, allowNull: false },
      billable_item_id: { type: DataTypes.UUID, allowNull: false },
      invoice_item_id: { type: DataTypes.UUID },

      // 💰 Pricing
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

        unit_price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        },
        total_price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        },

      // 🔄 Lifecycle
      status: {
        type: DataTypes.ENUM(...ORDER_ITEM_STATUS),
        allowNull: false,
        defaultValue: ORDER_ITEM_STATUS[0],
      },

      billing_status: {
        type: DataTypes.ENUM(...ORDER_BILLING_STATUS),
        allowNull: false,
        defaultValue: "not_billed",
      },

      billed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      notes: { type: DataTypes.TEXT },

      // 🧾 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: false },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "OrderItem",
      tableName: "order_items",
      underscored: true,
      paranoid: true,
      timestamps: true,

      indexes: [
        { fields: ["order_id"] },
        { fields: ["billable_item_id"] },

        // 🔥 MATCH LAB UNIQUE
        {
          unique: true,
          fields: ["order_id", "billable_item_id"],
          name: "unique_order_item_per_billable",
        },
      ],
    }
  );

  /* ================= HOOKS ================= */

  OrderItem.addHook("beforeValidate", async (item) => {
    if (!item.unit_price && item.billable_item_id) {
      const billable = await sequelize.models.BillableItem.findByPk(
        item.billable_item_id
      );
      if (billable) {
        item.unit_price = Number(billable.price || 0);
      }
    }

    if (item.quantity && item.unit_price) {
      item.total_price = item.quantity * item.unit_price;
    }
  });

  OrderItem.addHook("beforeSave", (item) => {
    if (!item.invoice_item_id) {
      item.billing_status = "not_billed";
    } else if (item.billing_status === "not_billed") {
      item.billing_status = "billed";
    }

    // 🔥 MATCH LAB
    if (item.invoice_item_id && !item.billed) {
      item.billed = true;
    }
  });

  return OrderItem;
};