// 📘 patientChartViewLog.js – Patient Chart View Log Model
import { DataTypes } from "sequelize";
import { PATIENT_CHART_VIEW_ACTION } from "../constants/enums.js";

export default (sequelize) => {
  const PatientChartViewLog = sequelize.define(
    "PatientChartViewLog",
    {
      /* ============================================================
         🧠 Core Identifiers
      ============================================================ */
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: "Primary key for the chart view log entry",
      },

      patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: "Patient whose chart was viewed/exported/printed",
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: "User who performed the view/export/print action",
      },
      organization_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "Organization scope of the event",
      },
      facility_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "Facility where the chart was accessed",
      },
      /* ============================================================
        📋 View Action Metadata
      ============================================================ */
      action: {
        type: DataTypes.ENUM(...Object.values(PATIENT_CHART_VIEW_ACTION)),
        allowNull: false,
        defaultValue: PATIENT_CHART_VIEW_ACTION.VIEW,
        comment: "Action performed on the patient chart (view/export/print)",
      },
      viewed_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: "Timestamp when the chart was accessed",
      },
      ip_address: {
        type: DataTypes.STRING(64),
        allowNull: true,
        comment: "IP address of the user who accessed the chart",
      },
      user_agent: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: "Browser or client information of the viewer",
      },

      /* ============================================================
         🧾 Detailed Audit Trail (Enterprise Standard)
      ============================================================ */
      // 🟢 Creation
      created_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "User who created this log entry",
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: "Timestamp when this record was created",
      },

      // 🟡 Last Update
      updated_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "User who last updated this record",
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: "Timestamp when this record was last updated",
      },

      // 🔴 Deletion / Voiding
      deleted_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "User who deleted or voided this record",
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "Timestamp when this record was soft-deleted",
      },

      // 🧩 Review & Verification Audit (optional)
      reviewed_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "User who reviewed this log entry",
      },
      reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "Timestamp when this log was reviewed",
      },
      verified_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "User who verified or confirmed this log entry",
      },
      verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "Timestamp when this log entry was verified",
      },
    },
    {
      tableName: "patient_chart_view_logs",
      paranoid: true,
      underscored: true,
      timestamps: false, // handled manually
      comment: "Logs of all patient chart views, exports, and prints by users",
    }
  );

  /* ============================================================
     🔗 Associations
  ============================================================ */
  PatientChartViewLog.associate = (models) => {
    // Core entity relations
    PatientChartViewLog.belongsTo(models.Patient, {
      foreignKey: "patient_id",
      as: "patient",
    });
    PatientChartViewLog.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "viewer",
    });
    PatientChartViewLog.belongsTo(models.Organization, {
      foreignKey: "organization_id",
      as: "organization",
    });
    PatientChartViewLog.belongsTo(models.Facility, {
      foreignKey: "facility_id",
      as: "facility",
    });

    // Audit user relations
    PatientChartViewLog.belongsTo(models.User, {
      foreignKey: "created_by_id",
      as: "created_by",
    });
    PatientChartViewLog.belongsTo(models.User, {
      foreignKey: "updated_by_id",
      as: "updated_by",
    });
    PatientChartViewLog.belongsTo(models.User, {
      foreignKey: "deleted_by_id",
      as: "deleted_by",
    });
    PatientChartViewLog.belongsTo(models.User, {
      foreignKey: "reviewed_by_id",
      as: "reviewed_by",
    });
    PatientChartViewLog.belongsTo(models.User, {
      foreignKey: "verified_by_id",
      as: "verified_by",
    });
  };

  return PatientChartViewLog;
};
