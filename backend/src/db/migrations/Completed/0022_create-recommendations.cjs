// 📁 backend/src/db/migrations/0016_create-recommendations.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { RECOMMENDATION_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('recommendations', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
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

      // 🔗 Clinical links
      patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'patients', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      doctor_id: {
        type: DataTypes.UUID,
        allowNull: false,
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
      consultation_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'consultations', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 📝 Clinical details
      recommendation_date: { type: DataTypes.DATEONLY, allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: true },

      // 🏷️ Status
      status: {
        type: DataTypes.ENUM(...RECOMMENDATION_STATUS),
        allowNull: false,
        defaultValue: RECOMMENDATION_STATUS[0], // "pending"
      },

      // 🕒 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },

      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // Indexes
    await queryInterface.addIndex('recommendations', ['organization_id']);
    await queryInterface.addIndex('recommendations', ['facility_id']);
    await queryInterface.addIndex('recommendations', ['patient_id']);
    await queryInterface.addIndex('recommendations', ['doctor_id']);
    await queryInterface.addIndex('recommendations', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('recommendations');
  },
};
