import React, { useState } from 'react';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import ConfirmDialog from '../components/ConfirmDialog';

const Dashboard = ({ tasks, loading, error, stats, onCreateTask, onUpdateTask, onDeleteTask }) => {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const handleNewClick = () => {
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (task) => {
    setSelectedTask(task);
    setIsConfirmOpen(true);
  };

  const handleSaveTask = async (taskData) => {
    if (selectedTask) {
      await onUpdateTask(selectedTask.id, taskData);
    } else {
      await onCreateTask(taskData);
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedTask) {
      await onDeleteTask(selectedTask.id);
    }
  };

  // Filter and search tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesFilter = filter === 'ALL' || task.status === filter;
    const matchesSearch =
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      (task.description || '').toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
        <p>Loading your tasks...</p>
      </div>
    );
  }

  return (
    <main className="main-content">
      {error && (
        <div style={{
          background: 'var(--color-danger-bg)',
          border: '1px solid var(--color-danger)',
          color: 'var(--color-danger)',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem',
        }}>
          Error: {error}
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-filters">
          <button
            className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
            id="filter-all-btn"
          >
            All Tasks
          </button>
          <button
            className={`filter-btn ${filter === 'PENDING' ? 'active' : ''}`}
            onClick={() => setFilter('PENDING')}
            id="filter-pending-btn"
          >
            Pending
          </button>
          <button
            className={`filter-btn ${filter === 'IN_PROGRESS' ? 'active' : ''}`}
            onClick={() => setFilter('IN_PROGRESS')}
            id="filter-inprogress-btn"
          >
            In Progress
          </button>
          <button
            className={`filter-btn ${filter === 'COMPLETED' ? 'active' : ''}`}
            onClick={() => setFilter('COMPLETED')}
            id="filter-completed-btn"
          >
            Completed
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '280px' }}
            id="task-search-input"
          />

          <button
            className="btn-primary"
            onClick={handleNewClick}
            id="create-task-btn"
          >
            <span>+</span> Add Task
          </button>
        </div>
      </div>

      <div className="task-grid">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              style={{ animationDelay: `${index * 0.05}s` }}
            />
          ))
        ) : (
          <div className="task-grid-empty">
            <div className="empty-icon">📁</div>
            <h3 className="empty-title">No tasks found</h3>
            <p className="empty-text">
              {search
                ? 'Try adjusting your search criteria.'
                : 'Get started by creating your very first task!'}
            </p>
          </div>
        )}
      </div>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        task={selectedTask}
      />

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Task"
        message={`Are you sure you want to delete "${selectedTask?.title}"? This action cannot be undone.`}
      />
    </main>
  );
};

export default Dashboard;
