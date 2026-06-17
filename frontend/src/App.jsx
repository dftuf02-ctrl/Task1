import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import useTasks from './hooks/useTasks';

const App = () => {
  const {
    tasks,
    loading,
    error,
    stats,
    createTask,
    updateTask,
    deleteTask,
  } = useTasks();

  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleCreateTask = async (taskData) => {
    try {
      await createTask(taskData);
      addToast('Task created successfully!');
    } catch (err) {
      addToast(err.message || 'Failed to create task', 'error');
      throw err;
    }
  };

  const handleUpdateTask = async (id, updates) => {
    try {
      await updateTask(id, updates);
      addToast('Task updated successfully!');
    } catch (err) {
      addToast(err.message || 'Failed to update task', 'error');
      throw err;
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await deleteTask(id);
      addToast('Task deleted successfully!');
    } catch (err) {
      addToast(err.message || 'Failed to delete task', 'error');
      throw err;
    }
  };

  return (
    <>
      <Header stats={stats} />
      <Dashboard
        tasks={tasks}
        loading={loading}
        error={error}
        stats={stats}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
      />

      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span>{toast.type === 'success' ? '✅' : '❌'}</span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </>
  );
};

export default App;
