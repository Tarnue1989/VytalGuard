// 📁 frontend/js/logout.js
import { logout } from "./authSession.js";

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    try {
      await logout(); // ✅ Uses the central authSession logout logic
    } catch (err) {
      console.error("Logout failed:", err);
      alert("Error logging out. Please try again.");
    }
  });
});
