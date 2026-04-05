// 📁 services/labRequestSyncService.js
import { LabRequest, LabRequestItem, LabResult, User } from "../models/index.js";
import { LAB_REQUEST_STATUS } from "../constants/enums.js";
import { auditService } from "./auditService.js";

/* ============================================================
   🔖 ENUM MAP (OBJECT-SAFE — FIXED)
============================================================ */
const LRS = {
  DRAFT: LAB_REQUEST_STATUS.DRAFT,
  PENDING: LAB_REQUEST_STATUS.PENDING,
  IN_PROGRESS: LAB_REQUEST_STATUS.IN_PROGRESS,
  COMPLETED: LAB_REQUEST_STATUS.COMPLETED,
  VERIFIED: LAB_REQUEST_STATUS.VERIFIED,
  CANCELLED: LAB_REQUEST_STATUS.CANCELLED,
  VOIDED: LAB_REQUEST_STATUS.VOIDED,
};

/**
 * 🔄 Sync LabRequest parent + LabRequestItem status
 * whenever a LabResult changes
 */
export async function syncLabRequestStatus(labRequestId, transaction, user = null) {
  const items = await LabRequestItem.findAll({
    where: { lab_request_id: labRequestId },
    include: [{ model: LabResult, as: "labResults" }],
    transaction,
  });

  // Track for parent aggregation
  let allVerified = true;
  let allCompleted = true;
  let allCancelledOrVoided = true;
  let anyInProgress = false;
  let anyPending = false;

  for (const item of items) {
    let oldStatus = item.status;

    if (!item.labResults?.length) {
      // No results yet → item is pending
      item.status = LRS.PENDING;
      allVerified = false;
      allCompleted = false;
      anyPending = true;
    } else {
      const statuses = item.labResults.map((r) => r.status);

      if (statuses.includes(LAB_REQUEST_STATUS.VERIFIED) || statuses.includes("verified")) {
        item.status = LRS.VERIFIED;
      } else if (statuses.includes("reviewed")) {
        // 👈 treat reviewed like completed
        item.status = LRS.COMPLETED;
        allVerified = false;
      } else if (statuses.includes(LAB_REQUEST_STATUS.COMPLETED) || statuses.includes("completed")) {
        item.status = LRS.COMPLETED;
        allVerified = false;
      } else if (
        statuses.includes(LAB_REQUEST_STATUS.IN_PROGRESS) ||
        statuses.includes("in_progress") ||
        statuses.includes(LAB_REQUEST_STATUS.DRAFT) ||
        statuses.includes("draft") ||
        statuses.includes(LAB_REQUEST_STATUS.PENDING) ||
        statuses.includes("pending")
      ) {
        // ✅ Treat draft/pending results as "in_progress"
        item.status = LRS.IN_PROGRESS;
        allVerified = false;
        allCompleted = false;
        anyInProgress = true;
      } else if (statuses.includes(LAB_REQUEST_STATUS.CANCELLED) || statuses.includes("cancelled")) {
        item.status = LRS.CANCELLED;
        allVerified = false;
        allCompleted = false;
      } else if (statuses.includes(LAB_REQUEST_STATUS.VOIDED) || statuses.includes("voided")) {
        item.status = LRS.VOIDED;
        allVerified = false;
        allCompleted = false;
      } else {
        item.status = LRS.PENDING; // fallback
        allVerified = false;
        allCompleted = false;
        anyPending = true;
      }
    }

    if (item.status !== oldStatus) {
      await auditService.logAction({
        user,
        module: "lab_request_item",
        action: "status_sync",
        entityId: item.id,
        entity: item,
        details: { from: oldStatus, to: item.status },
      });
    }

    await item.save({ transaction });

    // Update parent tracking flags
    if (![LRS.CANCELLED, LRS.VOIDED].includes(item.status)) {
      allCancelledOrVoided = false;
    }
    if (item.status !== LRS.COMPLETED && item.status !== LRS.VERIFIED) {
      allCompleted = false;
    }
  }

  // 🔗 Parent LabRequest status
  const request = await LabRequest.findByPk(labRequestId, { transaction });
  if (!request) return;

  const oldParentStatus = request.status;

  if (items.length === 0) {
    request.status = LRS.DRAFT;
  } else if (allVerified) {
    request.status = LRS.VERIFIED;
  } else if (allCompleted) {
    request.status = LRS.COMPLETED;
  } else if (anyInProgress) {
    request.status = LRS.IN_PROGRESS;
  } else if (allCancelledOrVoided) {
    request.status = LRS.CANCELLED;
  } else {
    request.status = LRS.PENDING;
  }

  if (request.status !== oldParentStatus) {
    await auditService.logAction({
      user,
      module: "lab_request",
      action: "status_sync",
      entityId: request.id,
      entity: request,
      details: { from: oldParentStatus, to: request.status },
    });
  }

  await request.save({ transaction });
}