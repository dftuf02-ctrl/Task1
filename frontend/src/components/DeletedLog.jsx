import React, { useState } from 'react';
import StatusBadge from './StatusBadge';

/**
 * Formats an ISO timestamp into a short "time ago" string.
 */
const timeAgo = (isoString) => {
  if (!isoString) return '';
  const then = new Date(isoString).getTime();
  const seconds = Math.floor((Date.now() - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
};

/**
 * Collapsible "Recently Deleted" panel showing the deletion activity log.
 */
const DeletedLog = ({ deletedTasks = [] }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="deleted-log" id="deleted-log">
      <button
        className="deleted-log-header"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        id="deleted-log-toggle"
      >
        <span className="deleted-log-title">
          🗑️ Recently Deleted
          <span className="deleted-log-count">{deletedTasks.length}</span>
        </span>
        <span className={`deleted-log-chevron ${isOpen ? 'open' : ''}`}>▾</span>
      </button>

      {isOpen && (
        <div className="deleted-log-body">
          {deletedTasks.length === 0 ? (
            <p className="deleted-log-empty">No tasks have been deleted yet.</p>
          ) : (
            <ul className="deleted-log-list">
              {deletedTasks.map((entry) => (
                <li key={entry.id} className="deleted-log-item">
                  <div className="deleted-log-item-main">
                    <span className="deleted-log-item-title">{entry.title}</span>
                    <StatusBadge status={entry.status} />
                  </div>
                  <span className="deleted-log-item-time">
                    {timeAgo(entry.deleted_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

export default DeletedLog;
