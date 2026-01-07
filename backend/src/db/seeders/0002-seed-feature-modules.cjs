'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const { FEATURE_MODULE_STATUS, FEATURE_ACCESS_STATUS } =
      await import('../../constants/enums.js');

    const { Op } = Sequelize;

    const moduleKeys = [
      "appointments","consultations","admissions","maternity_visits","delivery_records","surgery_records",
      "lab_requests","ultrasound","ekg_records","medical_records",
      "prescriptions","pharmacy_transactions",
      "inventory_stock","stock_requests","central_stock",
      "registration_logs","users","roles","feature_access"
    ];

    const modulesToDelete = await queryInterface.sequelize.query(
      'SELECT id FROM feature_modules WHERE key IN (:keys)',
      {
        replacements: { keys: moduleKeys },
        type: queryInterface.sequelize.QueryTypes.SELECT
      }
    );
    const moduleIds = modulesToDelete.map(r => r.id);

    if (moduleIds.length) {
      await queryInterface.bulkDelete(
        "feature_accesses",
        { module_id: { [Op.in]: moduleIds } },
        {}
      );
    }

    await queryInterface.bulkDelete(
      "feature_modules",
      { key: { [Op.in]: moduleKeys } },
      {}
    );

    const modules = [
      { name: "Appointments", key: "appointments", icon: "ri-calendar-check-line", category: "Clinical", description: "Manage patient appointments" },
      { name: "Consultations", key: "consultations", icon: "ri-stethoscope-line", category: "Clinical", description: "Manage patient consultations" },
      { name: "Admissions", key: "admissions", icon: "ri-hotel-bed-line", category: "Clinical", description: "Manage inpatient admissions" },
      { name: "Maternity Visits", key: "maternity_visits", icon: "ri-women-line", category: "Clinical", description: "Track maternity visits" },
      { name: "Delivery Records", key: "delivery_records", icon: "ri-baby-line", category: "Clinical", description: "Track delivery cases" },
      { name: "Surgery Records", key: "surgery_records", icon: "ri-knife-line", category: "Clinical", description: "Track surgery cases" },

      { name: "Lab Requests", key: "lab_requests", icon: "ri-flask-line", category: "Diagnostics", description: "Manage laboratory requests & results" },
      { name: "Ultrasound", key: "ultrasound", icon: "ri-heart-pulse-line", category: "Diagnostics", description: "Manage ultrasound records" },
      { name: "EKG Records", key: "ekg_records", icon: "ri-pulse-line", category: "Diagnostics", description: "Manage EKG records" },
      { name: "Medical Records", key: "medical_records", icon: "ri-file-list-3-line", category: "Diagnostics", description: "Patient medical history & records" },

      { name: "Prescriptions", key: "prescriptions", icon: "ri-capsule-line", category: "Pharmacy", description: "Manage prescriptions" },
      { name: "Pharmacy Transactions", key: "pharmacy_transactions", icon: "ri-cash-line", category: "Pharmacy", description: "Manage pharmacy sales & dispensing" },

      { name: "Inventory Stock", key: "inventory_stock", icon: "ri-archive-stack-line", category: "Inventory", description: "Manage facility inventory stock" },
      { name: "Stock Requests", key: "stock_requests", icon: "ri-shopping-cart-line", category: "Inventory", description: "Manage stock requests" },
      { name: "Central Stock", key: "central_stock", icon: "ri-store-2-line", category: "Inventory", description: "Manage central inventory" },

      { name: "Registration Logs", key: "registration_logs", icon: "ri-user-add-line", category: "Administration", description: "Manage patient registrations" },
      { name: "Users", key: "users", icon: "ri-user-line", category: "Administration", description: "Manage system users" },
      { name: "Roles", key: "roles", icon: "ri-team-line", category: "Administration", description: "Manage roles & permissions" },
      { name: "Feature Access", key: "feature_access", icon: "ri-lock-line", category: "Administration", description: "Manage role-based module access" },
    ];

    const now = new Date();
    const moduleRecords = modules.map(m => ({
      id: uuidv4(),
      name: m.name,
      key: m.key,
      icon: m.icon,
      category: m.category,
      description: m.description,
      tags: Sequelize.literal('ARRAY[]::VARCHAR[]'),
      visibility: "public",
      enabled: true,
      status: FEATURE_MODULE_STATUS[0],
      created_by: null,
      created_at: now,
      updated_at: now
    }));

    await queryInterface.bulkInsert("feature_modules", moduleRecords);

    // ✅ Using actual IDs from your roles table
    const adminRoleId   = '6815bd62-0b6b-4cb6-95e9-98dfcf12e6a1';
    const nurseRoleId   = '968bc25d-70d2-4880-a8e6-978a1e5ca79b';
    const doctorRoleId  = 'd5afacd6-90f1-42c5-a63f-665adc04b80b';
    const labTechRoleId = nurseRoleId; // if Lab Tech not a separate role, assign Nurse for now
    const facilityId    = null;

    const moduleIdMap = {};
    moduleRecords.forEach(m => { moduleIdMap[m.key] = m.id; });

    const accessRecords = [
      ...moduleRecords.map(m => ({
        id: uuidv4(),
        module_id: m.id,
        role_id: adminRoleId,
        facility_id: facilityId,
        status: FEATURE_ACCESS_STATUS[0],
        created_by: null,
        created_at: now,
        updated_at: now
      })),

      ...["appointments","consultations","admissions","maternity_visits","delivery_records","surgery_records","lab_requests","ultrasound","ekg_records","medical_records","prescriptions"]
      .map(k => ({
        id: uuidv4(),
        module_id: moduleIdMap[k],
        role_id: doctorRoleId,
        facility_id: facilityId,
        status: FEATURE_ACCESS_STATUS[0],
        created_by: null,
        created_at: now,
        updated_at: now
      })),

      ...["appointments","admissions","maternity_visits","delivery_records","medical_records"]
      .map(k => ({
        id: uuidv4(),
        module_id: moduleIdMap[k],
        role_id: nurseRoleId,
        facility_id: facilityId,
        status: FEATURE_ACCESS_STATUS[0],
        created_by: null,
        created_at: now,
        updated_at: now
      })),

      ...["lab_requests","ultrasound","ekg_records","medical_records"]
      .map(k => ({
        id: uuidv4(),
        module_id: moduleIdMap[k],
        role_id: labTechRoleId,
        facility_id: facilityId,
        status: FEATURE_ACCESS_STATUS[0],
        created_by: null,
        created_at: now,
        updated_at: now
      }))
    ];

    await queryInterface.bulkInsert("feature_accesses", accessRecords);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("feature_accesses", null, {});
    await queryInterface.bulkDelete("feature_modules", null, {});
  }
};
