'use strict';

const { DataTypes } = require('sequelize');
const { VITAL_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('vitals', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 References
      patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'patients', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      admission_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'admissions', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      consultation_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'consultations', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      triage_record_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'triage_records', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      nurse_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'employees', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // ✅ NEW — Registration Log linkage
      registration_log_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'registration_logs', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 🔗 Tenant scope
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      facility_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'facilities', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // 🏷️ Status
      status: {
        type: DataTypes.ENUM(...VITAL_STATUS),
        allowNull: false,
        defaultValue: VITAL_STATUS[0],
      },

      // 🩺 Vital signs
      bp: { type: DataTypes.STRING(20), allowNull: true },
      pulse: { type: DataTypes.INTEGER, allowNull: true },
      rr: { type: DataTypes.INTEGER, allowNull: true },
      temp: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      oxygen: { type: DataTypes.INTEGER, allowNull: true },
      weight: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      height: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      rbg: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      pain_score: { type: DataTypes.INTEGER, allowNull: true },
      position: { type: DataTypes.STRING(50), allowNull: true },

      // ⏱️ Time
      recorded_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },

      // 🕒 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },

      // Timestamps
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // Indexes
    await queryInterface.addIndex('vitals', ['patient_id']);
    await queryInterface.addIndex('vitals', ['recorded_at']);
    await queryInterface.addIndex('vitals', ['admission_id']);
    await queryInterface.addIndex('vitals', ['consultation_id']);
    await queryInterface.addIndex('vitals', ['registration_log_id']); // ✅ new index
    await queryInterface.addIndex('vitals', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('vitals');
  },
};
