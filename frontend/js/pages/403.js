document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // Clear both storages
      localStorage.clear();
      sessionStorage.clear();
      // Redirect to login page
      window.location.href = "/login.html";
    });
  }
});
