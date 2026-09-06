/**
 * Apex Innovators — auth.js
 * Token + user persistence (localStorage ai_token / ai_refresh / ai_user),
 * login / register / logout, and the admin role guard.
 */

import { apiFetch, TOKEN_KEY, REFRESH_KEY, USER_KEY, redirectToLogin, ApiError } from "./api.js";
import { demoActive } from "./demo-data.js";

export { TOKEN_KEY, REFRESH_KEY, USER_KEY };

/** Current stored user object (sync read) or null. */
export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user && user.id ? user : null;
  } catch (err) {
    return null;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function isAuthenticated() {
  return Boolean(getToken() && getUser());
}

/** Persist an AuthResponse-ish payload: { token, refreshToken, user }. */
export function saveSession({ token, refreshToken, user }) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function login(email, password) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  saveSession(data);
  return data.user;
}

export async function register(name, email, password) {
  const data = await apiFetch("/auth/register", {
    method: "POST",
    body: { name, email, password },
  });
  saveSession(data);
  return data.user;
}

export async function logout() {
  clearSession();
  if (window.location.pathname.includes("/admin/")) {
    window.location.assign("../index.html");
  } else {
    window.location.assign(window.location.pathname);
  }
}

/** Home path depending on whether we are under /admin/. */
export function homePath() { return "https://sky-ydv2008.github.io/Team.Apex/"; }

/** Login path depending on whether we are under /admin/. */
export function loginPath() {
  return "https://sky-ydv2008.github.io/Team.Apex/login.html";
}

/**
 * Admin guard for pages under /admin/. Verifies the Bearer session via
 * /api/auth/me and that role === 'ADMIN'.
 * - 401 / Not Admin → clears session and redirects to login.html.
 * @returns {Promise<object|null>} the admin user, or null if redirected.
 */
export async function guardAdmin() {
  if (!getToken()) {
    redirectToLogin(window.location.href);
    return null;
  }
  let user = null;
  try {
    user = await apiFetch("/auth/me", { auth: true });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    user = getUser();
  }

  if (!user || user.role !== "ADMIN") {
    redirectToLogin(window.location.href);
    return null;
  }
  return user;
}

export async function guardModerator() {
  if (!getToken()) {
    redirectToLogin(window.location.href);
    return null;
  }
  let user = null;
  try {
    user = await apiFetch("/auth/me", { auth: true });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    user = getUser();
  }

  if (!user || (user.role !== "ADMIN" && user.role !== "CORE_MEMBER")) {
    redirectToLogin(window.location.href);
    return null;
  }
  if (typeof window !== "undefined") window.__GUARD_MODERATOR_USER = user;
  return user;
}
/**
 * Member guard for community-style actions. Returns the user or null and,
 * when not authenticated, redirects to login.html keeping a `next` target.
 */
export async function requireLogin() {
  if (!getToken()) {
    redirectToLogin(window.location.pathname.replace(/^\//, ""));
    return null;
  }
  if (cached) return cached;
  try {
    const user = await apiFetch("/auth/me", { auth: true });
    return user;
  } catch (err) {
    return null; // apiFetch redirected on 401
  }
}

/** Attach spotlight glow tracking, input glow border hover, and shimmer button wave to auth pages. */
export function setupAuthAnimations() {
  if (typeof document === "undefined") return;

  // 1. Mouse Spotlight tracking for .spotlight-card
  document.querySelectorAll(".spotlight-card").forEach((card) => {
    let glow = card.querySelector(".spotlight-glow");
    if (!glow) {
      glow = document.createElement("div");
      glow.className = "spotlight-glow";
      card.appendChild(glow);
    }
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      glow.style.transform = `translate(${x - 225}px, ${y - 225}px)`;
    });
  });

  // 2. Input border glow tracking for .input-glow-wrapper
  document.querySelectorAll(".input-glow-wrapper").forEach((wrapper) => {
    let topBorder = wrapper.querySelector(".glow-border-top");
    let botBorder = wrapper.querySelector(".glow-border-bottom");
    if (!topBorder) {
      topBorder = document.createElement("div");
      topBorder.className = "glow-border-top";
      wrapper.appendChild(topBorder);
    }
    if (!botBorder) {
      botBorder = document.createElement("div");
      botBorder.className = "glow-border-bottom";
      wrapper.appendChild(botBorder);
    }

    wrapper.addEventListener("mousemove", (e) => {
      const rect = wrapper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      topBorder.style.background = `radial-gradient(40px circle at ${x}px 0px, #22d3ee 0%, transparent 75%)`;
      botBorder.style.background = `radial-gradient(40px circle at ${x}px 2px, #22d3ee 0%, transparent 75%)`;
    });
  });

  // 3. Shimmer wave on submit buttons (.btn-shimmer)
  document.querySelectorAll(".btn-shimmer").forEach((btn) => {
    if (!btn.querySelector(".shimmer-wave")) {
      const wave = document.createElement("div");
      wave.className = "shimmer-wave";
      btn.appendChild(wave);
    }
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupAuthAnimations);
  } else {
    setupAuthAnimations();
  }
}
