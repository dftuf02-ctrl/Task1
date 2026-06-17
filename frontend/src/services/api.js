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

const doRefresh = async () => {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new Error('No refresh token');

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const json = await response.json();

  if (!response.ok || !json.success) {
    tokenStore.clear();
    const error = new Error(json.message || 'Session expired');
    error.status = response.status;
    throw error;
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
    } catch {
      // fall through to throw the original 401 below
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
