const API_BASE = '/api/v1';

/**
 * Generic fetch wrapper with error handling.
 * All responses follow { success, data?, message?, errors? } format.
 */
const request = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);
  const json = await response.json();

  if (!response.ok || !json.success) {
    const error = new Error(json.message || 'Request failed');
    error.errors = json.errors || [];
    error.status = response.status;
    throw error;
  }

  return json.data;
};

const api = {
  /**
   * Fetch all tasks.
   * @returns {Promise<Array>}
   */
  getTasks: () => request('/tasks'),

  /**
   * Fetch a single task by ID.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  getTask: (id) => request(`/tasks/${id}`),

  /**
   * Create a new task.
   * @param {Object} taskData - { title, description?, due_date?, status? }
   * @returns {Promise<Object>}
   */
  createTask: (taskData) =>
    request('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    }),

  /**
   * Update an existing task.
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  updateTask: (id, updates) =>
    request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  /**
   * Delete a task.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  deleteTask: (id) =>
    request(`/tasks/${id}`, {
      method: 'DELETE',
    }),

  /**
   * Check API health.
   * @returns {Promise<Object>}
   */
  getHealth: () => fetch('/health').then((r) => r.json()),
};

export default api;
