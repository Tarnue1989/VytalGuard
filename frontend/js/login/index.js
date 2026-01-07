// 📁 frontend/js/login/index.js
import { login } from "/js/authSession.js";

document.addEventListener("DOMContentLoaded", () => {
  /* ============================================================
     📌 ELEMENT REFERENCES (MATCH HTML EXACTLY)
  ============================================================ */
  const loginForm = document.getElementById("loginForm");
  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const tokenResetSection = document.getElementById("tokenResetSection");
  const tokenResetForm = document.getElementById("tokenResetForm");

  const emailField = document.getElementById("email");
  const passwordField = document.getElementById("password");
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");

  const loginErrorMsg = document.getElementById("errorMsg");
  const resetErrorMsg = document.getElementById("errorMsg");
  const tokenErrorMsg = document.getElementById("errorMsg");


  const useResetTokenLink = document.getElementById("useResetTokenLink");
  const backToLoginBtn = document.getElementById("backToLoginBtn");

  const hideAllErrors = () => {
    loginErrorMsg && (loginErrorMsg.style.display = "none");
    resetErrorMsg && (resetErrorMsg.style.display = "none");
    tokenErrorMsg && (tokenErrorMsg.style.display = "none");
  };

  /* ============================================================
     🔐 LOGIN
  ============================================================ */
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAllErrors();

    try {
      await login({
        email: emailField.value.trim(),
        password: passwordField.value,
      });
    } catch (err) {
      const msg = (err.message || "").toLowerCase();

      // Force reset required
      if (err.status === 403 || msg.includes("reset your password")) {
        loginForm.style.display = "none";
        tokenResetSection.style.display = "none";
        resetPasswordForm.style.display = "block";

        window.__RESET_EMAIL__ = emailField.value.trim();
        document.getElementById("newPassword")?.focus();
        return;
      }

      loginErrorMsg.textContent = err.message || "Login failed";
      loginErrorMsg.style.display = "block";
    }
  });

  /* ============================================================
     👁️ TOGGLE PASSWORD VISIBILITY
  ============================================================ */
  togglePasswordBtn?.addEventListener("click", () => {
    const isPassword = passwordField.type === "password";
    passwordField.type = isPassword ? "text" : "password";

    const icon = togglePasswordBtn.querySelector("i");
    icon.classList.toggle("ri-eye-line", !isPassword);
    icon.classList.toggle("ri-eye-off-line", isPassword);
  });

  /* ============================================================
     🔑 FORCE PASSWORD RESET
  ============================================================ */
  resetPasswordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAllErrors();

    const newPassword = document.getElementById("newPassword")?.value;
    const confirmPassword = document.getElementById("confirmPassword")?.value;
    const submitBtn = resetPasswordForm.querySelector("button[type='submit']");

    if (!newPassword || newPassword.length < 8) {
      resetErrorMsg.textContent = "Password must be at least 8 characters.";
      resetErrorMsg.style.display = "block";
      return;
    }

    if (newPassword !== confirmPassword) {
      resetErrorMsg.textContent = "Passwords do not match.";
      resetErrorMsg.style.display = "block";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Updating...";

    try {
      const res = await fetch("/api/auth/force-reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: window.__RESET_EMAIL__,
          newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Password reset failed");
      }

      resetPasswordForm.reset();
      resetPasswordForm.style.display = "none";
      loginForm.style.display = "block";

      loginErrorMsg.textContent = "✅ Password updated. Please log in.";
      loginErrorMsg.style.display = "block";
      passwordField.value = "";

    } catch (err) {
      resetErrorMsg.textContent = err.message;
      resetErrorMsg.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Update Password";
    }
  });

  /* ============================================================
     🧾 RESET VIA TOKEN
  ============================================================ */
  useResetTokenLink?.addEventListener("click", () => {
    loginForm.style.display = "none";
    resetPasswordForm.style.display = "none";
    tokenResetSection.style.display = "block";
    hideAllErrors();
  });

  backToLoginBtn?.addEventListener("click", () => {
    loginForm.style.display = "block";
    resetPasswordForm.style.display = "none";
    tokenResetSection.style.display = "none";
    hideAllErrors();
  });

  tokenResetForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAllErrors();

    const email = document.getElementById("tokenEmail").value.trim();
    const token = document.getElementById("resetToken").value.trim();
    const newPassword = document.getElementById("tokenNewPassword").value;
    const confirmPassword = document.getElementById("tokenConfirmPassword").value;

    if (newPassword !== confirmPassword) {
      tokenErrorMsg.textContent = "Passwords do not match.";
      tokenErrorMsg.style.display = "block";
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password-with-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Token reset failed");
      }

      tokenResetForm.reset();
      tokenResetSection.style.display = "none";
      loginForm.style.display = "block";

      loginErrorMsg.textContent = "✅ Password reset successful. Please log in.";
      loginErrorMsg.style.display = "block";

    } catch (err) {
      tokenErrorMsg.textContent = err.message;
      tokenErrorMsg.style.display = "block";
    }
  });
});
