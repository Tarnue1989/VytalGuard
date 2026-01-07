// 📁 backend/src/db/migrations/0049_create-currency_rates.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { CURRENCY_RATE_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('currency_rates', {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal('gen_random_uuid()'),
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      from_currency: { type: DataTypes.STRING(10), allowNull: false },
      to_currency: { type: DataTypes.STRING(10), allowNull: false },
      rate: { type: DataTypes.DECIMAL(12, 6), allowNull: false },
      effective_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal('CURRENT_DATE'),
      },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...CURRENCY_RATE_STATUS),
        allowNull: false,
        defaultValue: CURRENCY_RATE_STATUS[0], // "active"
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

    // Indexes with explicit names
    await queryInterface.addIndex('currency_rates', ['organization_id'], {
      name: 'idx_currency_rates_org_id',
    });
    await queryInterface.addIndex('currency_rates', ['facility_id'], {
      name: 'idx_currency_rates_facility_id',
    });
    await queryInterface.addIndex('currency_rates', ['from_currency', 'to_currency'], {
      name: 'idx_currency_rates_currency_pair',
    });
    await queryInterface.addIndex('currency_rates', ['effective_date'], {
      name: 'idx_currency_rates_effective_date',
    });
    await queryInterface.addIndex('currency_rates', ['status'], {
      name: 'idx_currency_rates_status',
    });

    // Unique constraint: one rate per day per currency pair in a facility
    await queryInterface.addConstraint('currency_rates', {
      fields: ['organization_id', 'facility_id', 'from_currency', 'to_currency', 'effective_date'],
      type: 'unique',
      name: 'unique_rate_per_day',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('currency_rates');
  },
};
