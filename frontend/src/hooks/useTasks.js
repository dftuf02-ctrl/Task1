import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Custom hook for task CRUD operations with loading/error state.
 */
const useTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [deletedTasks, setDeletedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getTasks();
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDeletedTasks = useCallback(async () => {
    try {
      const data = await api.getDeletedTasks();
      setDeletedTasks(data);
    } catch (err) {
      // Non-critical: the deletion log is supplementary, so don't
      // surface this as a blocking error for the whole dashboard.
      console.error('Failed to load deletion log:', err.message);
    }
  }, []);

  const createTask = useCallback(async (taskData) => {
    const data = await api.createTask(taskData);
    setTasks((prev) => [data, ...prev]);
    return data;
  }, []);

  const updateTask = useCallback(async (id, updates) => {
    const data = await api.updateTask(id, updates);
    setTasks((prev) => prev.map((t) => (t.id === id ? data : t)));
    return data;
  }, []);

  const deleteTask = useCallback(async (id) => {
    await api.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    // Refresh the deletion log so the home page reflects the new entry.
    fetchDeletedTasks();
  }, [fetchDeletedTasks]);

  useEffect(() => {
    fetchTasks();
    fetchDeletedTasks();
  }, [fetchTasks, fetchDeletedTasks]);

  // Derived stats
  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'PENDING').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    completed: tasks.filter((t) => t.status === 'COMPLETED').length,
  };

  return {
    tasks,
    deletedTasks,
    loading,
    error,
    stats,
    fetchTasks,
    fetchDeletedTasks,
    createTask,
    updateTask,
    deleteTask,
  };
};

export default useTasks;
