// 📁 backend/src/models/Notification.js
import { DataTypes, Model } from "sequelize";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
} from "../constants/enums.js";

export default (sequelize) => {
  class Notification extends Model {
    static associate(models) {

      // 🔹 Recipient User
      Notification.belongsTo(models.User, {
        foreignKey: "user_id",
        as: "user",
      });

      // 🔹 Organization
      Notification.belongsTo(models.Organization, {
        foreignKey: "organization_id",
        as: "organization",
      });

      // 🔹 Facility
      Notification.belongsTo(models.Facility, {
        foreignKey: "facility_id",
        as: "facility",
      });

      // 🔹 Audit
      Notification.belongsTo(models.User, {
        foreignKey: "created_by",
        as: "createdByUser",
      });

      Notification.belongsTo(models.User, {
        foreignKey: "updated_by",
        as: "updatedByUser",
      });

      Notification.belongsTo(models.User, {
        foreignKey: "deleted_by",
        as: "deletedByUser",
      });
    }
  }

  Notification.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // 🔹 Tenant Scope
    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    facility_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // 🔹 Recipient
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // 🔹 Notification Content
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    // 🔹 Notification Type
    type: {
      type: DataTypes.ENUM(
        ...Object.values(NOTIFICATION_TYPES)
      ),
      allowNull: false,
    },

    // 🔹 Linked Entity
    reference_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    reference_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // 🔹 Delivery
    channel: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    delivery_status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    failed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    failure_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // 🔹 Read State
    status: {
      type: DataTypes.ENUM(
        ...Object.values(NOTIFICATION_STATUS)
      ),
      allowNull: false,
      defaultValue: NOTIFICATION_STATUS.UNREAD,
    },

    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    is_seen: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    seen_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // 🔹 Advanced Metadata
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    // 🔹 Audit
    created_by: {
      type: DataTypes.UUID,
    },

    updated_by: {
      type: DataTypes.UUID,
    },

    deleted_by: {
      type: DataTypes.UUID,
    },
  }, {
    sequelize,
    modelName: "Notification",
    tableName: "notifications",
    underscored: true,
    paranoid: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",

    defaultScope: {
      attributes: {
        exclude: ["deleted_at", "deleted_by"],
      },
    },

    scopes: {
      withDeleted: {
        paranoid: false,
      },

      unread: {
        where: {
          status: NOTIFICATION_STATUS.UNREAD,
        },
      },

      read: {
        where: {
          status: NOTIFICATION_STATUS.READ,
        },
      },

      byUser(userId) {
        return {
          where: { user_id: userId },
        };
      },

      byType(type) {
        return {
          where: { type },
        };
      },
    },

    indexes: [
      {
        fields: ["user_id"],
      },

      {
        fields: ["type"],
      },

      {
        fields: ["status"],
      },

      {
        fields: ["channel"],
      },

      {
        fields: ["delivery_status"],
      },

      {
        fields: ["reference_id"],
      },

      {
        fields: ["reference_type"],
      },

      {
        fields: ["organization_id"],
      },

      {
        fields: ["facility_id"],
      },

      {
        fields: ["created_at"],
      },
    ],
  });

  return Notification;
};