// 📁 backend/src/models/TicketActivity.js
import { DataTypes, Model } from "sequelize";
import { TICKET_ACTIVITY_TYPES } from "../constants/enums.js";

export default (sequelize) => {
  class TicketActivity extends Model {
    static associate(models) {

      // 🔹 Parent Ticket
      TicketActivity.belongsTo(models.SupportTicket, {
        foreignKey: "ticket_id",
        as: "ticket",
        onDelete: "CASCADE",
      });

      // 🔹 Performed By
      TicketActivity.belongsTo(models.Employee, {
        foreignKey: "performed_by",
        as: "performedByEmployee",
      });

      // 🔹 Organization
      TicketActivity.belongsTo(models.Organization, {
        foreignKey: "organization_id",
        as: "organization",
      });

      // 🔹 Facility
      TicketActivity.belongsTo(models.Facility, {
        foreignKey: "facility_id",
        as: "facility",
      });

      // 🔹 Audit
      TicketActivity.belongsTo(models.User, {
        foreignKey: "created_by",
        as: "createdByUser",
      });

      TicketActivity.belongsTo(models.User, {
        foreignKey: "updated_by",
        as: "updatedByUser",
      });

      TicketActivity.belongsTo(models.User, {
        foreignKey: "deleted_by",
        as: "deletedByUser",
      });
    }
  }

  TicketActivity.init({
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

    // 🔹 Parent Ticket
    ticket_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // 🔹 Activity
    activity_type: {
      type: DataTypes.ENUM(
        ...Object.values(TICKET_ACTIVITY_TYPES)
      ),
      allowNull: false,
    },

    old_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    new_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    // 🔹 Who Performed Action
    performed_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    is_system_generated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // 🔹 Source Tracking
    activity_source:{
      type:DataTypes.STRING(100),
      allowNull:true,
    },

    ip_address:{
      type:DataTypes.STRING(100),
      allowNull:true,
    },

    device_info:{
      type:DataTypes.TEXT,
      allowNull:true,
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
    modelName: "TicketActivity",
    tableName: "ticket_activities",
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

      byTicket(ticketId) {
        return {
          where: { ticket_id: ticketId },
        };
      },

      byType(activityType) {
        return {
          where: { activity_type: activityType },
        };
      },

      byFacility(facilityId) {
        return {
          where: { facility_id: facilityId },
        };
      },
    },

    indexes: [
      {
        fields: ["ticket_id"],
      },

      {
        fields: ["ticket_id", "created_at"],
      },

      {
        fields: ["activity_type"],
      },

      {
        fields: ["organization_id"],
      },

      {
        fields: ["facility_id"],
      },

      {
        fields: ["performed_by"],
      },

      {
        fields:["activity_source"],
      },

      {
        fields: ["created_at"],
      },
    ],
  });

  return TicketActivity;
};