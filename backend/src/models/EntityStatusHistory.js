// 📁 models/EntityStatusHistory.js

import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class EntityStatusHistory extends Model {
    static associate(models) {
      /* ================= RELATIONSHIPS ================= */

      // 👤 Actor (who performed the action)
      EntityStatusHistory.belongsTo(models.User, {
        foreignKey: "changed_by_id",
        as: "changedBy",
      });
    }
  }

  EntityStatusHistory.init(
    {
      /* ============================================================
         🆔 IDENTIFIER
      ============================================================ */
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      /* ============================================================
         🧩 GENERIC ENTITY (ALL MODULES)
      ============================================================ */
      entity_type: {
        type: DataTypes.STRING(60),
        allowNull: false,
        comment: "insurance_claim, lab_result, payment, deposit, etc.",
      },

      entity_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: "ID of the record",
      },

      /* ============================================================
         🏢 MULTI-TENANT SCOPE (CRITICAL)
      ============================================================ */
      organization_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      facility_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      /* ============================================================
         📊 STATUS TRACKING
      ============================================================ */
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: "Current status after action",
      },

      previous_status: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: "Status before change",
      },

      /* ============================================================
         ⚙️ ACTION TYPE
      ============================================================ */
      action: {
        type: DataTypes.STRING(60),
        allowNull: false,
        comment: "submit, review, approve, reject, etc.",
      },

      /* ============================================================
         👤 ACTOR
      ============================================================ */
      changed_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      /* ============================================================
         📝 OPTIONAL DETAILS
      ============================================================ */
      note: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: "Extra structured info (amounts, refs, etc.)",
      },
    },
    {
      sequelize,
      modelName: "EntityStatusHistory",
      tableName: "entity_status_history",

      underscored: true,
      timestamps: true,

      createdAt: "changed_at",
      updatedAt: false,

      /* ============================================================
         ⚡ INDEXES (PERFORMANCE)
      ============================================================ */
      indexes: [
        { fields: ["entity_type"] },
        { fields: ["entity_id"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["changed_by_id"] },
        { fields: ["changed_at"] },
      ],

      /* ============================================================
         🔐 DEFAULT SCOPE (TENANT SAFETY)
      ============================================================ */
      defaultScope: {
        attributes: { exclude: [] },
      },
    }
  );

  return EntityStatusHistory;
};