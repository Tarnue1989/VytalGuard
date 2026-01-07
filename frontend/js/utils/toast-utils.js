// 🔔 Toasts, Loaders, Confirmation Modals

/**
 * Displays a floating toast notification on screen with fade in/out.
 * @param {string} message - Message to show
 * @param {number} duration - Duration in ms
 */
export function showToast(message, typeOrDuration = 3000) {
  const toast = document.createElement("div");
  toast.className = "toast";

  if (typeof typeOrDuration === "string") {
    toast.classList.add(typeOrDuration); // e.g., 'error', 'success'
  }

  const duration = typeof typeOrDuration === "number" ? typeOrDuration : 3000;

  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => document.body.removeChild(toast), 400);
  }, duration);
}

/**
 * Shows the loading overlay spinner.
 */
export function showLoading() {
  document.getElementById("loadingOverlay")?.classList.remove("hidden");
}

/**
 * Hides the loading overlay spinner.
 */
export function hideLoading() {
  document.getElementById("loadingOverlay")?.classList.add("hidden");
}

/**
 * Display a styled confirmation modal popup.
 * Returns a Promise that resolves to true (Yes) or false (Cancel).
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export function showConfirm(message = "Are you sure?") {
  return new Promise((resolve) => {
    // ✅ Remove any existing confirmation modals
    document.querySelectorAll(".confirm-overlay").forEach((el) => el.remove());

    // 📦 Create overlay and modal box
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";

    const box = document.createElement("div");
    box.className = "confirm-box";
    box.innerHTML = `
      <p class="confirm-message">${message}</p>
      <div class="confirm-actions">
        <button class="btn-confirm-yes">Yes</button>
        <button class="btn-confirm-no">Cancel</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // 🧼 Cleanup function
    const cleanup = () => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      document.removeEventListener("keydown", escHandler);
    };

    // ⌨️ ESC to cancel
    const escHandler = (event) => {
      if (event.key === "Escape") {
        cleanup();
        resolve(false);
      }
    };
    document.addEventListener("keydown", escHandler);

    // ✅ Buttons
    box.querySelector(".btn-confirm-yes").onclick = () => {
      cleanup();
      resolve(true);
    };

    box.querySelector(".btn-confirm-no").onclick = () => {
      cleanup();
      resolve(false);
    };
  });
}

/**
 * Run an async task with a loading spinner shown automatically.
 * @param {Function} taskFn - Async function to run
 */
export function runWithLoader(taskFn) {
  showLoading();
  setTimeout(async () => {
    try {
      await taskFn();
    } catch (err) {
      console.error("❌ Error in runWithLoader:", err);
      showToast("❌ Something went wrong.");
    } finally {
      hideLoading();
    }
  }, 50);
}

/**
 * 📥 Show a modal with a textarea input + confirm/cancel buttons.
 * Requires elements with IDs: inputModal, inputModalTitle, inputModalLabel,
 * inputModalTextarea, inputModalConfirmBtn, inputModalCancelBtn, closeInputModal.
 *
 * @param {Object} options
 * @param {string} options.title - Modal title
 * @param {string} options.label - Label above textarea
 * @param {string} options.confirmText - Button text
 * @param {Function} options.onConfirm - Callback on confirm with textarea value
 */
export function showInputModal({ title, label, confirmText, onConfirm }) {
  const modal = document.getElementById("inputModal");
  const titleEl = document.getElementById("inputModalTitle");
  const labelEl = document.getElementById("inputModalLabel");
  const textarea = document.getElementById("inputModalTextarea");
  const confirmBtn = document.getElementById("inputModalConfirmBtn");

  if (!modal || !titleEl || !labelEl || !textarea || !confirmBtn) {
    console.warn("❌ Missing input modal elements.");
    return;
  }

  titleEl.textContent = title || "Confirm";
  labelEl.textContent = label || "Enter your reason:";
  confirmBtn.innerHTML = `<i class="fas fa-check-circle"></i> ${confirmText || "Confirm"}`;
  textarea.value = "";

  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.onclick = () => {
    const value = textarea.value.trim();
    if (!value) return showToast("❌ Please enter a reason");
    modal.classList.add("hidden");
    onConfirm(value);
  };

  document.getElementById("inputModalCancelBtn").onclick =
  document.getElementById("closeInputModal").onclick = () => {
    modal.classList.add("hidden");
  };

    modal.classList.remove("hidden");

    setTimeout(() => {
    textarea.focus();
    }, 100);

}

/**
 * Displays a persistent token toast in the bottom-right.
 * @param {string} token - The reset token string.
 * @param {string|Date} expiresAt - Expiration datetime (ISO or Date).
 */
export function showTokenToast(token, expiresAt) {
  const div = document.createElement("div");
  div.className = "toast token-toast show";

  const formatted = new Date(expiresAt).toLocaleString();
  div.innerHTML = `
    <strong>🔐 Token:</strong>
    <code>${token}</code>
    <div style="margin-top: 0.25rem;">🕒 <span>${formatted}</span></div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  // Ensure only one token toast at a time
  document.querySelectorAll(".toast.token-toast").forEach(el => el.remove());
  document.body.appendChild(div);
}

