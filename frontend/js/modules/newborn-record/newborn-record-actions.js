// 📁 newborn-record-actions.js
import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard, showNewbornModal } from "./newborn-record-render.js";

/* ---------------------- small utils ---------------------- */
function normalizeRole(raw) {
  let role = (raw || "").trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) return "superadmin";
  if (role.includes("admin")) return "admin";
  return "staff";
}
// scope-safe select
function $(root, sel) {
  if (!root) return document.querySelector(sel);
  return root.querySelector(sel) || document.querySelector(sel);
}
// add listener once, scoped
function onOnce(root, sel, evt, fn) {
  const el = $(root, sel);
  if (!el) return false;
  el.addEventListener(evt, fn, { once: true });
  return true;
}

/* ---------------------- modal cleanup ---------------------- */
function closeAllModals() {
  document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
  document.querySelectorAll(".dark-screen").forEach(d => d.remove());
}

/* ---------------------- main setup ---------------------- */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
}) {
  const tableBody = document.getElementById("newbornRecordTableBody");
  const cardContainer = document.getElementById("newbornRecordList");

  // cache
  window.latestNewbornRecordEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestNewbornRecordEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback: fetch if not cached
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/newborn-records/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Newborn record not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Newborn record data missing");

    const classList = btn.classList;
    if (classList.contains("view-btn")) return handleView(entry);
    if (classList.contains("edit-btn")) return handleEdit(entry);
    if (classList.contains("delete-btn")) return await handleDelete(id);
    if (classList.contains("deceased-btn"))
      return await handleMarkDeceased(id, entry);
    if (classList.contains("transfer-btn"))
      return await handleTransfer(id, entry);
    if (classList.contains("void-btn"))
      return await handleVoid(id);
  }

  /* ---------------------- handlers ---------------------- */

  function handleView(entry) {
    const role = normalizeRole(localStorage.getItem("userRole"));
    const html = renderCard(entry, visibleFields, role);
    openViewModal("Newborn Record Info", html);
  }

  function handleEdit(entry) {
    sessionStorage.setItem("newbornRecordEditId", entry.id);
    sessionStorage.setItem("newbornRecordEditPayload", JSON.stringify(entry));
    window.location.href = "add-newborn-record.html";
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this newborn record?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/newborn-records/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete newborn record");

      showToast(`✅ Newborn record deleted successfully`);
      window.latestNewbornRecordEntries = [];
      await loadEntries(currentPage);
      closeAllModals(); // ✅ clean overlays
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete newborn record");
    } finally {
      hideLoading();
    }
  }

  async function handleMarkDeceased(id, entry) {
    const ret = showNewbornModal(
      "Mark Deceased",
      `
      <p>Enter a reason for marking <strong>${entry?.baby_name || "this newborn"}</strong> as deceased:</p>
      <textarea id="reasonInput" class="form-control mb-3" rows="3" placeholder="Reason is required"></textarea>
      <div class="d-grid">
        <button id="confirmDeceasedBtn" class="btn btn-danger">Confirm</button>
      </div>
    `,
      "lg"
    );
    const root = ret?.el || document;

    const confirm = async () => {
      const reason = $(root, "#reasonInput")?.value?.trim() || "";
      if (!reason) return showToast("❌ Reason required");

      try {
        showLoading();
        const res = await authFetch(`/api/newborn-records/${id}/deceased`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "❌ Failed to mark newborn as deceased");

        showToast(`✅ Newborn marked as deceased`);
        ret?.close?.();
        closeAllModals(); // ✅ clean overlays
        window.latestNewbornRecordEntries = [];
        await loadEntries(currentPage);
      } catch (err) {
        console.error(err);
        showToast(err.message || "❌ Failed to mark deceased");
      } finally {
        hideLoading();
      }
    };

    onOnce(root, "#confirmDeceasedBtn", "click", confirm);
    onOnce(root, "#reasonInput", "keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        confirm();
      }
    });
  }

  async function handleTransfer(id, entry) {
    const ret = showNewbornModal(
      "Transfer Newborn",
      `
      <p>Provide transfer details for <strong>${entry?.baby_name || "this newborn"}</strong>:</p>

      <div class="mb-3">
        <label for="transferOrgSelect" class="form-label">Organization</label>
        <select id="transferOrgSelect" class="form-select"></select>
      </div>

      <div class="mb-3">
        <label for="transferFacilitySelect" class="form-label">Facility</label>
        <select id="transferFacilitySelect" class="form-select"></select>
      </div>

      <div class="mb-3">
        <label for="reasonInput" class="form-label">Reason</label>
        <textarea id="reasonInput" class="form-control" rows="3" placeholder="Transfer Reason"></textarea>
      </div>

      <div class="d-grid">
        <button id="confirmTransferBtn" class="btn btn-primary">Confirm</button>
      </div>
    `,
      "lg"
    );
    const root = ret?.el || document;

    // preload org/facility
    import("../../utils/data-loaders.js").then(async ({ loadOrganizationsLite, loadFacilitiesLite, setupSelectOptions }) => {
      const orgSelect = $(root, "#transferOrgSelect");
      const facSelect = $(root, "#transferFacilitySelect");
      if (!orgSelect || !facSelect) return;

      const role = (localStorage.getItem("userRole") || "").toLowerCase();
      try {
        const orgs = await loadOrganizationsLite();

        if (role.includes("super")) {
          orgs.unshift({ id: "", name: "-- Select Organization --" });
          setupSelectOptions(orgSelect, orgs, "id", "name");

          let facs = await loadFacilitiesLite();
          facs.unshift({ id: "", name: "-- Select Facility --" });
          setupSelectOptions(facSelect, facs, "id", "name");

          orgSelect.addEventListener("change", async () => {
            const selectedOrgId = orgSelect.value;
            let next = selectedOrgId
              ? await loadFacilitiesLite({ organization_id: selectedOrgId })
              : await loadFacilitiesLite();
            next.unshift({ id: "", name: "-- Select Facility --" });
            setupSelectOptions(facSelect, next, "id", "name");
          });
        } else {
          const scopedOrgId = localStorage.getItem("organizationId");
          const scopedFacId = localStorage.getItem("facilityId");
          const scopedOrg = orgs.find((o) => String(o.id) === String(scopedOrgId));
          setupSelectOptions(orgSelect, scopedOrg ? [scopedOrg] : [], "id", "name");
          orgSelect.disabled = true;
          orgSelect.value = scopedOrgId || "";

          const facilities = scopedOrgId
            ? await loadFacilitiesLite({ organization_id: scopedOrgId })
            : [];
          setupSelectOptions(facSelect, facilities, "id", "name", "-- Select Facility --");
          if (scopedFacId) facSelect.value = scopedFacId;
        }
      } catch (err) {
        console.error("❌ preload org/facility failed:", err);
        showToast("❌ Failed to load organizations/facilities");
      }
    });

    const confirm = async () => {
      const orgId = $(root, "#transferOrgSelect")?.value?.trim() || "";
      const facilityId = $(root, "#transferFacilitySelect")?.value?.trim() || "";
      const reason = $(root, "#reasonInput")?.value?.trim() || "";

      if (!facilityId || !reason) return showToast("❌ Facility and reason required");

      try {
        showLoading();
        const res = await authFetch(`/api/newborn-records/${id}/transfer`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, transfer_facility_id: facilityId, organization_id: orgId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "❌ Failed to transfer newborn");

        showToast(`✅ Newborn transferred successfully`);
        ret?.close?.();
        closeAllModals(); // ✅ clean overlays
        window.latestNewbornRecordEntries = [];
        await loadEntries(currentPage);
      } catch (err) {
        console.error(err);
        showToast(err.message || "❌ Failed to transfer newborn");
      } finally {
        hideLoading();
      }
    };

    onOnce(root, "#confirmTransferBtn", "click", confirm);
    onOnce(root, "#reasonInput", "keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        confirm();
      }
    });
  }

  async function handleVoid(id) {
    const ret = showNewbornModal(
      "Void Record",
      `
      <p>Enter a reason for voiding this record:</p>
      <textarea id="reasonInput" class="form-control mb-3" rows="3" placeholder="Reason is required"></textarea>
      <div class="d-grid">
        <button id="confirmVoidBtn" class="btn btn-warning">Confirm</button>
      </div>
    `,
      "lg"
    );
    const root = ret?.el || document;

    const confirm = async () => {
      const reason = $(root, "#reasonInput")?.value?.trim() || "";
      if (!reason) return showToast("❌ Reason required");

      try {
        showLoading();
        const res = await authFetch(`/api/newborn-records/${id}/void`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "❌ Failed to void newborn record");

        showToast(`✅ Newborn record voided`);
        ret?.close?.();
        closeAllModals(); // ✅ clean overlays
        window.latestNewbornRecordEntries = [];
        await loadEntries(currentPage);
      } catch (err) {
        console.error(err);
        showToast(err.message || "❌ Failed to void newborn record");
      } finally {
        hideLoading();
      }
    };

    onOnce(root, "#confirmVoidBtn", "click", confirm);
    onOnce(root, "#reasonInput", "keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        confirm();
      }
    });
  }

  /* ---------------------- global helpers ---------------------- */

  window.editEntry = (id) => {
    const entry = (window.latestNewbornRecordEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );
    if (entry) handleEdit(entry);
    else showToast("❌ Newborn record not found for editing");
  };

  window.viewEntry = (id) => {
    const btn = document.querySelector(`.view-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ View button not found");
  };

  window.deleteEntry = (id) => {
    const btn = document.querySelector(`.delete-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Delete button not found");
  };

  window.markDeceasedEntry = (id) => {
    const btn = document.querySelector(`.deceased-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Deceased button not found");
  };

  window.transferEntry = (id) => {
    const btn = document.querySelector(`.transfer-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Transfer button not found");
  };

  window.voidEntry = (id) => {
    const btn = document.querySelector(`.void-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ Void button not found");
  };
}
