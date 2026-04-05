'use strict';

const { INSURANCE_PROVIDER_STATUS } = require('../../constants/enums.js');

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {typeof import('sequelize')} Sequelize
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('patient_insurances', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },

      // 🔗 Tenant scope
      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'facilities', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // 🔗 Core Links
      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'patients', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      provider_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'insurance_providers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // 📌 Policy Info
      policy_number: {
        type: Sequelize.STRING(120),
        allowNull: false,
        unique: true,
      },
      plan_name: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      coverage_limit: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      valid_from: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      valid_to: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // 📌 Status
      status: {
        type: Sequelize.ENUM(...Object.values(INSURANCE_PROVIDER_STATUS)),
        allowNull: false,
        defaultValue: INSURANCE_PROVIDER_STATUS.ACTIVE,
      },

      // 🔹 Audit
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      deleted_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // 📌 Indexes
    await queryInterface.addIndex('patient_insurances', ['organization_id']);
    await queryInterface.addIndex('patient_insurances', ['facility_id']);
    await queryInterface.addIndex('patient_insurances', ['patient_id']);
    await queryInterface.addIndex('patient_insurances', ['provider_id']);
    await queryInterface.addIndex('patient_insurances', ['status']);
    await queryInterface.addIndex('patient_insurances', ['policy_number'], {
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('patient_insurances');

    // Cleanup ENUM (Postgres)
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_patient_insurances_status";'
      );
    }
  },
};