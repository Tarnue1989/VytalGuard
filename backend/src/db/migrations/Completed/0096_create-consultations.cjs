// 📁 backend/src/db/migrations/0017_create-consultations.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { CONSULTATION_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('consultations', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 References
      appointment_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'appointments', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      registration_log_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'registration_logs', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      recommendation_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'recommendations', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      parent_consultation_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'consultations', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      triage_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'triage_records', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
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
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      department_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'departments', key: 'id' },
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
      consultation_type_id: {
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
      consultation_date: { type: DataTypes.DATEONLY, allowNull: true },
      diagnosis: { type: DataTypes.STRING(255), allowNull: true },
      consultation_notes: { type: DataTypes.TEXT, allowNull: true },
      prescribed_medications: { type: DataTypes.TEXT, allowNull: true },

      // 🏷️ Status
      status: {
        type: DataTypes.ENUM(...CONSULTATION_STATUS),
        allowNull: false,
        defaultValue: CONSULTATION_STATUS[0],
      },

      // 📝 Cancellation / Void reasons
      cancel_reason: { type: DataTypes.STRING(255), allowNull: true },
      void_reason: { type: DataTypes.STRING(255), allowNull: true },

      // 🔹 Lifecycle Audit
      finalized_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      verified_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

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
    await queryInterface.addIndex('consultations', ['patient_id']);
    await queryInterface.addIndex('consultations', ['doctor_id']);
    await queryInterface.addIndex('consultations', ['status']);
    await queryInterface.addIndex('consultations', ['triage_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('consultations');
  },
};
