import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class Conversation extends Model {
    static associate(models) {
      // 🔹 Messages in this conversation
      Conversation.hasMany(models.Message, {
        foreignKey: "conversation_id",
        as: "messages",
        onDelete: "CASCADE",
      });

      // 🔹 Participants (generic links)
      Conversation.belongsTo(models.Patient, {
        foreignKey: "patient_id",
        as: "patient",
      });
      Conversation.belongsTo(models.Employee, {
        foreignKey: "employee_id",
        as: "employee",
      });

      // 🔹 Org / Facility scope
      Conversation.belongsTo(models.Organization, {
        foreignKey: "organization_id",
        as: "organization",
        onDelete: "CASCADE",
      });
      Conversation.belongsTo(models.Facility, {
        foreignKey: "facility_id",
        as: "facility",
        onDelete: "CASCADE",
      });

      // 🔹 Audit trail
      Conversation.belongsTo(models.User, { foreignKey: "created_by", as: "createdByUser" });
      Conversation.belongsTo(models.User, { foreignKey: "updated_by", as: "updatedByUser" });
      Conversation.belongsTo(models.User, { foreignKey: "deleted_by", as: "deletedByUser" });
    }
  }

  Conversation.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

      // Scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Participants
      patient_id: { type: DataTypes.UUID, allowNull: true },
      employee_id: { type: DataTypes.UUID, allowNull: true },

      // Meta
      topic: { type: DataTypes.STRING(255), allowNull: true },
      conversation_type: {
        type: DataTypes.ENUM("internal", "clinical", "helpdesk"),
        allowNull: false,
        defaultValue: "internal",
      },

      // Audit
      created_by: { type: DataTypes.UUID },
      updated_by: { type: DataTypes.UUID },
      deleted_by: { type: DataTypes.UUID },
    },
    {
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
        attributes: { exclude: ["deleted_at", "deleted_by"] },
      },
      scopes: {
        withDeleted: { paranoid: false },
        byPatient(patientId) {
          return { where: { patient_id: patientId } };
        },
        byEmployee(employeeId) {
          return { where: { employee_id: employeeId } };
        },
        byFacility(facilityId) {
          return { where: { facility_id: facilityId } };
        },
      },
      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
      },
      scopes: {
        withDeleted: { paranoid: false },
        active: { where: { status: "active" } },
        inactive: { where: { status: "inactive" } },
        // 🔑 Needed for setTenantScope
        tenant(facilityId) {
          if (!facilityId) return {}; // superadmin fallback (no filter)
          return { where: { facility_id: facilityId } };
        },
      },

      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["patient_id"] },
        { fields: ["employee_id"] },
      ],
    }
  );

  return Conversation;
};
