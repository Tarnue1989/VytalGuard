// 📁 assets/js/modules/waivers/waivers-actions.js
import {
  showToast,
  showConfirm,
  showLoading,
  hideLoading,
} from "../../../utils/index.js";
import { authFetch } from "../../../authSession.js";
import { renderWaiverDetail } from "./waivers-render.js"; // ⬅️ you’ll need to implement

// 🔹 Import enums (keep in sync with backend)
import { REVERSE_TYPES } from "../../../utils/constants.js";

export function setupWaiverActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
}) {
  const tableBody = document.getElementById("waiverTableBody");
  const cardContainer = document.getElementById("waiverList");

  // cache last entries
  window.latestWaiverEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestWaiverEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback: fetch full record if not cached
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/waivers/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Waiver not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Waiver data missing");

    const classList = btn.classList;

    if (classList.contains("view-btn")) return handleView(entry);
    if (classList.contains("approve-btn"))
      return await handleDecision(id, "approve");
    if (classList.contains("reject-btn"))
      return await handleDecision(id, "reject");
    if (classList.contains("delete-btn")) return await handleDelete(id);
    if (classList.contains("reverse-btn")) {
      const transId = btn.dataset.transId || id;
      openReverseModal(transId);
    }
  }

  /* ---------------------- handlers ---------------------- */

  function handleView(entry) {
    let role = (localStorage.getItem("userRole") || "").trim().toLowerCase();
    if (role.includes("super") && role.includes("admin")) role = "superadmin";
    else if (role.includes("admin")) role = "admin";
    else role = "staff";

    const html = renderWaiverDetail(entry, role);
    const modal = document.getElementById("viewModal");
    modal.querySelector("#viewModalTitle").textContent = "Waiver Details";
    modal.querySelector("#viewModalBody").innerHTML = html;
    modal.classList.remove("hidden");
  }

  async function handleDecision(id, decision) {
    const confirmed = await showConfirm(
      `Are you sure you want to ${decision} this waiver?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/waivers/${id}/${decision}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `❌ Failed to ${decision}`);

      showToast(`✅ Waiver ${decision}d successfully`);
      window.latestWaiverEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${decision} waiver`);
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this waiver? (Admin only)");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/waivers/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete waiver");

      showToast(`✅ Waiver deleted successfully`);
      window.latestWaiverEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete waiver");
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- reverse ---------------------- */

  function openReverseModal(transId) {
    const modal = document.getElementById("reverseModal");
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.dataset.transId = transId;

    const select = document.getElementById("reverseType");
    if (select) {
      select.innerHTML = `<option value="">-- Choose Type --</option>`;
      REVERSE_TYPES.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
        select.appendChild(opt);
      });
    }

    const form = document.getElementById("reverseForm");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "true";
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const type =
          modal.dataset.type || document.getElementById("reverseType").value;
        const reason = document.getElementById("reverseReason").value;
        if (!transId || !type)
          return showToast("❌ Missing details for reversal");

        await submitAction(`/api/waivers/${transId}/reverse`, { type, reason });
        modal.classList.add("hidden");
      });
    }
  }

  /* ---------------------- submit wrapper ---------------------- */

  async function submitAction(endpoint, payload) {
    try {
      showLoading();
      const res = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `❌ Failed`);

      showToast(`✅ ${data.message || "Action successful"}`);
      window.latestWaiverEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to perform action");
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- global helpers ---------------------- */

  window.viewWaiver = (id) => {
    const btn = document.querySelector(`.view-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ View button not found");
  };

  ["approve", "reject", "delete", "reverse"].forEach((action) => {
    window[`${action}Waiver`] = (id) => {
      const btn = document.querySelector(`.${action}-btn[data-id="${id}"]`);
      if (btn) btn.click();
      else showToast(`❌ ${action} button not found`);
    };
  });
}
