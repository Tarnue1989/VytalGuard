import { Op } from "sequelize";
import { Invoice } from "../models/index.js";
import { INVOICE_STATUS } from "../constants/enums.js";

/* ============================================================
   🔹 Active Invoice Statuses (FIXED)
============================================================ */
const ACTIVE_STATUSES = [
  INVOICE_STATUS.DRAFT,
  INVOICE_STATUS.ISSUED,
  INVOICE_STATUS.UNPAID,
  INVOICE_STATUS.PARTIAL,
];

/* ============================================================
   🔹 Get or Create Active Invoice
============================================================ */
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
        status: INVOICE_STATUS.DRAFT,
      },
      { user, transaction }
    );
  }

  return invoice;
}