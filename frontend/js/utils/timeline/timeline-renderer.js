import { TIMELINE_FLOWS, TERMINAL_STATES } from "./timeline-config.js";

const FINAL_SUCCESS_STATES = [
  "completed",
  "paid",
  "verified",
  "finalized",
  "processed",
  "fulfilled",
  "approved"
];

function formatLabel(step = "") {
  return step
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeStepMeta(stepMeta = {}) {
  if (!stepMeta || typeof stepMeta !== "object") return {};

  const normalized = {};

  Object.entries(stepMeta).forEach(([step, value]) => {
    const key = String(step || "").toLowerCase().trim();

    if (!key) return;

    if (typeof value === "string") {
      normalized[key] = value.trim();
      return;
    }

    if (value && typeof value === "object") {
      normalized[key] = {
        text: typeof value.text === "string" ? value.text.trim() : "",
        className:
          typeof value.className === "string" ? value.className.trim() : ""
      };
    }
  });

  return normalized;
}

function getStepMeta(step, stepMetaMap) {
  const key = String(step || "").toLowerCase();
  const value = stepMetaMap[key];

  if (!value) {
    return { text: "", className: "" };
  }

  if (typeof value === "string") {
    return { text: value, className: "" };
  }

  return {
    text: value.text || "",
    className: value.className || ""
  };
}

export function renderTimeline({
  module,
  status,
  container,
  stepMeta = {}
}) {
  if (!module || !status || !container) return;

  const flow = TIMELINE_FLOWS[module];
  if (!flow?.length) return;

  const normalizedStatus = String(status).toLowerCase().trim();
  const isTerminal = TERMINAL_STATES.includes(normalizedStatus);
  const isFinalSuccess = FINAL_SUCCESS_STATES.includes(normalizedStatus);

  const currentIndex = flow.indexOf(normalizedStatus);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;

  const stepMetaMap = normalizeStepMeta(stepMeta);

  let html = `<div class="tl">`;

  flow.forEach((step, i) => {
    let state = "pending";

    if (isTerminal) {
      state = i <= safeIndex ? "terminal" : "pending";
    } else if (isFinalSuccess) {
      state = i <= safeIndex ? "done" : "pending";
    } else if (i < safeIndex) {
      state = "done";
    } else if (i === safeIndex) {
      state = "active";
    }

    const meta = getStepMeta(step, stepMetaMap);

    html += `
      <div class="tl-step ${state}">
        <div class="tl-dot"></div>
        <div class="tl-label">${formatLabel(step)}</div>
        <div class="tl-sub ${meta.className || ""}">
          ${meta.text || ""}
        </div>
      </div>
    `;
  });

  html += `</div>`;

  container.innerHTML = html;
}