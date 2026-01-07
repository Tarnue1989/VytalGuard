// 📘 backend/src/services/patientChart/patientChartCacheService.js
// ============================================================================
// 🔹 Enterprise-aligned cache service for patient chart snapshots
// 🔹 Supports: listAll(), invalidate(), getOrRevalidate()
// 🔹 Used by patientChartController.invalidateCache() and view routes
// ============================================================================

import db from "../../models/index.js";
import { patientChartService } from "./patientChartService.js";
import { auditService } from "../auditService.js";
import { logger } from "../../utils/logger.js";
import { isSuperAdmin } from "../../utils/role-utils.js";

export const patientChartCacheService = {
  /* ============================================================
     📋 List Cached Charts
  ============================================================ */
  async listAll({
    where = {},
    attributes,
    order = [["generated_at", "DESC"]],
    page = 1,
    limit = 25,
    user,
  }) {
    const offset = (page - 1) * limit;
    try {
      // 🔐 Role-aware filter bypass
      if (isSuperAdmin(user)) {
        delete where.organization_id;
        delete where.facility_id;
        logger.info("🛡️ SuperAdmin bypass active → org/fac filters removed");
      }

      // 🗺️ Field mapping for Sequelize attributes
      const FIELD_MAP = {
        organization: "organization_id",
        facility: "facility_id",
        patient: "patient_id",
        revalidated_by: "revalidated_by_id",
        createdBy: "created_by_id",
        updatedBy: "updated_by_id",
        deletedBy: "deleted_by_id",
      };
      const INVALID_FIELDS = ["actions"];
      if (Array.isArray(attributes)) {
        attributes = attributes
          .map((a) => FIELD_MAP[a] || a)
          .filter((a) => !INVALID_FIELDS.includes(a));
      }

      // 📊 Query patient chart cache
      const { count, rows } = await db.PatientChartCache.findAndCountAll({
        where,
        attributes,
        order,
        limit,
        offset,
        paranoid: false,
        include: [
          {
            model: db.Patient,
            as: "patient",
            attributes: [
              "id",
              "pat_no",
              "first_name",
              "middle_name",
              "last_name",
            ],
            required: false,
          },
          {
            model: db.Organization,
            as: "organization",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: db.Facility,
            as: "facility",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: db.User,
            as: "created_by",
            attributes: ["id", "first_name", "last_name"],
            required: false,
          },
          {
            model: db.User,
            as: "updated_by",
            attributes: ["id", "first_name", "last_name"],
            required: false,
          },
          {
            model: db.User,
            as: "deleted_by",
            attributes: ["id", "first_name", "last_name"],
            required: false,
          },
          {
            model: db.User,
            as: "revalidated_by",
            attributes: ["id", "first_name", "last_name"],
            required: false,
          },
        ],
      });

      // 🧩 Format records with computed full names
      const records = rows.map((r) => {
        const data = r.get({ plain: true });

        if (data.patient) {
          data.patient.full_name = [
            data.patient.first_name,
            data.patient.middle_name,
            data.patient.last_name,
          ]
            .filter(Boolean)
            .join(" ");
        }

        ["created_by", "updated_by", "deleted_by", "revalidated_by"].forEach(
          (k) => {
            if (data[k]) {
              data[k].full_name = [data[k].first_name, data[k].last_name]
                .filter(Boolean)
                .join(" ");
            }
          }
        );

        return data;
      });

      return {
        records,
        pagination: {
          page,
          pageCount: Math.ceil(count / limit),
          total: count,
        },
      };
    } catch (e) {
      logger.error("[patientChartCacheService.listAll]", e);
      throw e;
    }
  },

  /* ============================================================
     🔁 Invalidate / Rebuild Cache for a Patient
  ============================================================ */
  async invalidate(patientId, user) {
    try {
      logger.info(
        `[patientChartCacheService.invalidate] Rebuilding cache for patient ${patientId}`
      );

      // 1️⃣ Verify patient exists
      const patient = await db.Patient.findByPk(patientId, {
        attributes: ["organization_id", "facility_id"],
      });
      if (!patient) throw new Error("Patient not found");

      // 2️⃣ Generate new full chart snapshot
      const snapshot = await patientChartService.getFullChart(patientId, user);

      // 3️⃣ Find existing cache record
      const existing = await db.PatientChartCache.findOne({
        where: { patient_id: patientId },
      });

      let cache;
      if (existing) {
        await existing.update({
          chart_snapshot: snapshot,
          revalidated_by_id: user?.id || null,
          revalidated_at: new Date(),
          organization_id: patient.organization_id || existing.organization_id,
          facility_id: patient.facility_id || existing.facility_id,
          updated_by_id: user?.id || null,
        });
        cache = existing;
      } else {
        cache = await db.PatientChartCache.create({
          patient_id: patientId,
          chart_snapshot: snapshot,
          organization_id: patient.organization_id || user?.organization_id || null,
          facility_id: patient.facility_id || user?.facility_id || null,
          generated_at: new Date(),
          revalidated_by_id: user?.id || null,
          revalidated_at: new Date(),
          created_by_id: user?.id || null,
        });
      }

      // 4️⃣ Log audit event
      await auditService.logAction({
        module: "patient_chart_cache",
        action: "invalidate",
        entityId: patientId,
        user,
      });

      logger.info(
        `[patientChartCacheService.invalidate] ✅ Cache rebuilt successfully for ${patientId}`
      );
      return cache;
    } catch (err) {
      logger.error("[patientChartCacheService.invalidate]", err);
      throw err;
    }
  },

  /* ============================================================
     🔍 getOrRevalidate – Helper to auto-refresh cache if missing
  ============================================================ */
  async getOrRevalidate(patientId, user) {
    try {
      let cache = await db.PatientChartCache.findOne({
        where: { patient_id: patientId },
      });

      if (!cache) {
        logger.info(
          `[patientChartCacheService.getOrRevalidate] No cache found → rebuilding for patient ${patientId}`
        );
        cache = await this.invalidate(patientId, user);
      }

      return cache;
    } catch (err) {
      logger.error("[patientChartCacheService.getOrRevalidate]", err);
      throw err;
    }
  },
};
