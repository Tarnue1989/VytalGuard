// 📁 backend/src/models/Message.js
import { DataTypes, Model } from "sequelize";
import {
  MESSAGE_PARTICIPANT_ROLES,
  MESSAGE_TYPES,
  MESSAGE_STATUS,
  CONVERSATION_TYPES,
} from "../constants/enums.js";

export default (sequelize) => {
  class Message extends Model {
    static associate(models) {
      // 🔹 Sender Employee
      Message.belongsTo(models.Employee, {
        foreignKey: "sender_id",
        constraints: false,
        as: "senderEmployee",
      });

      // 🔹 Receiver Employee
      Message.belongsTo(models.Employee, {
        foreignKey: "receiver_id",
        constraints: false,
        as: "receiverEmployee",
      });

      // 🔹 Sender Patient
      Message.belongsTo(models.Patient, {
        foreignKey: "sender_id",
        constraints: false,
        as: "senderPatient",
      });

      // 🔹 Receiver Patient
      Message.belongsTo(models.Patient, {
        foreignKey: "receiver_id",
        constraints: false,
        as: "receiverPatient",
      });

      // 🔹 Conversation
      Message.belongsTo(models.Conversation, {
        foreignKey: "conversation_id",
        as: "conversation",
        onDelete: "CASCADE",
      });

      // 🔹 Attachments
      Message.hasMany(models.MessageAttachment, {
        foreignKey: "message_id",
        as: "attachments",
        onDelete: "CASCADE",
      });

      // 🔹 Reply Message
      Message.belongsTo(models.Message, {
        foreignKey: "reply_to_message_id",
        as: "replyToMessage",
      });

      // 🔹 Replies
      Message.hasMany(models.Message, {
        foreignKey: "reply_to_message_id",
        as: "replies",
      });

      // 🔹 Organization
      Message.belongsTo(models.Organization, {
        foreignKey: "organization_id",
        as: "organization",
      });

      // 🔹 Facility
      Message.belongsTo(models.Facility, {
        foreignKey: "facility_id",
        as: "facility",
      });

      // 🔹 Audit
      Message.belongsTo(models.User, {
        foreignKey: "created_by",
        as: "createdByUser",
      });

      Message.belongsTo(models.User, {
        foreignKey: "updated_by",
        as: "updatedByUser",
      });

      Message.belongsTo(models.User, {
        foreignKey: "deleted_by",
        as: "deletedByUser",
      });
    }
  }

  Message.init(
    {
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

      // 🔹 Conversation
      conversation_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      // 🔹 Sender
      sender_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      sender_role: {
        type: DataTypes.ENUM(
          ...Object.values(MESSAGE_PARTICIPANT_ROLES)
        ),
        allowNull: false,
      },

      // 🔹 Receiver
      receiver_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      receiver_role: {
        type: DataTypes.ENUM(
          ...Object.values(MESSAGE_PARTICIPANT_ROLES)
        ),
        allowNull: true,
      },

      // 🔹 Message Content
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      message_type: {
        type: DataTypes.ENUM(
          ...Object.values(MESSAGE_TYPES)
        ),
        allowNull: false,
        defaultValue: MESSAGE_TYPES.TEXT,
      },

      chat_type: {
        type: DataTypes.ENUM(
          ...Object.values(CONVERSATION_TYPES)
        ),
        allowNull: false,
        defaultValue: CONVERSATION_TYPES.INTERNAL,
      },

      // 🔹 Message State
      status: {
        type: DataTypes.ENUM(
          ...Object.values(MESSAGE_STATUS)
        ),
        allowNull: false,
        defaultValue: MESSAGE_STATUS.SENT,
      },

      is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      read_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      is_edited: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      edited_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      is_pinned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      is_system_generated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      deleted_for_everyone: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      // 🔹 Delivery Tracking
      delivered_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      // 🔹 Advanced Metadata
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      // 🔹 Reply Support
      reply_to_message_id: {
        type: DataTypes.UUID,
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
    },
    {
      sequelize,
      modelName: "Message",
      tableName: "messages",
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
            is_read: false,
          },
        },

        byConversation(conversationId) {
          return {
            where: { conversation_id: conversationId },
          };
        },

        bySender(senderId) {
          return {
            where: { sender_id: senderId },
          };
        },

        byReceiver(receiverId) {
          return {
            where: { receiver_id: receiverId },
          };
        },

        byStatus(status) {
          return {
            where: { status },
          };
        },
      },

      indexes: [
        {
          fields: ["conversation_id"],
        },

        {
          fields: ["conversation_id", "created_at"],
        },

        {
          fields: ["sender_id"],
        },

        {
          fields: ["receiver_id"],
        },

        {
          fields: ["status"],
        },

        {
          fields: ["message_type"],
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

        {
          fields: ["reply_to_message_id"],
        },
      ],
    }
  );

  return Message;
};