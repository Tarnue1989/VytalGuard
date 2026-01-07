// 📁 backend/src/models/ConsultationStaff.js
import { DataTypes, Model } from "sequelize";
import { CONSULTATION_STAFF_ROLES } from "../constants/enums.js";

export default (sequelize) => {
  class ConsultationStaff extends Model {
    static associate(models) {
      // 🔹 Parent Consultation
      ConsultationStaff.belongsTo(models.Consultation, {
        as: "consultation",
        foreignKey: "consultation_id",
        onDelete: "CASCADE",
      });

      // 🔹 Employee (nurse, midwife, etc.)
      ConsultationStaff.belongsTo(models.Employee, {
        as: "employee",
        foreignKey: "employee_id",
        onDelete: "CASCADE",
      });

      // 🔹 Org / Facility scope
      ConsultationStaff.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });
      ConsultationStaff.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔹 Audit
      ConsultationStaff.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });
      ConsultationStaff.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });
      ConsultationStaff.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });
    }
  }

  ConsultationStaff.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Foreign Keys
      consultation_id: { type: DataTypes.UUID, allowNull: false },
      employee_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: true },

      // 🏷️ Staff role
      role: {
        type: DataTypes.ENUM(...CONSULTATION_STAFF_ROLES),
        allowNull: false,
      },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "ConsultationStaff",
      tableName: "consultation_staff",
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
        active: { where: { deleted_at: null } },

        // 🔑 Tenant scope → required for setTenantScope
        tenant(facilityId) {
          if (!facilityId) return {}; // safeguard superadmin case
          return { where: { facility_id: facilityId } };
        },
      },

      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["consultation_id"] },
        { fields: ["employee_id"] },
        { fields: ["role"] },
      ],

    }
  );

  /* ============================================================
     🔁 Hooks
  ============================================================ */
  // Sync org/facility from parent consultation
  ConsultationStaff.beforeCreate(async (staff) => {
    const db = require("../models");
    const consultation = await db.Consultation.findByPk(staff.consultation_id);
    if (!consultation) throw new Error("Invalid consultation_id for staff");

    staff.organization_id = consultation.organization_id;
    staff.facility_id = consultation.facility_id;
  });

  return ConsultationStaff;
};
