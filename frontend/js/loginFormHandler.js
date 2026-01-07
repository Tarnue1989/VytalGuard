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

    // Prevent multiple clicks
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    try {
      await login({
        email: emailField.value.trim(),
        password: passwordField.value,
      });
      // success redirect handled by authSession.js

    } catch (err) {

      // 🔐 MUST RESET PASSWORD → unhide reset fields (ALL-IN-ONE FORM)
      if (
        err.message &&
        err.message.toLowerCase().includes("reset")
      ) {
        // Hide login form
        loginForm.style.display = "none";

        // Show reset password form
        resetPasswordForm.style.display = "block";

        // Preserve email for reset submission
        window.__RESET_EMAIL__ = emailField.value.trim();

        // Focus new password field
        const newPasswordField = document.getElementById("newPassword");
        if (newPasswordField) newPasswordField.focus();

        return;
      }

      // Normal login error
      errorMsg.textContent = err.message || "Login failed. Try again.";
      errorMsg.style.display = "block";

    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
    }
  });

  // Support Enter key inside password field
  passwordField.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      loginForm.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });
});
