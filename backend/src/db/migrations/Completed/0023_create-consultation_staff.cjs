// 📁 backend/src/db/migrations/0018_create-consultation_staff.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { CONSULTATION_STAFF_ROLES } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('consultation_staff', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 Foreign Keys
      consultation_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'consultations', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      employee_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'employees', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // 🏷️ Staff role within the consultation
      role: {
        type: DataTypes.ENUM(...CONSULTATION_STAFF_ROLES),
        allowNull: false,
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
    await queryInterface.addIndex('consultation_staff', ['consultation_id']);
    await queryInterface.addIndex('consultation_staff', ['employee_id']);
    await queryInterface.addIndex('consultation_staff', ['role']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('consultation_staff');
  },
};
