// 📘 patientChartNote.js – Patient Chart Notes Model
import { DataTypes } from "sequelize";
import {
  PATIENT_CHART_NOTE_TYPE,
  MEDICAL_RECORD_STATUS,
} from "../constants/enums.js";

export default (sequelize) => {
  const PatientChartNote = sequelize.define(
    "PatientChartNote",
    {
      /* ============================================================
         🧠 Core Identifiers
      ============================================================ */
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: "Primary key for chart note record",
      },

      patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: "Patient associated with this chart note",
      },
      organization_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "Organization scope of this chart note",
      },
      facility_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "Facility scope of this chart note",
      },

      author_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: "User who authored this note",
      },
      /* ============================================================
        🩺 Note Classification & Lifecycle
      ============================================================ */
      note_type: {
        type: DataTypes.ENUM(...Object.values(PATIENT_CHART_NOTE_TYPE)),
        allowNull: false,
        defaultValue: PATIENT_CHART_NOTE_TYPE.DOCTOR,
        comment: "Type of note (doctor, nurse, admin, system)",
      },
      status: {
        type: DataTypes.ENUM(...Object.values(MEDICAL_RECORD_STATUS)),
        allowNull: false,
        defaultValue: MEDICAL_RECORD_STATUS.DRAFT,
        comment: "Current lifecycle status of this chart note",
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "Full text content of the patient chart note",
      },

      /* ============================================================
         🧾 Detailed Audit Trail (Enterprise Standard)
      ============================================================ */
      // 🟢 Creation
      created_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "User who created this chart note",
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: "When this note was created",
      },

      // 🟡 Update
      updated_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "User who last modified this note",
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: "When this note was last updated",
      },

      // 🔴 Deletion / Voiding
      deleted_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "User who deleted or voided this note",
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "When this note was soft-deleted or voided",
      },

      // 🧩 Review & Verification Lifecycle
      reviewed_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "User who reviewed this chart note",
      },
      reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "When this chart note was reviewed",
      },
      verified_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "User who verified/finalized this chart note",
      },
      verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "When this chart note was verified/finalized",
      },
    },
    {
      tableName: "patient_chart_notes",
      paranoid: true,
      underscored: true,
      timestamps: false, // handled manually
      comment: "Clinical notes or documentation attached to a patient's chart",
    }
  );

  /* ============================================================
     🔗 Associations
  ============================================================ */
  PatientChartNote.associate = (models) => {
    // Core Relations
    PatientChartNote.belongsTo(models.Patient, {
      foreignKey: "patient_id",
      as: "patient",
    });
    PatientChartNote.belongsTo(models.Organization, {
      foreignKey: "organization_id",
      as: "organization",
    });
    PatientChartNote.belongsTo(models.Facility, {
      foreignKey: "facility_id",
      as: "facility",
    });
    PatientChartNote.belongsTo(models.User, {
      foreignKey: "author_id",
      as: "author",
    });

    // Audit Relations
    PatientChartNote.belongsTo(models.User, {
      foreignKey: "created_by_id",
      as: "created_by",
    });
    PatientChartNote.belongsTo(models.User, {
      foreignKey: "updated_by_id",
      as: "updated_by",
    });
    PatientChartNote.belongsTo(models.User, {
      foreignKey: "deleted_by_id",
      as: "deleted_by",
    });
    PatientChartNote.belongsTo(models.User, {
      foreignKey: "reviewed_by_id",
      as: "reviewed_by",
    });
    PatientChartNote.belongsTo(models.User, {
      foreignKey: "verified_by_id",
      as: "verified_by",
    });
  };

  return PatientChartNote;
};
