/* ========================================================================
   Auth Utility Module (auth.js)
   Handles login, logout, token storage, session retrieval, and refresh.
   ======================================================================== */

// -------------------- Config --------------------
const ACCESS_TOKEN_KEY = "accessToken";
const USER_KEY = "userSession";

// -------------------- Storage Helpers --------------------
function setSession({ accessToken, user }) {
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getUser() {
  const stored = localStorage.getItem(USER_KEY);
  return stored ? JSON.parse(stored) : null;
}

// -------------------- Convenience Helpers --------------------
function getOrganizationId() {
  return getUser()?.organization_id || null;
}

function getOrganizationCode() {
  return getUser()?.organization_code || "";
}

function getFacilityIds() {
  return Array.isArray(getUser()?.facilityLinks)
    ? getUser().facilityLinks.map(f => f.facility_id).filter(Boolean)
    : [];
}

function getRoleNames() {
  return Array.isArray(getUser()?.facilityLinks)
    ? getUser().facilityLinks
        .map(f => f.role?.name)
        .filter(Boolean)
    : [];
}

// -------------------- API Requests --------------------
async function login(credentials) {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
      credentials: "include", // ✅ send/receive cookies
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || errorData.message || "Login failed");
    }

    const data = await res.json();

    // ✅ Store both token and user object
    setSession({ accessToken: data.accessToken, user: data.user });

    return data;
  } catch (err) {
    console.error("❌ Login error:", err.message);
    throw err;
  }
}

async function logout(redirect = true) {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include", // ✅ ensures refresh cookie cleared server-side
    });
  } catch (err) {
    console.warn("⚠️ Logout request failed:", err.message);
  } finally {
    clearSession();
    if (redirect) window.location.href = "/login.html";
  }
}

async function refreshToken() {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include", // ✅ cookie auto-sent
    });

    if (!res.ok) throw new Error("Token refresh failed");

    const data = await res.json();

    // ✅ Refresh both token and user
    setSession({ accessToken: data.accessToken, user: data.user });

    return data.accessToken;
  } catch (err) {
    console.error("❌ Refresh token error:", err.message);
    logout();
  }
}

async function getMe() {
  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      credentials: "include",
    });
    if (!res.ok) throw new Error("Session check failed");

    const user = await res.json();

    // ✅ Sync user with session
    setSession({ accessToken: getAccessToken(), user });

    return user;
  } catch (err) {
    console.error("❌ Session retrieval error:", err.message);
    logout();
  }
}

// -------------------- Session Checks --------------------
function isLoggedIn() {
  return !!getAccessToken();
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = "/login.html";
  }
}

// -------------------- Export --------------------
export {
  login,
  logout,
  refreshToken,
  getAccessToken,
  getUser,
  getMe,
  isLoggedIn,
  requireAuth,
  setSession,
  clearSession,
  getOrganizationId,
  getOrganizationCode,
  getFacilityIds,
  getRoleNames,
};
