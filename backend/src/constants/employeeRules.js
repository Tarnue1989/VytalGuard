// 📁 backend/src/constants/employeeRules.js

// Roles/positions that MUST have a facility_id
export const FACILITY_REQUIRED_POSITIONS = [
  "doctor",
  "nurse",
  "pharmacist",
  "lab_technician",
];

// Roles/positions that CAN skip facility
export const FACILITY_OPTIONAL_POSITIONS = [
  "admin",
  "hr",
  "it",
  "org_owner",

];
