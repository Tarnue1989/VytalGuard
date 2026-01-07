// 📁 backend/src/db/migrations/0043_create-triage_records.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { TRIAGE_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('triage_records', {
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
      doctor_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'employees', key: 'id' },
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
      registration_log_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'registration_logs', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      invoice_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'invoices', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      triage_type_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'billable_items', key: 'id' },
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

      // 📝 Clinical Info
      triage_status: {
        type: DataTypes.ENUM(...TRIAGE_STATUS),
        allowNull: false,
        defaultValue: TRIAGE_STATUS[0],
      },
      symptoms: { type: DataTypes.TEXT, allowNull: true },
      triage_notes: { type: DataTypes.TEXT, allowNull: true },

      // 🩺 Vitals
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
      recorded_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },

      // 🔹 Audit
      created_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      updated_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      deleted_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 🕒 Timestamps
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // 🔎 Indexes
    await queryInterface.addIndex('triage_records', ['patient_id']);
    await queryInterface.addIndex('triage_records', ['recorded_at']);
    await queryInterface.addIndex('triage_records', ['triage_status']);
    await queryInterface.addIndex('triage_records', ['organization_id']);
    await queryInterface.addIndex('triage_records', ['facility_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('triage_records');
    // Optional ENUM cleanup for Postgres
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_triage_records_triage_status";');
  },
};
