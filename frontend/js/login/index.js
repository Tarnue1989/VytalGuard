// 📁 frontend/js/login/index.js — ENTERPRISE FRONTEND (FINAL)
import { login } from "/js/authSession.js";

document.addEventListener("DOMContentLoaded", () => {

  /* ============================================================
     🧠 STATE (NO GLOBALS)
  ============================================================ */
  const authState = {
    mode: "login", // login | reset | token
    resetEmail: null,
  };

  /* ============================================================
     📌 ELEMENTS
  ============================================================ */
  const loginForm = document.getElementById("loginForm");
  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const tokenResetSection = document.getElementById("tokenResetSection");
  const tokenResetForm = document.getElementById("tokenResetForm");

  const emailField = document.getElementById("email");
  const passwordField = document.getElementById("password");
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");

  const loginErrorMsg = document.getElementById("errorMsg");
  const resetErrorMsg = document.getElementById("resetErrorMsg");
  const tokenErrorMsg = document.getElementById("tokenErrorMsg");

  const newPasswordField = document.getElementById("newPassword");

  const useResetTokenLink = document.getElementById("useResetTokenLink");
  const backToLoginBtn = document.getElementById("backToLoginBtn");

  /* ============================================================
     🎨 UI HELPERS (CLEAN + REUSABLE)
  ============================================================ */
  const showError = (el, msg) => {
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
  };

  const clearError = (el) => {
    if (!el) return;
    el.textContent = "";
    el.style.display = "none";
  };

  const hideAllErrors = () => {
    [loginErrorMsg, resetErrorMsg, tokenErrorMsg].forEach(clearError);
  };

  const setFieldState = (field, valid) => {
    if (!field) return;
    if (valid === null) {
      field.style.borderColor = "";
    } else {
      field.style.borderColor = valid ? "#28a745" : "#dc3545";
    }
  };

  const setLoading = (btn, loadingText) => {
    if (!btn) return;
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = loadingText;
  };

  const clearLoading = (btn) => {
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || "Submit";
  };

  /* ============================================================
     📧 EMAIL VALIDATION
  ============================================================ */
  const isValidEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  emailField?.addEventListener("input", () => {
    const email = emailField.value.trim();

    if (!email) {
      clearError(loginErrorMsg);
      setFieldState(emailField, null);
      return;
    }

    if (!isValidEmail(email)) {
      showError(loginErrorMsg, "Enter a valid email address.");
      setFieldState(emailField, false);
    } else {
      clearError(loginErrorMsg);
      setFieldState(emailField, true);
    }
  });

  /* ============================================================
     🔐 PASSWORD VALIDATION + STRENGTH
  ============================================================ */
  const validatePassword = (pwd) => ({
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    number: /\d/.test(pwd),
    special: /[^A-Za-z\d]/.test(pwd),
  });

  const getPasswordStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z\d]/.test(pwd)) score++;
    return score; // 0–5
  };

  const getPasswordError = (pwd) => {
    const v = validatePassword(pwd);
    if (!v.length) return "Password must be at least 8 characters.";
    if (!v.upper) return "Must include uppercase letter.";
    if (!v.lower) return "Must include lowercase letter.";
    if (!v.number) return "Must include a number.";
    if (!v.special) return "Must include a special character.";
    return null;
  };

  /* ============================================================
     🔐 LOGIN
  ============================================================ */
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAllErrors();

    const email = emailField.value.trim();
    const password = passwordField.value;

    if (!email) return showError(loginErrorMsg, "Email is required.");
    if (!isValidEmail(email)) return showError(loginErrorMsg, "Invalid email.");
    if (!password) return showError(loginErrorMsg, "Password is required.");

    const btn = loginForm.querySelector("button");
    setLoading(btn, "Signing in...");

    try {
      await login({ email, password });

    } catch (err) {
      const msg = (err.message || "").toLowerCase();

      // 🔴 HANDLE LOCKOUT (ENTERPRISE UX)
      if (msg.includes("too many")) {
        showError(loginErrorMsg, "Too many attempts. Try again later.");
        return;
      }

      // 🔐 FORCE RESET FLOW
      if (msg.includes("reset")) {
        authState.mode = "reset";
        authState.resetEmail = email;

        loginForm.style.display = "none";
        resetPasswordForm.style.display = "block";

        newPasswordField?.focus();
        return;
      }

      showError(loginErrorMsg, err.message || "Login failed");

    } finally {
      clearLoading(btn);
    }
  });

  /* ============================================================
     👁️ PASSWORD TOGGLE
  ============================================================ */
  togglePasswordBtn?.addEventListener("click", () => {
    const isPassword = passwordField.type === "password";
    passwordField.type = isPassword ? "text" : "password";

    const icon = togglePasswordBtn.querySelector("i");
    icon.classList.toggle("ri-eye-line", !isPassword);
    icon.classList.toggle("ri-eye-off-line", isPassword);
  });

  /* ============================================================
     🔑 LIVE PASSWORD FEEDBACK
  ============================================================ */
  newPasswordField?.addEventListener("input", () => {
    const pwd = newPasswordField.value;
    const err = getPasswordError(pwd);

    if (err) {
      showError(resetErrorMsg, err);
      setFieldState(newPasswordField, false);
    } else {
      clearError(resetErrorMsg);
      setFieldState(newPasswordField, true);
    }

    // (Ready for UI strength bar)
    const strength = getPasswordStrength(pwd);
    console.log("Password strength:", strength);
  });

  /* ============================================================
     🔑 FORCE RESET
  ============================================================ */
  resetPasswordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAllErrors();

    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    const btn = resetPasswordForm.querySelector("button");

    const pwdError = getPasswordError(newPassword);
    if (pwdError) return showError(resetErrorMsg, pwdError);

    if (newPassword !== confirmPassword)
      return showError(resetErrorMsg, "Passwords do not match.");

    setLoading(btn, "Updating...");

    try {
      const res = await fetch("/api/auth/force-reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authState.resetEmail,
          newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Reset failed");
      }

      resetPasswordForm.reset();

      authState.mode = "login";
      authState.resetEmail = null;

      resetPasswordForm.style.display = "none";
      loginForm.style.display = "block";

      showError(loginErrorMsg, "✅ Password updated. Please log in.");

    } catch (err) {
      showError(resetErrorMsg, err.message);

    } finally {
      clearLoading(btn);
    }
  });

  /* ============================================================
     🔁 TOKEN RESET
  ============================================================ */
  useResetTokenLink?.addEventListener("click", () => {
    authState.mode = "token";

    loginForm.style.display = "none";
    resetPasswordForm.style.display = "none";
    tokenResetSection.style.display = "block";

    hideAllErrors();
  });

  backToLoginBtn?.addEventListener("click", () => {
    authState.mode = "login";

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

    const pwdError = getPasswordError(newPassword);
    if (pwdError) return showError(tokenErrorMsg, pwdError);

    if (newPassword !== confirmPassword)
      return showError(tokenErrorMsg, "Passwords do not match.");

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

      authState.mode = "login";

      tokenResetSection.style.display = "none";
      loginForm.style.display = "block";

      showError(loginErrorMsg, "✅ Password reset successful. Please log in.");

    } catch (err) {
      showError(tokenErrorMsg, err.message);
    }
  });

});