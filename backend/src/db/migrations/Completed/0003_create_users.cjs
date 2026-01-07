'use strict';

const { USER_STATUS } = require('../../constants/enums.js');

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {typeof import('sequelize')} Sequelize
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      username: {
        type: Sequelize.STRING(80),
        allowNull: false,
        unique: true,
      },
      email: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      // Profile fields
      first_name: { type: Sequelize.STRING(150), allowNull: true },
      last_name: { type: Sequelize.STRING(150), allowNull: true },

      // Security additions
      password_reset_token: { type: Sequelize.STRING, allowNull: true },
      password_reset_expiry: { type: Sequelize.DATE, allowNull: true },
      login_attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      locked_until: { type: Sequelize.DATE, allowNull: true },
      must_reset_password: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // 🔹 Token versioning for refresh/logoutAll
      token_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      // Status & login
      status: {
        type: Sequelize.ENUM(...USER_STATUS),
        allowNull: false,
        defaultValue: USER_STATUS[0], // usually 'active'
      },
      last_login_at: { type: Sequelize.DATE, allowNull: true },

      // 🔹 System flag
      is_system: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // 🔹 Organization (NEW)
      organization_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'organizations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      // Audit fields
      created_by_id: { type: Sequelize.UUID, allowNull: true },
      updated_by_id: { type: Sequelize.UUID, allowNull: true },
      deleted_by_id: { type: Sequelize.UUID, allowNull: true },

      // Timestamps
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
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    // 🔹 Indexes
    await queryInterface.addIndex('users', ['status']);
    await queryInterface.addIndex('users', ['email']);
    await queryInterface.addIndex('users', ['username']);
    await queryInterface.addIndex('users', ['login_attempts']);
    await queryInterface.addIndex('users', ['locked_until']);
    await queryInterface.addIndex('users', ['is_system']);
    await queryInterface.addIndex('users', ['organization_id']); 
    await queryInterface.addIndex('users', ['token_version']); // ✅ new index

    // 🔹 Conditional index for active users
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ix_users_status_active 
      ON users (status) 
      WHERE deleted_at IS NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('users');

    // Cleanup ENUM type for Postgres
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_users_status";'
      );
    }
  },
};
