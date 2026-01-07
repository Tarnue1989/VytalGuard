// 📘 backend/src/services/patientService.js – Core Patient Data Access
import db from "../models/index.js";
import { logger } from "../utils/logger.js";

export const patientService = {
  /**
   * 🧠 Basic profile info (used in patient chart / cache)
   * ----------------------------------------------------
   * Fully aligned with Patient model fields.
   */
  async getBasic(patientId, user) {
    try {
      const patient = await db.Patient.findByPk(patientId, {
        attributes: [
          "id",
          "pat_no",
          "first_name",
          "middle_name",
          "last_name",
          "gender",
          "date_of_birth",
          "phone_number",
          "email_address",
          "home_address",
          "registration_status", // ✅ actual column for patient status
          "created_at",
        ],
      });

      if (!patient) return null;

      // 🧩 Convert and alias for downstream consumers
      const data = patient.get({ plain: true });

      data.full_name = [data.first_name, data.middle_name, data.last_name]
        .filter(Boolean)
        .join(" ");

      // 🧠 UI / API-friendly aliases
      data.dob = data.date_of_birth;
      data.phone = data.phone_number;
      data.email = data.email_address;
      data.address = data.home_address;
      data.status = data.registration_status;

      // 🧹 Clean up raw DB fields
      delete data.date_of_birth;
      delete data.phone_number;
      delete data.email_address;
      delete data.home_address;
      delete data.registration_status;

      return data;
    } catch (error) {
      logger.error("[patientService.getBasic]", error);
      throw error;
    }
  },

  /**
   * 📋 List lite (used in patient dropdowns / autocomplete)
   * ------------------------------------------------------
   * Returns minimal patient identity data for suggestion inputs.
   */
  async listLite() {
    try {
      const patients = await db.Patient.findAll({
        attributes: ["id", "pat_no", "first_name", "middle_name", "last_name"],
        order: [["first_name", "ASC"]],
      });

      return patients.map((p) => {
        const plain = p.get({ plain: true });
        const full_name = [plain.first_name, plain.middle_name, plain.last_name]
          .filter(Boolean)
          .join(" ");
        return {
          id: plain.id,
          pat_no: plain.pat_no,
          full_name,
          label: `${plain.pat_no} - ${full_name}`,
        };
      });
    } catch (error) {
      logger.error("[patientService.listLite]", error);
      throw error;
    }
  },
};
