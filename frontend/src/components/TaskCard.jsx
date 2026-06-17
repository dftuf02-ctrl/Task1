import React from 'react';
import StatusBadge from './StatusBadge';

/**
 * Format a date string to a human-readable format.
 */
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Check if a due date is overdue.
 */
const isOverdue = (dueDate, status) => {
  if (!dueDate || status === 'COMPLETED') return false;
  return new Date(dueDate) < new Date();
};

const TaskCard = ({ task, onEdit, onDelete, style }) => {
  const overdue = isOverdue(task.due_date, task.status);

  return (
    <div className="task-card" data-status={task.status} style={style}>
      <div className="task-card-header">
        <h3 className="task-title">{task.title}</h3>
        <StatusBadge status={task.status} />
      </div>

      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      <div className="task-meta">
        <div className="task-date">
          {task.due_date ? (
            <>
              <span>📅</span>
              <span style={overdue ? { color: 'var(--color-danger)' } : undefined}>
                {formatDate(task.due_date)}
                {overdue && ' (Overdue)'}
              </span>
            </>
          ) : (
            <span style={{ opacity: 0.5 }}>No due date</span>
          )}
        </div>
        <div className="task-actions">
          <button
            className="btn-icon"
            onClick={() => onEdit(task)}
            title="Edit task"
            id={`edit-task-${task.id}`}
          >
            ✏️
          </button>
          <button
            className="btn-icon danger"
            onClick={() => onDelete(task)}
            title="Delete task"
            id={`delete-task-${task.id}`}
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
