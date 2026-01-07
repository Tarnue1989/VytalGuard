// 📁 backend/src/db/migrations/0072_create-wards.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { WARD_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('wards', {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal('gen_random_uuid()'),
        allowNull: false,
        primaryKey: true,
      },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID },

      name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.TEXT },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...WARD_STATUS),
        allowNull: false,
        defaultValue: WARD_STATUS[0], // "active"
      },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },

      // Sequelize timestamps
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: { type: DataTypes.DATE },
    });

    // Indexes (explicit names prevent clashes)
    await queryInterface.addIndex('wards', ['organization_id'], {
      name: 'idx_wards_org_id',
    });
    await queryInterface.addIndex('wards', ['facility_id'], {
      name: 'idx_wards_facility_id',
    });
    await queryInterface.addIndex('wards', ['department_id'], {
      name: 'idx_wards_department_id',
    });
    await queryInterface.addIndex('wards', ['status'], {
      name: 'idx_wards_status',
    });

    // Unique constraint
    await queryInterface.addConstraint('wards', {
      fields: ['organization_id', 'facility_id', 'name'],
      type: 'unique',
      name: 'unique_ward_per_facility',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wards');
  },
};
