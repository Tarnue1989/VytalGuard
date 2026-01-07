// 📁 backend/src/db/migrations/0046_create-admissions.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { ADMISSION_STATUS, ADMISSION_TYPE } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('admissions', {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal('gen_random_uuid()'),
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Core links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      admitting_doctor_id: { type: DataTypes.UUID, allowNull: false },
      discharging_doctor_id: { type: DataTypes.UUID },
      department_id: { type: DataTypes.UUID },
      consultation_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID, allowNull: false },
      invoice_id: { type: DataTypes.UUID },
      insurance_id: { type: DataTypes.UUID },

      // 📅 Dates
      admit_date: { type: DataTypes.DATEONLY, allowNull: false },
      discharge_date: { type: DataTypes.DATEONLY },

      // 🏷️ Lifecycle
      status: {
        type: DataTypes.ENUM(...ADMISSION_STATUS),
        allowNull: false,
        defaultValue: ADMISSION_STATUS[0], // e.g. "admitted"
      },
      admission_type: {
        type: DataTypes.ENUM(...ADMISSION_TYPE),
        allowNull: false,
        defaultValue: ADMISSION_TYPE[1], // e.g. "routine"
      },

      // 🧾 Details
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      admit_reason: { type: DataTypes.TEXT },
      referral_source: { type: DataTypes.STRING },
      notes: { type: DataTypes.TEXT },
      bed_number: { type: DataTypes.STRING },
      discharge_summary: { type: DataTypes.TEXT },
      cost_override: { type: DataTypes.DECIMAL(12, 2) },
      document_url: { type: DataTypes.STRING },

      // 📌 Finalization / Verification / Voiding
      finalized_at: { type: DataTypes.DATE },
      finalized_by_id: { type: DataTypes.UUID },
      verified_by_id: { type: DataTypes.UUID },
      verified_at: { type: DataTypes.DATE },
      voided_by_id: { type: DataTypes.UUID },
      voided_at: { type: DataTypes.DATE },

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

    // Indexes with explicit names (avoid collisions)
    await queryInterface.addIndex('admissions', ['organization_id'], {
      name: 'idx_admissions_org_id',
    });
    await queryInterface.addIndex('admissions', ['facility_id'], {
      name: 'idx_admissions_facility_id',
    });
    await queryInterface.addIndex('admissions', ['patient_id'], {
      name: 'idx_admissions_patient_id',
    });
    await queryInterface.addIndex('admissions', ['admit_date'], {
      name: 'idx_admissions_admit_date',
    });
    await queryInterface.addIndex('admissions', ['status'], {
      name: 'idx_admissions_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admissions');
  },
};
