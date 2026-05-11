// 📁 backend/src/models/Conversation.js
import { DataTypes, Model } from "sequelize";
import { CONVERSATION_TYPES, CONVERSATION_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Conversation extends Model {
    static associate(models) {

      // 🔹 Messages
      Conversation.hasMany(models.Message, {
        foreignKey: "conversation_id",
        as: "messages",
        onDelete: "CASCADE",
      });

      // 🔹 Participants
      Conversation.hasMany(models.ConversationParticipant, {
        foreignKey: "conversation_id",
        as: "participants",
        onDelete: "CASCADE",
      });

      // 🔹 Support Tickets
      Conversation.hasMany(models.SupportTicket, {
        foreignKey: "conversation_id",
        as: "tickets",
      });

      // 🔹 Last Message
      Conversation.belongsTo(models.Message, {
        foreignKey: "last_message_id",
        as: "lastMessage",
        constraints: false,
      });

      // 🔹 Patient
      Conversation.belongsTo(models.Patient, {
        foreignKey: "patient_id",
        as: "patient",
      });

      // 🔹 Employee
      Conversation.belongsTo(models.Employee, {
        foreignKey: "employee_id",
        as: "employee",
      });

      // 🔹 Organization
      Conversation.belongsTo(models.Organization, {
        foreignKey: "organization_id",
        as: "organization",
        onDelete: "CASCADE",
      });

      // 🔹 Facility
      Conversation.belongsTo(models.Facility, {
        foreignKey: "facility_id",
        as: "facility",
        onDelete: "CASCADE",
      });

      // 🔹 Audit
      Conversation.belongsTo(models.User, {
        foreignKey: "created_by",
        as: "createdByUser",
      });

      Conversation.belongsTo(models.User, {
        foreignKey: "updated_by",
        as: "updatedByUser",
      });

      Conversation.belongsTo(models.User, {
        foreignKey: "deleted_by",
        as: "deletedByUser",
      });
    }
  }

  Conversation.init({
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

    // 🔹 Optional Main Participants
    patient_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    employee_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // 🔹 Conversation Meta
    topic: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    group_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    group_avatar: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        ...Object.values(CONVERSATION_STATUS)
      ),
      allowNull: false,
      defaultValue: CONVERSATION_STATUS.ACTIVE,
    },

    conversation_type: {
      type: DataTypes.ENUM(
        ...Object.values(CONVERSATION_TYPES)
      ),
      allowNull: false,
      defaultValue: CONVERSATION_TYPES.INTERNAL,
    },

    // 🔹 Chat State
    is_group: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    is_archived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // 🔹 Conversation Controls
    is_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    allow_attachments: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    allow_replies: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    // 🔹 Message Tracking
    last_message_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // 🔹 Lifecycle
    closed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    locked_at: {
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
    modelName: "Conversation",
    tableName: "conversations",
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

      active: {
        where: {
          status: CONVERSATION_STATUS.ACTIVE,
        },
      },

      byPatient(patientId) {
        return {
          where: { patient_id: patientId },
        };
      },

      byEmployee(employeeId) {
        return {
          where: { employee_id: employeeId },
        };
      },

      byFacility(facilityId) {
        return {
          where: { facility_id: facilityId },
        };
      },

      byType(type) {
        return {
          where: { conversation_type: type },
        };
      },

      tenant(facilityId) {
        if (!facilityId) return {};

        return {
          where: { facility_id: facilityId },
        };
      },
    },

    indexes: [
      {
        fields: ["organization_id"],
      },

      {
        fields: ["facility_id"],
      },

      {
        fields: ["patient_id"],
      },

      {
        fields: ["employee_id"],
      },

      {
        fields: ["conversation_type"],
      },

      {
        fields: ["status"],
      },

      {
        fields: ["is_group"],
      },

      {
        fields: ["is_locked"],
      },

      {
        fields: ["last_message_id"],
      },

      {
        fields: ["last_message_at"],
      },

      {
        fields: ["created_at"],
      },

      {
        fields: [
          "patient_id",
          "employee_id",
          "conversation_type",
        ],
      },
    ],
  });

  return Conversation;
};