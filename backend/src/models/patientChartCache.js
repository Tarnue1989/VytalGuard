// 📘 backend/src/models/PatientChartCache.js
import { DataTypes } from "sequelize";
import { PATIENT_CHART_CACHE_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  const PatientChartCache = sequelize.define(
    "PatientChartCache",
    {
      /* ============================================================
         🧠 Core Fields
      ============================================================ */
      patient_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        unique: true, // ✅ ensures Sequelize recognizes it as the PK
        allowNull: false,
        comment: "Patient whose chart is cached",
      },
      organization_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "Organization that owns this cache entry",
      },
      facility_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "Facility scope for this cache entry",
      },

    /* ============================================================
      📦 Cache Lifecycle
    ============================================================ */
    status: {
      type: DataTypes.ENUM(...Object.values(PATIENT_CHART_CACHE_STATUS)),
      allowNull: false,
      defaultValue: PATIENT_CHART_CACHE_STATUS.ACTIVE,
      comment: "Cache lifecycle state (active, stale, invalid)",
    },
      chart_snapshot: {
        type: DataTypes.JSONB,
        allowNull: false,
        comment: "Serialized patient chart snapshot (cached JSON structure)",
      },
      generated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: "When this snapshot was generated",
      },

      /* ============================================================
         🧾 Detailed Audit Trail (auto timestamps enabled)
      ============================================================ */
      created_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "User who created this cache record",
      },
      updated_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "User who last modified this cache record",
      },
      deleted_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "User who deleted or invalidated this record",
      },
      revalidated_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "User who revalidated the cache entry after stale state",
      },
      revalidated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "Timestamp when cache was revalidated",
      },
    },
    {
      tableName: "patient_chart_cache",
      underscored: true,
      paranoid: true,
      timestamps: true, // ✅ needed for Sequelize's soft-delete
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at", // ✅ maps to your manual field
      comment: "Cached patient chart snapshots for quick rendering",
      indexes: [
        { fields: ["organization_id"], name: "idx_patient_chart_cache_org" },
        { fields: ["facility_id"], name: "idx_patient_chart_cache_fac" },
        { fields: ["status"], name: "idx_patient_chart_cache_status" },
      ],
    }
  );

  /* ============================================================
     🔗 Associations
  ============================================================ */
  PatientChartCache.associate = (models) => {
    // 🔹 Core scope
    PatientChartCache.belongsTo(models.Patient, {
      foreignKey: "patient_id",
      as: "patient",
    });
    PatientChartCache.belongsTo(models.Organization, {
      foreignKey: "organization_id",
      as: "organization",
    });
    PatientChartCache.belongsTo(models.Facility, {
      foreignKey: "facility_id",
      as: "facility",
    });

    // 🔹 Audit user relations
    PatientChartCache.belongsTo(models.User, {
      foreignKey: "created_by_id",
      as: "created_by",
    });
    PatientChartCache.belongsTo(models.User, {
      foreignKey: "updated_by_id",
      as: "updated_by",
    });
    PatientChartCache.belongsTo(models.User, {
      foreignKey: "deleted_by_id",
      as: "deleted_by",
    });
    PatientChartCache.belongsTo(models.User, {
      foreignKey: "revalidated_by_id",
      as: "revalidated_by",
    });
  };

  return PatientChartCache;
};
