// 📁 frontend/js/dashboard/index.js
import { initDashboardSession } from "./dashboard-handler.js";


document.addEventListener("DOMContentLoaded", () => {
  initDashboardSession();
});

// ======================================================
// 📘 MANUAL NAVIGATION (GLOBAL)
// ======================================================
window.goToManual = function () {
  window.location.href = "/db-manual.html";
};

// ======================================================
// 📘 ULTRA SMOOTH DRAG (GPU ACCELERATED)
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("manualFloat");
  if (!btn) return;

  let isDragging = false;
  let startX, startY, currentX = 0, currentY = 0;
  let moved = false;

  btn.style.willChange = "transform";

  // START DRAG
  btn.addEventListener("mousedown", (e) => {
    isDragging = true;
    moved = false;

    startX = e.clientX - currentX;
    startY = e.clientY - currentY;

    btn.style.transition = "none"; // remove animation during drag
  });

  // DRAG MOVE
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    currentX = e.clientX - startX;
    currentY = e.clientY - startY;

    if (Math.abs(currentX) > 2 || Math.abs(currentY) > 2) {
      moved = true;
    }

    btn.style.transform = `translate(${currentX}px, ${currentY}px)`;
  });

  // END DRAG
  document.addEventListener("mouseup", () => {
    if (!isDragging) return;

    isDragging = false;
    btn.style.transition = "transform 0.2s ease";
  });

  // CLICK (ONLY if not dragged)
  btn.addEventListener("click", () => {
    if (!moved) {
      window.location.href = "/db-manual.html";
    }
  });
});