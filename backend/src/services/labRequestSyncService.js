// 📁 services/labRequestSyncService.js
import { LabRequest, LabRequestItem, LabResult, User } from "../models/index.js";
import { LAB_REQUEST_STATUS } from "../constants/enums.js";
import { auditService } from "./auditService.js";

const LRS = {
  DRAFT: LAB_REQUEST_STATUS[0],
  PENDING: LAB_REQUEST_STATUS[1],
  IN_PROGRESS: LAB_REQUEST_STATUS[2],
  COMPLETED: LAB_REQUEST_STATUS[3],
  VERIFIED: LAB_REQUEST_STATUS[4],
  CANCELLED: LAB_REQUEST_STATUS[5],
  VOIDED: LAB_REQUEST_STATUS[6],
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
      item.status = "pending";
      allVerified = false;
      allCompleted = false;
      anyPending = true;
    } else {
      const statuses = item.labResults.map(r => r.status);

      if (statuses.includes("verified")) {
        item.status = "verified";
      } else if (statuses.includes("reviewed")) {
        // 👈 treat reviewed like completed
        item.status = "completed";
        allVerified = false;
      } else if (statuses.includes("completed")) {
        item.status = "completed";
        allVerified = false;
      } else if (
        statuses.includes("in_progress") ||
        statuses.includes("draft") ||
        statuses.includes("pending")
      ) {
        // ✅ Treat draft/pending results as "in_progress"
        item.status = "in_progress";
        allVerified = false;
        allCompleted = false;
        anyInProgress = true;
      } else if (statuses.includes("cancelled")) {
        item.status = "cancelled";
        allVerified = false;
        allCompleted = false;
      } else if (statuses.includes("voided")) {
        item.status = "voided";
        allVerified = false;
        allCompleted = false;
      } else {
        item.status = "pending"; // fallback
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
    if (!["cancelled", "voided"].includes(item.status)) {
      allCancelledOrVoided = false;
    }
    if (item.status !== "completed" && item.status !== "verified") {
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
