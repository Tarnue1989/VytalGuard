// 📁 backend/src/models/ConversationParticipant.js
import { DataTypes, Model } from "sequelize";
import {
  MESSAGE_PARTICIPANT_ROLES,
} from "../constants/enums.js";

export default (sequelize) => {
  class ConversationParticipant extends Model {
    static associate(models) {
      // 🔹 Conversation
      ConversationParticipant.belongsTo(models.Conversation, {
        foreignKey: "conversation_id",
        as: "conversation",
        onDelete: "CASCADE",
      });

      // 🔹 Employee
      ConversationParticipant.belongsTo(models.Employee, {
        foreignKey: "participant_id",
        constraints: false,
        as: "employeeParticipant",
      });

      // 🔹 Patient
      ConversationParticipant.belongsTo(models.Patient, {
        foreignKey: "participant_id",
        constraints: false,
        as: "patientParticipant",
      });

      // 🔹 Organization
      ConversationParticipant.belongsTo(models.Organization, {
        foreignKey: "organization_id",
        as: "organization",
      });

      // 🔹 Facility
      ConversationParticipant.belongsTo(models.Facility, {
        foreignKey: "facility_id",
        as: "facility",
      });

      // 🔹 Audit
      ConversationParticipant.belongsTo(models.User, {
        foreignKey: "created_by",
        as: "createdByUser",
      });

      ConversationParticipant.belongsTo(models.User, {
        foreignKey: "updated_by",
        as: "updatedByUser",
      });

      ConversationParticipant.belongsTo(models.User, {
        foreignKey: "deleted_by",
        as: "deletedByUser",
      });
    }
  }

  ConversationParticipant.init(
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

      // 🔹 Participant
      participant_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      participant_role: {
        type: DataTypes.ENUM(
          ...Object.values(MESSAGE_PARTICIPANT_ROLES)
        ),
        allowNull: false,
      },

      // 🔹 Chat State
      is_admin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      is_muted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      is_archived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      joined_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      left_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      last_read_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      last_read_message_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      // 🔹 Unread Tracking
      unread_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },

      // 🔹 Notification Preferences
      notifications_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      // 🔹 Delivery Tracking
      last_delivered_message_id: {
        type: DataTypes.UUID,
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
    },
    {
      sequelize,
      modelName: "ConversationParticipant",
      tableName: "conversation_participants",
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

        byConversation(conversationId) {
          return {
            where: { conversation_id: conversationId },
          };
        },

        byParticipant(participantId) {
          return {
            where: { participant_id: participantId },
          };
        },

        byRole(role) {
          return {
            where: { participant_role: role },
          };
        },
      },

      indexes: [
        {
          fields: ["conversation_id"],
        },

        {
          fields: ["participant_id"],
        },

        {
          fields: ["participant_role"],
        },

        {
          fields: ["organization_id"],
        },

        {
          fields: ["facility_id"],
        },

        {
          fields: ["last_read_at"],
        },

        {
          fields: ["last_read_message_id"],
        },

        {
          fields: ["unread_count"],
        },

        {
          fields: ["notifications_enabled"],
        },

        {
          unique: true,
          fields: [
            "conversation_id",
            "participant_id",
            "participant_role",
          ],
        },
      ],
    }
  );

  return ConversationParticipant;
};