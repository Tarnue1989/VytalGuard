/* ========================================================================
   Auth Utility Module (authSession.js)
   Handles login, logout, token storage, session retrieval, refresh, and idle timeout.
   ======================================================================== */
  import { applyRequestScope } from "./utils/requestScope.js";
// -------------------- Config --------------------
const ACCESS_TOKEN_KEY = "accessToken";
const USER_KEY = "userSession";
const REFRESH_ENDPOINT = "/api/auth/refresh";
const LOGOUT_ENDPOINT = "/api/auth/logout";
const LOGOUT_ALL_ENDPOINT = "/api/auth/logout-all";
const ME_ENDPOINT = "/api/auth/me";

// 🔒 PAGE GUARD (CRITICAL FIX)
const isLoginPage = window.location.pathname.includes("login");
const hasToken = !!localStorage.getItem("accessToken");

const REFRESH_BUFFER = 60; // 1 minute before expiration
let refreshTimer = null;
// -------------------- Restore Global Current User --------------------
try {
  const savedSession = localStorage.getItem("userSession");
  if (savedSession) {
    window.currentUser = JSON.parse(savedSession);
    console.log("✅ [authSession] Loaded currentUser from localStorage:", window.currentUser);
  } else {
    console.warn("⚠️ [authSession] No userSession found in localStorage.");
  }
} catch (err) {
  console.error("❌ [authSession] Failed to parse userSession:", err);
}

// -------------------- Idle Timeout --------------------
const IDLE_LIMIT = 15 * 60 * 1000;   // 15 minutes
const WARNING_TIME = 2 * 60 * 1000;  // 2 minutes warning

let idleTimer = null;
let warningTimer = null;
let isUserActive = false;

/* ================= SESSION MODAL (FIXED — HTML BASED) ================= */
function showSessionWarningModal(onStay) {
  const modal = document.getElementById("sessionTimeoutModal");
  if (!modal) {
    console.warn("⚠️ sessionTimeoutModal not found in HTML");
    return;
  }

  // ✅ SHOW modal
  modal.classList.remove("hidden");

  const btn = document.getElementById("stayLoggedInBtn");
  const countdownEl = document.getElementById("sessionCountdown");

  let seconds = Math.floor(WARNING_TIME / 1000);
  let interval = null;

  // ✅ Start countdown
  if (countdownEl) {
    countdownEl.textContent = seconds;

    interval = setInterval(() => {
      seconds--;

      countdownEl.textContent = seconds;

      if (seconds <= 0) {
        clearInterval(interval);
      }
    }, 1000);
  }

  // ✅ Stay Logged In button
  btn.onclick = async () => {
    // hide modal
    modal.classList.add("hidden");

    isUserActive = true;

    clearTimeout(idleTimer);
    clearTimeout(warningTimer);

    // stop countdown
    if (interval) clearInterval(interval);

    try {
      await onStay?.();
    } catch (e) {
      console.warn("⚠️ Refresh failed:", e);
    }

    broadcastActivity();

    setTimeout(() => {
      isUserActive = false;
    }, 2000);
  };

  return modal;
}
function broadcastActivity() {
  try {
    localStorage.setItem("lastActivity", Date.now().toString());
  } catch (e) {
    console.warn("Could not update lastActivity in localStorage:", e);
  }
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  clearTimeout(warningTimer);

  // 🔔 schedule warning (modal + countdown)
  warningTimer = setTimeout(() => {
    let seconds = Math.floor(WARNING_TIME / 1000);

    let interval = null;

    const modal = showSessionWarningModal(async () => {
      try {
        await refreshAccessToken();
      } catch (e) {
        console.warn("Refresh failed:", e);
      }

      // ✅ stop countdown when user stays
      if (interval) clearInterval(interval);

      broadcastActivity();
    });

    const countdownEl = document.getElementById("sessionCountdown");

    interval = setInterval(() => {
      seconds--;

      if (countdownEl) {
        countdownEl.textContent = seconds;
      }

      if (seconds <= 0) {
        clearInterval(interval);
      }
    }, 1000);

  }, IDLE_LIMIT - WARNING_TIME);

  // ⏳ schedule actual logout
  idleTimer = setTimeout(() => {
    if (isLoginPage || !hasToken) return;
    if (isUserActive) {
      console.log("✅ User stayed active — skip logout");
      return;
    }

    console.warn("⏳ Idle timeout reached. Logging out.");
    logout();
  }, IDLE_LIMIT);
}

// Listen for user activity in this tab
let lastActivityUpdate = 0;
const ACTIVITY_THROTTLE = 3000; // 3 seconds

if (!isLoginPage && hasToken) {
  ["mousemove", "keydown", "click", "scroll"].forEach(event => {
    window.addEventListener(event, () => {
      const now = Date.now();

      if (now - lastActivityUpdate < ACTIVITY_THROTTLE) return;

      lastActivityUpdate = now;

      broadcastActivity();
      resetIdleTimer();
    });
  });
}

// Listen for activity from *other* tabs
let lastStorageUpdate = 0;

if (!isLoginPage && hasToken) {
  window.addEventListener("storage", (e) => {
    if (e.key !== "lastActivity") return;

    const now = Date.now();

    if (now - lastStorageUpdate < 3000) return;

    lastStorageUpdate = now;

    resetIdleTimer();
  });
}

// -------------------- Storage Helpers --------------------
function setSession({ accessToken, user }) {
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);

  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    // 🔑 Store full name for receipts (include middle name if present)
    const fullName = [user.first_name, user.middle_name, user.last_name]
      .filter(Boolean)
      .join(" ");
    if (fullName) {
      localStorage.setItem("userName", fullName.trim());
    }

    // 🔑 Always prefer normalized role → ensures no spaces
    let roleFromUser =
      user.roles?.[0]?.normalized ||           // ✅ clean from backend
      user.role ||                             // fallback
      user.roles?.[0]?.name ||                 // fallback (e.g. "Super Admin")
      user.facilityLinks?.[0]?.role?.name ||   // fallback
      "";

    if (roleFromUser) {
      roleFromUser = String(roleFromUser).toLowerCase().replace(/\s+/g, "");
      localStorage.setItem("userRole", roleFromUser);
    }

    // 🔑 Save all roles (from facilityLinks)
    if (Array.isArray(user.facilityLinks)) {
      const roleNames = user.facilityLinks
        .map(f => f.role?.name)
        .filter(Boolean)
        .map(r => r.toLowerCase().replace(/\s+/g, ""));
      localStorage.setItem("roleNames", JSON.stringify(roleNames));
    }

    // 🔑 Save org + facilities for scoping
    if (user.organization_id) {
      localStorage.setItem("organizationId", user.organization_id);
    }

    // ✅ Preferred: facility_ids from login payload
    if (Array.isArray(user.facility_ids) && user.facility_ids.length) {
      localStorage.setItem("facilityIds", JSON.stringify(user.facility_ids));
      localStorage.setItem("facilityId", user.facility_ids[0]);

      // 🔥 THIS WAS MISSING
      localStorage.setItem("activeFacilityId", user.facility_ids[0]);
    }

    // 🔁 Fallback: legacy facilityLinks
    else if (Array.isArray(user.facilityLinks)) {
      const facilities = user.facilityLinks
        .map(f => f.facility_id)
        .filter(Boolean);

      if (facilities.length) {
        localStorage.setItem("facilityIds", JSON.stringify(facilities));
        localStorage.setItem("facilityId", facilities[0]);

        // 🔥 ALSO SET HERE
        localStorage.setItem("activeFacilityId", facilities[0]);
      }
    }



    // 🔑 Persist permissions if provided
    if (user.permissions) {
      localStorage.setItem("permissions", JSON.stringify(user.permissions));
    }
  }

  // 🛠️ Debug log of everything in storage after set
  console.log("💾 [setSession] Storage snapshot:", {
    accessToken: accessToken ? accessToken.substring(0, 12) + "...(hidden)" : null,
    user: user || null,
    userRole: localStorage.getItem("userRole"),
    roleNames: JSON.parse(localStorage.getItem("roleNames") || "[]"),
    organizationId: localStorage.getItem("organizationId"),
    facilityId: localStorage.getItem("facilityId"),
    facilityIds: JSON.parse(localStorage.getItem("facilityIds") || "[]"),
    permissions: JSON.parse(localStorage.getItem("permissions") || "[]"),
    userName: localStorage.getItem("userName"),
  });

  scheduleAutoRefresh(accessToken);
  resetIdleTimer(); // start/reset idle timer whenever session is set
}

function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("userRole");
  localStorage.removeItem("roleNames");
  localStorage.removeItem("organizationId");
  localStorage.removeItem("facilityId");
  localStorage.removeItem("facilityIds"); // 🧹 clear multi-facility info
  localStorage.removeItem("activeFacilityId");
  localStorage.removeItem("permissions");
  localStorage.removeItem("userName");    // 🧹 clear printed-by name

  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function getFacilityIds() {
  const stored = localStorage.getItem("facilityIds");
  if (stored) return JSON.parse(stored);
  return Array.isArray(getUser()?.facilityLinks)
    ? getUser().facilityLinks.map(f => f.facility_id).filter(Boolean)
    : [];
}

function getRoleNames() {
  const stored = localStorage.getItem("roleNames");
  if (stored) return JSON.parse(stored);
  return Array.isArray(getUser()?.facilityLinks)
    ? getUser().facilityLinks.map(f => f.role?.name).filter(Boolean)
    : [];
}



function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getUser() {
  const stored = localStorage.getItem(USER_KEY);
  return stored ? JSON.parse(stored) : null;
}

// -------------------- Token Expiry Helpers --------------------
function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function getTokenExpiry(token) {
  const payload = parseJwt(token);
  return payload?.exp ? payload.exp * 1000 : null; // Convert to ms
}

// -------------------- Auto Refresh Logic --------------------
function scheduleAutoRefresh(token) {
  if (!token) return;
  const expiry = getTokenExpiry(token);
  if (!expiry) return;

  const now = Date.now();
  const refreshAt = expiry - REFRESH_BUFFER * 1000;

  if (refreshAt > now) {
    const delay = refreshAt - now;
    refreshTimer = setTimeout(refreshAccessToken, delay);
  }
}

async function refreshAccessToken() {
  try {
    const res = await fetch(REFRESH_ENDPOINT, {
      method: "POST",
      credentials: "include", // ✅ send refresh cookie
    });

    if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);

    const data = await res.json();
    if (data?.accessToken) {
      setSession({
        accessToken: data.accessToken,
        user: data.user || getUser(),
      });
    } else {
      throw new Error("No access token in refresh response");
    }
  } catch (err) {
    console.error("Token refresh error:", err);
    clearSession();
    if (!window.location.pathname.includes("login")) {
      window.location.href = "/login.html";
    }
  }
}

// -------------------- Public Methods --------------------
async function login(credentials) {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
      credentials: "include",
    });

    if (!res.ok) {
      const contentType = res.headers.get("content-type") || "";
      let message = "Login failed";

      if (contentType.includes("application/json")) {
        const errorData = await res.json();
        message = errorData.error || errorData.message || message;
      } else {
        message = await res.text();
      }

      const err = new Error(message);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    setSession({
      accessToken: data.accessToken,
      user: data.user,
    });

    window.location.href = "/dashboard.html";
    return data;

  } catch (err) {
    console.error("❌ Login error:", err.message);
    throw err;
  }
}

async function logout() {
  try {
    await fetch(LOGOUT_ENDPOINT, {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error("Logout API call failed:", err);
  } finally {
    clearSession();

    // 🔒 prevent login refresh loop
    if (!window.location.pathname.includes("login")) {
      window.location.href = "/login.html";
    }
  }
}

async function logoutAll() {
  try {
    await fetch(LOGOUT_ALL_ENDPOINT, {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error("LogoutAll API call failed:", err);
  } finally {
    clearSession();
    if (!window.location.pathname.includes("login")) {
      window.location.href = "/login.html";
    }
  }
}

// ✅ Restore session from storage/cookie
async function restoreSession() {
  let token = getAccessToken();
  let user  = getUser();

  // ------------------------------------------------------------
  // Helper: load user from /me with a given token
  // ------------------------------------------------------------
  async function fetchUserWith(tokenToUse) {
    try {
      const res = await fetch(ME_ENDPOINT, {
        method: "GET",
        credentials: "include",
        headers: { Authorization: `Bearer ${tokenToUse}` },
      });

      if (res.ok) {
        const fetched = await res.json();
        console.log("📥 [restoreSession] /me response:", fetched);

        // ✅ Persist permissions if returned
        if (fetched?.permissions) {
          localStorage.setItem("permissions", JSON.stringify(fetched.permissions));
        } else if (fetched?.data?.permissions) {
          localStorage.setItem("permissions", JSON.stringify(fetched.data.permissions));
        }

        // ✅ Normalize role
        const role =
          fetched?.roles?.[0]?.normalized ||
          fetched?.roles?.[0]?.name ||
          fetched?.role ||
          "";

        if (role) {
          localStorage.setItem("userRole", role.toLowerCase().trim());
        }

        return fetched;
      }

      console.warn("⚠️ Failed to restore user session from /me");
    } catch (err) {
      console.error("❌ Restore session error:", err);
    }
    return null;
  }

  // ------------------------------------------------------------
  // Helper: finalize + rehydrate runtime session state
  // ------------------------------------------------------------
  function finalizeSession(activeToken, activeUser) {
    // Persist base session (token, user, org, facilityIds, etc.)
    setSession({ accessToken: activeToken, user: activeUser });

    // 🔥 CRITICAL FIX:
    // Rehydrate activeFacilityId after reload / refresh
    const facilities =
      activeUser?.facility_ids ||
      activeUser?.facilityLinks?.map(f => f.facility_id).filter(Boolean) ||
      [];

    if (facilities.length) {
      localStorage.setItem("activeFacilityId", facilities[0]);
    }

    console.log("🧠 [restoreSession] activeFacilityId =", 
      localStorage.getItem("activeFacilityId")
    );

    // 🛠️ Debug snapshot
    console.log("💾 [restoreSession] Final session snapshot:", {
      token: activeToken ? activeToken.substring(0, 12) + "...(hidden)" : null,
      user: activeUser,
      storedRole: localStorage.getItem("userRole"),
      storedOrg: localStorage.getItem("organizationId"),
      storedFacilityId: localStorage.getItem("facilityId"),
      storedActiveFacilityId: localStorage.getItem("activeFacilityId"),
      storedFacilities: JSON.parse(localStorage.getItem("facilityIds") || "[]"),
      storedPermissions: JSON.parse(localStorage.getItem("permissions") || "[]"),
    });

    scheduleAutoRefresh(activeToken);
    resetIdleTimer();
    return true;
  }

  // ------------------------------------------------------------
  // No token → no session
  // ------------------------------------------------------------
  if (!token) return false;

  const expiry = getTokenExpiry(token);

  // ------------------------------------------------------------
  // 🔹 Token still valid
  // ------------------------------------------------------------
  if (expiry && expiry > Date.now()) {
    if (!user) {
      const fetchedUser = await fetchUserWith(token);
      if (fetchedUser) user = fetchedUser;
    }

    if (!user) return false; // fail closed
    return finalizeSession(token, user);
  }

  // ------------------------------------------------------------
  // 🔄 Token expired → attempt refresh
  // ------------------------------------------------------------
  try {
    const r = await fetch(REFRESH_ENDPOINT, {
      method: "POST",
      credentials: "include",
    });

    if (r.ok) {
      const data = await r.json();
      token = data.accessToken || token;

      console.log("🔄 [restoreSession] Refresh response:", data);

      let activeUser = data.user || user;
      if (!activeUser) {
        const fetchedUser = await fetchUserWith(token);
        if (fetchedUser) activeUser = fetchedUser;
      }

      if (!activeUser) return false;
      return finalizeSession(token, activeUser);
    }
  } catch (e) {
    console.error("❌ Token refresh failed:", e);
  }

  // ------------------------------------------------------------
  // ❌ Could not restore session
  // ------------------------------------------------------------
  return false;
}


// -------------------- Auth Fetch Wrapper (Final – Ledger-Aware, FormData Safe) --------------------
const DEBUG_AUTH_FETCH = true;

// 🔑 Ledger-based source-of-truth keys
const LEDGER_SOURCE_KEYS = [
  "payment_id",
  "deposit_id",
  "invoice_id",
  "ledger_id",
  "transaction_id",
];

async function authFetch(url, options = {}) {
  const token = getAccessToken();
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  const makeRequest = async (bearer) => {
    const headers = {
      ...(options.headers || {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    };

    const isFormData = options.body instanceof FormData;

    // ✅ Skip Content-Type for FormData (browser sets boundary)
    if (!isFormData) {
      headers["Content-Type"] =
        options.headers?.["Content-Type"] || "application/json";
    }

    let finalOptions = {
      ...options,
      headers,
      credentials: "include",
    };

    /* ============================================================
      🔐 TENANT SCOPING (LEDGER-FIRST, MASTER RULE — FIXED)
    ============================================================ */
    if (!isFormData && finalOptions.body) {
      try {
        const parsed =
          typeof finalOptions.body === "string"
            ? JSON.parse(finalOptions.body)
            : finalOptions.body;

        let scoped = { ...parsed };

        // 🔍 Detect ledger-derived request
        const isLedgerDerived = LEDGER_SOURCE_KEYS.some(
          (key) => scoped[key]
        );

        if (isLedgerDerived) {
          // 🔒 Ledger = source of truth → strip ALL tenant fields
          delete scoped.organization_id;
          delete scoped.facility_id;
          delete scoped.patient_id;

        } else if (userRole === "superadmin") {
          // 🧭 Super Admin → full control
          scoped = applyRequestScope(scoped);

        } else if (userRole === "orgadmin" || userRole.includes("org")) {
          // ✅ ORG ADMIN → allow facility_id, block org override
          delete scoped.organization_id;
          // keep facility_id

        } else {
          // 🚫 Facility users / staff → no tenant override
          delete scoped.organization_id;
          delete scoped.facility_id;
        }

        finalOptions.body = JSON.stringify(scoped);

        if (DEBUG_AUTH_FETCH) {
          console.log("🔎 [authFetch] Final Payload →", {
            url,
            isLedgerDerived,
            scoped,
          });
        }
      } catch (e) {
        console.warn("⚠️ [authFetch] Could not process JSON payload", e);
      }
    }
    /* ============================================================
       🧩 FORMDATA DEBUG (SAFE)
    ============================================================ */
    if (isFormData && DEBUG_AUTH_FETCH) {
      console.groupCollapsed("📦 [authFetch] Sending FormData →", url);
      for (const [key, val] of finalOptions.body.entries()) {
        console.log(
          key,
          val instanceof File ? `[File: ${val.name}]` : val
        );
      }
      console.groupEnd();
    }

    return fetch(url, finalOptions);
  };

  return makeRequest(token);
}



// -------------------- Convenience Helpers --------------------
function getOrganizationId() {
  return getUser()?.organization_id || null;
}

function getOrganizationCode() {
  return getUser()?.organization_code || "";
}


// -------------------- Exports --------------------
export {
  setSession,
  clearSession,
  getAccessToken,
  getUser,
  login,
  logout,
  logoutAll,
  restoreSession,
  authFetch,
  getOrganizationId, 
  getOrganizationCode, 
  getFacilityIds,       
  getRoleNames,        
};
