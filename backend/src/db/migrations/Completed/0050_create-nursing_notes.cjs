// 📁 migrations/0062_create-nursing_notes.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { NURSING_NOTE_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("nursing_notes", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      admission_id: { type: DataTypes.UUID },
      nurse_id: { type: DataTypes.UUID, allowNull: false },
      consultation_id: { type: DataTypes.UUID },
      department_id: { type: DataTypes.UUID },

      // Note details
      note_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal("CURRENT_TIMESTAMP"),
      },
      shift: { type: DataTypes.STRING }, // morning, evening, night
      subjective: { type: DataTypes.TEXT }, // patient complaint
      objective: { type: DataTypes.TEXT }, // observations
      assessment: { type: DataTypes.TEXT }, // nurse’s assessment
      plan: { type: DataTypes.TEXT }, // care plan / interventions
      handover_notes: { type: DataTypes.TEXT },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...NURSING_NOTE_STATUS),
        allowNull: false,
        defaultValue: NURSING_NOTE_STATUS[0], // "draft"
      },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },

      // Sequelize timestamps
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal("CURRENT_TIMESTAMP"),
      },
      deleted_at: { type: DataTypes.DATE },
    });

    // Indexes
    await queryInterface.addIndex("nursing_notes", ["organization_id"]);
    await queryInterface.addIndex("nursing_notes", ["facility_id"]);
    await queryInterface.addIndex("nursing_notes", ["patient_id"]);
    await queryInterface.addIndex("nursing_notes", ["admission_id"]);
    await queryInterface.addIndex("nursing_notes", ["nurse_id"]);
    await queryInterface.addIndex("nursing_notes", ["note_date"]);
    await queryInterface.addIndex("nursing_notes", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("nursing_notes");
  },
};
