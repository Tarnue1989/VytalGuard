// 📁 frontend/js/dashboard/index.js
import { initDashboardSession } from "./dashboard-handler.js";


document.addEventListener("DOMContentLoaded", () => {
  initDashboardSession();
});

// ======================================================
// 📘 ULTRA SMOOTH DRAG (FINAL FIX — TRUE POSITIONING)
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("manualFloat");
  if (!btn) return;

  let isDragging = false;
  let startX = 0, startY = 0;
  let currentX = 0, currentY = 0;
  let moved = false;

  // 🔥 Convert initial position (bottom/right → top/left)
  const rect = btn.getBoundingClientRect();
  currentX = rect.left;
  currentY = rect.top;

  btn.style.left = currentX + "px";
  btn.style.top = currentY + "px";
  btn.style.bottom = "auto";
  btn.style.right = "auto";

  btn.style.position = "fixed";
  btn.style.willChange = "transform";

  // ======================
  // 🔹 START
  // ======================
  const start = (x, y) => {
    isDragging = true;
    moved = false;

    startX = x - currentX;
    startY = y - currentY;

    btn.style.transition = "none";
  };

  btn.addEventListener("mousedown", (e) => start(e.clientX, e.clientY));
  btn.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    start(t.clientX, t.clientY);
  });

  // ======================
  // 🔹 MOVE (BOUNDARY SAFE)
  // ======================
  const move = (x, y) => {
    if (!isDragging) return;

    const rect = btn.getBoundingClientRect();

    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    let nextX = x - startX;
    let nextY = y - startY;

    // 🔒 KEEP INSIDE SCREEN
    currentX = Math.max(0, Math.min(nextX, maxX));
    currentY = Math.max(0, Math.min(nextY, maxY));

    if (Math.abs(currentX) > 5 || Math.abs(currentY) > 5) {
      moved = true;
    }

    btn.style.left = currentX + "px";
    btn.style.top = currentY + "px";
  };

  document.addEventListener("mousemove", (e) => move(e.clientX, e.clientY));
  document.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    move(t.clientX, t.clientY);
  });

  // ======================
  // 🔹 END
  // ======================
  const end = () => {
    if (!isDragging) return;

    isDragging = false;
    btn.style.transition = "all 0.2s ease";
  };

  document.addEventListener("mouseup", end);
  document.addEventListener("touchend", end);

  // ======================
  // 🔹 CLICK SAFE
  // ======================
  btn.addEventListener("click", (e) => {
    if (moved) {
      e.preventDefault();
      return;
    }

    window.location.href = "/db-manual.html";
  });
});