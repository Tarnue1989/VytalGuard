// 📘 patientChartNoteService.js – CRUD for Patient Chart Notes (Enterprise Standard)

import db from "../../models/index.js";
import { auditService } from "../auditService.js";
import { logger } from "../../utils/logger.js";

export const patientChartNoteService = {
  /**
   * 📋 List all notes for a given patient (with author/reviewer/verified names)
   */
  async listByPatient(patient_id, user) {
    try {
      const notes = await db.PatientChartNote.findAll({
        where: { patient_id, deleted_at: null },
        order: [["created_at", "DESC"]],
        include: [
          {
            model: db.User,
            as: "author",
            attributes: ["id", "first_name", "last_name", "email"],
          },
          {
            model: db.User,
            as: "reviewed_by",
            attributes: ["id", "first_name", "last_name"],
          },
          {
            model: db.User,
            as: "verified_by",
            attributes: ["id", "first_name", "last_name"],
          },
        ],
      });

      // ✅ Compute full_name dynamically for all relations
      return notes.map((note) => {
        const data = note.toJSON();
        const buildName = (obj) =>
          obj
            ? `${obj.first_name || ""} ${obj.last_name || ""}`.trim()
            : null;
        return {
          ...data,
          author: data.author
            ? { ...data.author, full_name: buildName(data.author) }
            : null,
          reviewed_by: data.reviewed_by
            ? { ...data.reviewed_by, full_name: buildName(data.reviewed_by) }
            : null,
          verified_by: data.verified_by
            ? { ...data.verified_by, full_name: buildName(data.verified_by) }
            : null,
        };
      });
    } catch (error) {
      logger.error("[patientChartNoteService.listByPatient]", error);
      throw error;
    }
  },

  /**
   * 📝 Create a new note
   */
  async create(patient_id, data, user) {
    try {
      const note = await db.PatientChartNote.create({
        patient_id,
        organization_id: user.organization_id,
        facility_id: user.facility_id,
        author_id: user.id,
        content: data.content,
        note_type: data.note_type || "doctor",
        status: data.status || "draft",
        created_by_id: user.id,
      });

      await auditService.logAction({
        module: "patient_chart",
        action: "create_note",
        entityId: note.id,
        user,
        details: { note_type: note.note_type },
      });

      return note;
    } catch (error) {
      logger.error("[patientChartNoteService.create]", error);
      throw error;
    }
  },

  /**
   * ✏️ Update an existing note
   */
  async update(note_id, data, user) {
    try {
      const note = await db.PatientChartNote.findByPk(note_id);
      if (!note) return null;

      await note.update({
        content: data.content ?? note.content,
        status: data.status ?? note.status,
        note_type: data.note_type ?? note.note_type,
        updated_by_id: user.id,
        updated_at: new Date(),
      });

      await auditService.logAction({
        module: "patient_chart",
        action: "update_note",
        entityId: note_id,
        user,
      });

      return note;
    } catch (error) {
      logger.error("[patientChartNoteService.update]", error);
      throw error;
    }
  },

  /**
   * 🗑️ Soft delete a note
   */
  async delete(note_id, user) {
    try {
      const note = await db.PatientChartNote.findByPk(note_id);
      if (!note) return null;

      await note.update({
        deleted_by_id: user.id,
        deleted_at: new Date(),
        status: "voided",
      });

      await auditService.logAction({
        module: "patient_chart",
        action: "delete_note",
        entityId: note_id,
        user,
      });

      return note;
    } catch (error) {
      logger.error("[patientChartNoteService.delete]", error);
      throw error;
    }
  },

  /**
   * ✅ Review or verify a note (optional workflow)
   */
  async verify(note_id, user, isReview = false) {
    try {
      const note = await db.PatientChartNote.findByPk(note_id);
      if (!note) return null;

      if (isReview) {
        await note.update({
          reviewed_by_id: user.id,
          reviewed_at: new Date(),
        });
      } else {
        await note.update({
          verified_by_id: user.id,
          verified_at: new Date(),
          status: "verified",
        });
      }

      await auditService.logAction({
        module: "patient_chart",
        action: isReview ? "review_note" : "verify_note",
        entityId: note_id,
        user,
      });

      return note;
    } catch (error) {
      logger.error("[patientChartNoteService.verify]", error);
      throw error;
    }
  },

  /**
   * 📋 List all notes (Enterprise filter page)
   */
  async listAllNotes({ page = 1, limit = 25, filters = {}, user }) {
    try {
      const offset = (page - 1) * limit;
      const where = { deleted_at: null };

      if (filters.patient_id) where.patient_id = filters.patient_id;
      if (filters.note_type) where.note_type = filters.note_type;
      if (filters.status) where.status = filters.status;
      if (filters.organization_id) where.organization_id = filters.organization_id;
      if (filters.facility_id) where.facility_id = filters.facility_id;

      const { rows, count } = await db.PatientChartNote.findAndCountAll({
        where,
        limit,
        offset,
        order: [["created_at", "DESC"]],
        include: [
          { model: db.Organization, as: "organization", attributes: ["id", "name"] },
          { model: db.Facility, as: "facility", attributes: ["id", "name"] },
          {
            model: db.Patient,
            as: "patient",
            attributes: ["id", "first_name", "last_name"],
          },
          {
            model: db.User,
            as: "author",
            attributes: ["id", "first_name", "last_name"],
          },
          {
            model: db.User,
            as: "reviewed_by",
            attributes: ["id", "first_name", "last_name"],
          },
          {
            model: db.User,
            as: "verified_by",
            attributes: ["id", "first_name", "last_name"],
          },
        ],
      });

      // ✅ Compute full_name dynamically for each related person + patient
      const records = rows.map((note) => {
        const data = note.toJSON();
        const buildName = (obj) =>
          obj
            ? `${obj.first_name || ""} ${obj.last_name || ""}`.trim()
            : null;
        return {
          ...data,
          patient: data.patient
            ? { ...data.patient, full_name: buildName(data.patient) }
            : null,
          author: data.author
            ? { ...data.author, full_name: buildName(data.author) }
            : null,
          reviewed_by: data.reviewed_by
            ? { ...data.reviewed_by, full_name: buildName(data.reviewed_by) }
            : null,
          verified_by: data.verified_by
            ? { ...data.verified_by, full_name: buildName(data.verified_by) }
            : null,
        };
      });

      return {
        records,
        pagination: {
          page: Number(page),
          pageCount: Math.ceil(count / limit),
          totalRecords: count,
        },
      };
    } catch (error) {
      logger.error("[patientChartNoteService.listAllNotes]", error);
      throw error;
    }
  },
};
