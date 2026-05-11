// 📁 backend/src/models/SupportTicket.js
import { DataTypes, Model } from "sequelize";
import {
  SUPPORT_TICKET_STATUS,
  SUPPORT_TICKET_PRIORITY,
  SUPPORT_TICKET_CATEGORY,
} from "../constants/enums.js";

export default (sequelize) => {
  class SupportTicket extends Model {
    static associate(models) {

      // 🔹 Conversation
      SupportTicket.belongsTo(models.Conversation, {
        foreignKey: "conversation_id",
        as: "conversation",
        onDelete: "CASCADE",
      });

      // 🔹 Patient
      SupportTicket.belongsTo(models.Patient, {
        foreignKey: "patient_id",
        as: "patient",
      });

      // 🔹 Employee (creator/requester)
      SupportTicket.belongsTo(models.Employee, {
        foreignKey: "employee_id",
        as: "employee",
      });

      // 🔹 Assigned Staff
      SupportTicket.belongsTo(models.Employee, {
        foreignKey: "assigned_to",
        as: "assignedStaff",
      });

      // 🔹 Organization
      SupportTicket.belongsTo(models.Organization, {
        foreignKey: "organization_id",
        as: "organization",
      });

      // 🔹 Facility
      SupportTicket.belongsTo(models.Facility, {
        foreignKey: "facility_id",
        as: "facility",
      });

      // 🔹 Activities
      SupportTicket.hasMany(models.TicketActivity, {
        foreignKey: "ticket_id",
        as: "activities",
        onDelete: "CASCADE",
      });

      // 🔹 Audit
      SupportTicket.belongsTo(models.User, {
        foreignKey: "created_by",
        as: "createdByUser",
      });

      SupportTicket.belongsTo(models.User, {
        foreignKey: "updated_by",
        as: "updatedByUser",
      });

      SupportTicket.belongsTo(models.User, {
        foreignKey: "deleted_by",
        as: "deletedByUser",
      });
    }
  }

  SupportTicket.init({
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

    // 🔹 Linked Conversation
    conversation_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // 🔹 Participants
    patient_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    employee_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    assigned_to: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // 🔹 Ticket Identity
    ticket_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },

    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    internal_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // 🔹 Workflow
    status: {
      type: DataTypes.ENUM(
        ...Object.values(SUPPORT_TICKET_STATUS)
      ),
      allowNull: false,
      defaultValue: SUPPORT_TICKET_STATUS.OPEN,
    },

    priority: {
      type: DataTypes.ENUM(
        ...Object.values(SUPPORT_TICKET_PRIORITY)
      ),
      allowNull: false,
      defaultValue: SUPPORT_TICKET_PRIORITY.MEDIUM,
    },

    category: {
      type: DataTypes.ENUM(
        ...Object.values(SUPPORT_TICKET_CATEGORY)
      ),
      allowNull: false,
      defaultValue: SUPPORT_TICKET_CATEGORY.GENERAL,
    },

    is_escalated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    escalated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // 🔹 SLA / Lifecycle
    opened_at:{ type:DataTypes.DATE, allowNull:true },

    first_response_at:{ type:DataTypes.DATE, allowNull:true },

    resolved_at:{ type:DataTypes.DATE, allowNull:true },

    closed_at:{ type:DataTypes.DATE, allowNull:true },

    due_at:{ type:DataTypes.DATE, allowNull:true },

    sla_breached:{ type:DataTypes.BOOLEAN, defaultValue:false },

    reopened_count:{ type:DataTypes.INTEGER, defaultValue:0 },

    resolution_summary:{ type:DataTypes.TEXT, allowNull:true },

    closed_by:{ type:DataTypes.UUID, allowNull:true },

    // 🔹 Feedback
    rating: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    feedback_comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // 🔹 Advanced Metadata
    metadata:{ type:DataTypes.JSONB, allowNull:true },

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
    modelName: "SupportTicket",
    tableName: "support_tickets",
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

      open: {
        where: {
          status: SUPPORT_TICKET_STATUS.OPEN,
        },
      },

      byStatus(status) {
        return {
          where: { status },
        };
      },

      byPriority(priority) {
        return {
          where: { priority },
        };
      },

      byFacility(facilityId) {
        return {
          where: { facility_id: facilityId },
        };
      },

      byAssigned(userId) {
        return {
          where: { assigned_to: userId },
        };
      },
    },

    indexes: [
      {
        unique: true,
        fields: ["ticket_number"],
      },

      {
        fields: ["organization_id"],
      },

      {
        fields: ["facility_id"],
      },

      {
        fields: ["status"],
      },

      {
        fields: ["priority"],
      },

      {
        fields: ["assigned_to"],
      },

      {
        fields: ["conversation_id"],
      },

      {
        fields: ["patient_id"],
      },

      {
        fields: ["employee_id"],
      },

      {
        fields: ["due_at"],
      },

      {
        fields: ["sla_breached"],
      },

      {
        fields: ["created_at"],
      },
    ],
  });

  return SupportTicket;
};