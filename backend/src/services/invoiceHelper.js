import { Op } from "sequelize";
import { Invoice } from "../models/index.js";
import { INVOICE_STATUS } from "../constants/enums.js";

const ACTIVE_STATUSES = [
  INVOICE_STATUS[0], // draft
  INVOICE_STATUS[1], // issued
  INVOICE_STATUS[2], // unpaid
  INVOICE_STATUS[3], // partial
];

export async function getOrCreateActiveInvoice({
  patient_id,
  organization_id,
  facility_id,
  user,
  transaction = null,
}) {
  // 1️⃣ Try to find existing active invoice
  let invoice = await Invoice.findOne({
    where: {
      patient_id,
      organization_id,
      facility_id,
      status: { [Op.in]: ACTIVE_STATUSES },
      is_locked: false,
    },
    order: [["created_at", "DESC"]],
    transaction,
  });

  // 2️⃣ If none exists → create one
  if (!invoice) {
    invoice = await Invoice.create(
      {
        patient_id,
        organization_id,
        facility_id,
        status: INVOICE_STATUS[0], // draft
      },
      { user, transaction }
    );
  }

  return invoice;
}
