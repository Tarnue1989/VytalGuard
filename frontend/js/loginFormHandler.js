// 📁 frontend/js/loginFormHandler.js
import { login } from "/js/authSession.js";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const resetPasswordForm = document.getElementById("resetPasswordForm");

  const emailField = document.getElementById("email");
  const passwordField = document.getElementById("password");
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");
  const errorMsg = document.getElementById("errorMsg");
  const submitBtn = loginForm.querySelector("button[type='submit']");

  // Autofocus email on page load
  emailField.focus();

  // Toggle password visibility
  togglePasswordBtn.addEventListener("click", () => {
    const isPassword = passwordField.type === "password";
    passwordField.type = isPassword ? "text" : "password";

    const icon = togglePasswordBtn.querySelector("i");
    icon.classList.toggle("ri-eye-line", !isPassword);
    icon.classList.toggle("ri-eye-off-line", isPassword);
  });

  // Submit handler
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMsg.style.display = "none";

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    try {
      await login({
        email: emailField.value.trim(),
        password: passwordField.value
      });

    } catch (err) {

      if (
        err.message &&
        err.message.toLowerCase().includes("reset")
      ) {
        loginForm.style.display = "none";
        resetPasswordForm.style.display = "block";

        window.__RESET_EMAIL__ = emailField.value.trim();

        const newPasswordField = document.getElementById("newPassword");
        if (newPasswordField) newPasswordField.focus();

        return;
      }

      errorMsg.textContent = err.message || "Login failed. Try again.";
      errorMsg.style.display = "block";

    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
    }
  });

  passwordField.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      loginForm.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });
});