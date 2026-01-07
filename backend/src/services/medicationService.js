// 📘 medicationService.js – Unified Medication Management (Enterprise Edition v3.1)
// Combines: Prescription + PrescriptionItem + PharmacyTransaction + BillableItem
// Fully aligned with enterprise master models and naming

import db from "../models/index.js";
import { logger } from "../utils/logger.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

export const medicationService = {
  /**
   * 🔍 Fetch full medication history for a patient
   * Includes prescriptions, items (with billable/medication), and dispense transactions
   */
  async getByPatient(patientId, user = {}) {
    try {
      await authzService.checkPermission(user, "prescriptions:view");
      if (!patientId) return [];

      const prescriptions = await db.Prescription.findAll({
        where: { patient_id: patientId },
        attributes: [
          "id",
          "prescription_date",
          "status",
          "notes",
          "billed",
          "fulfilled_at",
          "created_at",
          "updated_at",
        ],
        include: [
          {
            model: db.Employee,
            as: "doctor",
            attributes: ["id", "first_name", "middle_name", "last_name"],
          },
          { model: db.Organization, as: "organization", attributes: ["id", "name"] },
          { model: db.Facility, as: "facility", attributes: ["id", "name"] },
          {
            model: db.PrescriptionItem,
            as: "items",
            attributes: [
              "id",
              "dosage",
              "route",
              "duration",
              "quantity",
              "dispensed_qty",
              "dispensed_at",
              "status",
              "created_at",
            ],
            include: [
              // ✅ Add medication/billable reference to replace old drug_name
              {
                model: db.BillableItem,
                as: "billableItem",
                attributes: ["id", "name"],
              },
              {
                model: db.MasterItem,
                as: "medication",
                attributes: ["id", "name"],
              },
              {
                model: db.PharmacyTransaction,
                as: "transactions",
                attributes: [
                  "id",
                  "type",
                  "status",
                  "quantity_dispensed",
                  "fulfillment_date",
                  "is_emergency",
                  "notes",
                  "void_reason",
                  "created_at",
                ],
                include: [
                  {
                    model: db.Employee,
                    as: "fulfilledBy",
                    attributes: ["id", "first_name", "middle_name", "last_name"],
                  },
                  {
                    model: db.InvoiceItem,
                    as: "invoiceItem",
                    attributes: ["id", "description", "net_amount"],
                  },
                  { model: db.Organization, as: "organization", attributes: ["id", "name"] },
                  { model: db.Facility, as: "facility", attributes: ["id", "name"] },
                ],
              },
            ],
          },
        ],
        order: [["prescription_date", "DESC"]],
      });

      /* ============================================================
         🔁 Normalize Output for Front-End & Patient Chart Integration
      ============================================================ */
      const records = prescriptions.map((p) => {
        const doctorFullName = p.doctor
          ? [p.doctor.first_name, p.doctor.middle_name, p.doctor.last_name]
              .filter(Boolean)
              .join(" ")
          : null;

        return {
          id: p.id,
          prescribed_at: p.prescription_date,
          status: p.status,
          billed: p.billed,
          notes: p.notes,
          doctor: p.doctor ? { id: p.doctor.id, full_name: doctorFullName } : null,
          organization: p.organization ? { id: p.organization.id, name: p.organization.name } : null,
          facility: p.facility ? { id: p.facility.id, name: p.facility.name } : null,

          items: (p.items || []).map((i) => ({
            id: i.id,
            medication_name:
              i.billableItem?.name || i.medication?.name || "(Unnamed Medication)", // ✅ unified naming
            dosage: i.dosage,
            route: i.route,
            duration: i.duration,
            quantity: i.quantity,
            dispensed_qty: i.dispensed_qty,
            dispensed_at: i.dispensed_at,
            status: i.status,

            transactions: (i.transactions || []).map((t) => {
              const pharmacistFullName = t.fulfilledBy
                ? [t.fulfilledBy.first_name, t.fulfilledBy.middle_name, t.fulfilledBy.last_name]
                    .filter(Boolean)
                    .join(" ")
                : null;

              return {
                id: t.id,
                type: t.type,
                status: t.status,
                quantity_dispensed: t.quantity_dispensed,
                fulfillment_date: t.fulfillment_date,
                pharmacist: t.fulfilledBy
                  ? { id: t.fulfilledBy.id, full_name: pharmacistFullName }
                  : null,
                invoice_item: t.invoiceItem
                  ? {
                      id: t.invoiceItem.id,
                      description: t.invoiceItem.description,
                      net_amount: t.invoiceItem.net_amount,
                    }
                  : null,
                is_emergency: t.is_emergency,
                notes: t.notes,
                void_reason: t.void_reason,
                facility: t.facility ? { id: t.facility.id, name: t.facility.name } : null,
                organization: t.organization
                  ? { id: t.organization.id, name: t.organization.name }
                  : null,
                created_at: t.created_at,
              };
            }),
          })),
          created_at: p.created_at,
        };
      });

      await auditService.logAction({
        module: "medications",
        action: "view",
        entityId: patientId,
        user,
        details: { count: records.length },
      });

      return records;
    } catch (err) {
      logger.error("[medicationService.getByPatient]", err);
      return [];
    }
  },

  /**
   * 🩺 Fetch prescriptions by consultation (for visit view)
   */
  async getByConsultation(consultationId, user = {}) {
    try {
      const records = await db.Prescription.findAll({
        where: { consultation_id: consultationId },
        include: [
          {
            model: db.PrescriptionItem,
            as: "items",
            include: [
              { model: db.PharmacyTransaction, as: "transactions" },
              { model: db.BillableItem, as: "billableItem", attributes: ["id", "name"] },
              { model: db.MasterItem, as: "medication", attributes: ["id", "name"] },
            ],
          },
        ],
        order: [["created_at", "ASC"]],
      });
      return records;
    } catch (err) {
      logger.error("[medicationService.getByConsultation]", err);
      return [];
    }
  },

  /**
   * 💊 Create a new prescription with its items
   */
  async createPrescription(data, user) {
    const transaction = await db.sequelize.transaction();
    try {
      await authzService.checkPermission(user, "prescriptions:create");

      const prescription = await db.Prescription.create(
        {
          patient_id: data.patient_id,
          doctor_id: data.doctor_id,
          facility_id: data.facility_id,
          organization_id: data.organization_id,
          notes: data.notes || "",
          status: "pending",
          created_by_id: user.id,
        },
        { transaction }
      );

      if (Array.isArray(data.items)) {
        for (const item of data.items) {
          await db.PrescriptionItem.create(
            {
              prescription_id: prescription.id,
              billable_item_id: item.billable_item_id || null, // ✅ link to BillableItem
              medication_id: item.medication_id || null,
              dosage: item.dosage,
              route: item.route,
              duration: item.duration,
              quantity: item.quantity,
              created_by_id: user.id,
              organization_id: data.organization_id,
              facility_id: data.facility_id,
              patient_id: data.patient_id,
            },
            { transaction }
          );
        }
      }

      await transaction.commit();

      await auditService.logAction({
        module: "medications",
        action: "create",
        entityId: prescription.id,
        user,
        details: { count: data.items?.length || 0 },
      });

      return prescription;
    } catch (err) {
      await transaction.rollback();
      logger.error("[medicationService.createPrescription]", err);
      throw err;
    }
  },

  /**
   * 🏪 Mark a prescription item as dispensed (pharmacy workflow)
   */
  async markDispensed({ prescription_item_id, quantity_dispensed, notes }, user) {
    const transaction = await db.sequelize.transaction();
    try {
      await authzService.checkPermission(user, "pharmacy_transactions:create");

      const item = await db.PrescriptionItem.findByPk(prescription_item_id);
      if (!item) throw new Error("Prescription item not found");

      const txn = await db.PharmacyTransaction.create(
        {
          patient_id: item.patient_id,
          prescription_item_id,
          quantity_dispensed,
          type: "dispense",
          status: "completed",
          fulfillment_date: new Date(),
          fulfilled_by_id: user.employee_id || null,
          facility_id: item.facility_id,
          organization_id: item.organization_id,
          notes,
        },
        { transaction }
      );

      await item.update(
        {
          dispensed_qty: quantity_dispensed,
          dispensed_at: new Date(),
          status: "fulfilled",
        },
        { transaction }
      );

      await transaction.commit();

      await auditService.logAction({
        module: "medications",
        action: "dispense",
        entityId: txn.id,
        user,
        details: { prescription_item_id },
      });

      return txn;
    } catch (err) {
      await transaction.rollback();
      logger.error("[medicationService.markDispensed]", err);
      throw err;
    }
  },
};
