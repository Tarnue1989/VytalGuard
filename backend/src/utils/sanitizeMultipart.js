// utils/sanitizeMultipart.js
export function sanitizeMultipart(body) {
  const numberFields = [
    "number_of_fetus",
    "biparietal_diameter",
    "amniotic_volume",
    "fetal_heart_rate",
  ];

  const booleanFields = [
    "previous_cesarean",
    "is_emergency",
  ];

  const enumNullables = [
    "gender",
  ];

  const uuidFields = [
    "organization_id",
    "facility_id",
    "department_id",
    "patient_id",
    "technician_id",
    "consultation_id",
    "maternity_visit_id",
    "registration_log_id",
    "billable_item_id",
    "invoice_id",
  ];

  // 🔢 Numbers
  for (const f of numberFields) {
    if (body[f] === "") delete body[f];
    else if (body[f] !== undefined) body[f] = Number(body[f]);
  }

  // 🔘 Booleans
  for (const f of booleanFields) {
    if (body[f] === "true") body[f] = true;
    if (body[f] === "false") body[f] = false;
  }

  // 🎭 Enums
  for (const f of enumNullables) {
    if (body[f] === "") body[f] = null;
  }

  // 🧬 UUIDs
  for (const f of uuidFields) {
    if (body[f] === "") delete body[f];
  }

  return body;
}
