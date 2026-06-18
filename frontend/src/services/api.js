const API_BASE = '/api/v1';

// ── Token storage (localStorage) ──────────────────────────────
const ACCESS_KEY = 'tf_access_token';
const REFRESH_KEY = 'tf_refresh_token';

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: ({ accessToken, refreshToken }) => {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// Single-flight refresh: concurrent 401s share one refresh request.
let refreshPromise = null;

// The app (useAuth) registers a handler so that when the session genuinely
// ends, the UI can react (log the user out) instead of leaving them on a
// broken, falsely "logged-in" screen.
let onSessionExpired = null;
export const setOnSessionExpired = (fn) => {
  onSessionExpired = fn;
};

const endSession = (reason) => {
  tokenStore.clear();
  if (onSessionExpired) onSessionExpired(reason);
};

const doRefresh = async () => {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new Error('No refresh token');

  let response;
  try {
    response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Network blip — the refresh token may still be perfectly valid. Do NOT
    // clear tokens or end the session; surface a transient error so the
    // original request can fail softly and be retried later.
    const err = new Error('Network error during token refresh');
    err.isTransient = true;
    throw err;
  }

  const json = await response.json().catch(() => ({}));

  if (response.status === 401 || response.status === 403) {
    // Genuine auth failure: the refresh token is invalid/expired → end session.
    endSession(json.message || 'Session expired');
    const error = new Error(json.message || 'Session expired');
    error.status = response.status;
    error.sessionEnded = true;
    throw error;
  }

  if (!response.ok || !json.success) {
    // Server-side (5xx) failure — transient, not an auth decision. Keep tokens.
    const err = new Error(json.message || 'Token refresh failed');
    err.status = response.status;
    err.isTransient = true;
    throw err;
  }

  tokenStore.set({ accessToken: json.data.accessToken, refreshToken: json.data.refreshToken });
  return json.data.accessToken;
};

const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

/**
 * Generic fetch wrapper.
 * - Attaches the access token.
 * - On a 401 (expired access token) it transparently refreshes once
 *   and retries the original request.
 * All responses follow { success, data?, message?, errors? }.
 */
const request = async (endpoint, options = {}, { auth = true, _retry = false } = {}) => {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (auth) {
    const token = tokenStore.getAccess();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  // Attempt a one-time refresh-and-retry on auth failure.
  if (response.status === 401 && auth && !_retry && tokenStore.getRefresh()) {
    try {
      await refreshAccessToken();
      return request(endpoint, options, { auth, _retry: true });
    } catch (refreshErr) {
      // A genuine session end already cleared tokens + notified the app.
      // A transient (network/5xx) failure must NOT log the user out — fall
      // through and surface the original error so they can retry.
      if (refreshErr.sessionEnded) throw refreshErr;
    }
  }

  const json = await response.json().catch(() => ({}));

  if (!response.ok || !json.success) {
    const error = new Error(json.message || 'Request failed');
    error.errors = json.errors || [];
    error.status = response.status;
    throw error;
  }

  return json.data;
};

const api = {
  // ── Auth ────────────────────────────────────────────────────
  signup: (credentials) =>
    request('/auth/signup', { method: 'POST', body: JSON.stringify(credentials) }, { auth: false }),

  login: (credentials) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }, { auth: false }),

  logout: (refreshToken) =>
    request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }, { auth: false }),

  me: () => request('/auth/me'),

  // ── Tasks ───────────────────────────────────────────────────
  getTasks: () => request('/tasks'),

  getDeletedTasks: () => request('/tasks/deleted'),

  getTask: (id) => request(`/tasks/${id}`),

  createTask: (taskData) => request('/tasks', { method: 'POST', body: JSON.stringify(taskData) }),

  updateTask: (id, updates) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),

  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  getHealth: () => fetch('/health').then((r) => r.json()),
};

export default api;
