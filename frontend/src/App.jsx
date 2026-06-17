import React, { useState } from 'react';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import AuthPage from './pages/AuthPage';
import useTasks from './hooks/useTasks';
import useAuth from './hooks/useAuth';

/**
 * The authenticated experience — task dashboard. Mounted only once a
 * user is logged in, so useTasks (which fetches on mount) never runs
 * for anonymous visitors.
 */
const AuthenticatedApp = ({ user, onLogout }) => {
  const {
    tasks,
    deletedTasks,
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
      <Header stats={stats} user={user} onLogout={onLogout} />
      <Dashboard
        tasks={tasks}
        deletedTasks={deletedTasks}
        loading={loading}
        error={error}
        stats={stats}
        isAdmin={user.role === 'ADMIN'}
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

const App = () => {
  const { user, initializing, login, signup, logout } = useAuth();

  if (initializing) {
    return (
      <div className="loading-container">
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLogin={login} onSignup={signup} />;
  }

  return <AuthenticatedApp user={user} onLogout={logout} />;
};

export default App;
