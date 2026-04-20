import { renderTimeline } from "./timeline-renderer.js";

export function initTimelines(root = document) {
  const nodes = root.querySelectorAll(".card-timeline");

  nodes.forEach((el) => {
    const module = el.dataset.module;
    const status = String(el.dataset.status || "").toLowerCase();

    const entry = el.__entry || {};
    let stepMeta = {};

    // =====================================================
    // 🧾 REGISTRATION LOG
    // =====================================================
    if (module === "registration_log") {
      const billed = !!entry.invoice || !!entry.invoice_id;

      const isInsurance =
        entry.payer_type === "insurance" && !!entry.patientInsurance;

      const claimCreated =
        !!entry.insuranceClaim ||
        !!entry.invoice?.insuranceClaim ||
        !!entry.invoice?.insurance_claim_id;

      stepMeta = {
        // 🔥 ACTIVE → BILL ALWAYS IF EXISTS
        active: {
          text: billed ? "Billed" : "",
          className: billed ? "text-success fw-semibold" : ""
        },

        // 🔥 COMPLETED → CLAIM ONLY (INSURANCE)
        completed: {
          text:
            status === "completed" && isInsurance && claimCreated
              ? "Claim Created"
              : "",
          className:
            status === "completed" && isInsurance && claimCreated
              ? "text-success fw-semibold"
              : ""
        }
      };
    }

    // =====================================================
    // 📦 ORDER
    // =====================================================
    if (module === "order") {
      const billed = !!entry.invoice || !!entry.invoice_id;

      stepMeta = {
        // 🔥 BILLING HAPPENS AT PENDING (YOUR RULE)
        pending: {
          text: billed ? "Billed" : "",
          className: billed ? "text-success fw-semibold" : ""
        }
      };
    }

    renderTimeline({
      module,
      status,
      container: el,
      stepMeta
    });
  });
}