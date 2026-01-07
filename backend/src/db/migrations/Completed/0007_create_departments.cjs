'use strict';

const { DataTypes } = require('sequelize');
const { DEPARTMENT_STATUS } = require('../../constants/enums.js'); // adjust path if needed

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('departments', {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: queryInterface.sequelize.literal('gen_random_uuid()'),
      },
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      facility_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'facilities', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      head_of_department_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'employees', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(...DEPARTMENT_STATUS),
        allowNull: false,
        defaultValue: DEPARTMENT_STATUS[0],
      },
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal('NOW()'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal('NOW()'),
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });

    // ✅ Indexes
    await queryInterface.addIndex('departments', ['organization_id']);
    await queryInterface.addIndex('departments', ['facility_id']);
    await queryInterface.addIndex('departments', ['status']);

    // ✅ Composite uniqueness: org + facility + name
    await queryInterface.addConstraint('departments', {
      fields: ['organization_id', 'facility_id', 'name'],
      type: 'unique',
      name: 'uniq_department_org_facility_name',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('departments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_departments_status";');
  },
};
