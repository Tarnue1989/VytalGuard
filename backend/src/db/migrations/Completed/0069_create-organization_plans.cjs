// 📁 backend/src/db/migrations/0032_create-organization_plans.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { ORG_PLAN_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('organization_plans', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 Links
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      plan_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'plans', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // 📅 Duration
      start_date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      end_date: { type: DataTypes.DATE, allowNull: true },

      // 🏷️ Status
      status: {
        type: DataTypes.ENUM(...ORG_PLAN_STATUS),
        allowNull: false,
        defaultValue: ORG_PLAN_STATUS[0],
      },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      updated_by_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },

      // 🕒 Timestamps
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // ✅ Scoped uniqueness: one plan per org at a time
    await queryInterface.addConstraint('organization_plans', {
      fields: ['organization_id', 'plan_id', 'start_date'],
      type: 'unique',
      name: 'unique_org_plan_per_start',
    });

    // Indexes
    await queryInterface.addIndex('organization_plans', ['organization_id']);
    await queryInterface.addIndex('organization_plans', ['plan_id']);
    await queryInterface.addIndex('organization_plans', ['status']);
    await queryInterface.addIndex('organization_plans', ['start_date']);
    await queryInterface.addIndex('organization_plans', ['end_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('organization_plans');
  },
};
