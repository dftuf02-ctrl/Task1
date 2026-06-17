import React from 'react';

const Header = ({ stats }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-brand">
          <div className="header-logo">T</div>
          <h1 className="header-title">TaskFlow</h1>
        </div>
        <div className="header-stats">
          <div className="stat-item">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: 'var(--color-pending)' }}>
              {stats.pending}
            </div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: 'var(--color-in-progress)' }}>
              {stats.inProgress}
            </div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: 'var(--color-completed)' }}>
              {stats.completed}
            </div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
