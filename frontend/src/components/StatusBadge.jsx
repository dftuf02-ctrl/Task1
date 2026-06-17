import React from 'react';

const STATUS_MAP = {
  PENDING: { label: 'Pending', className: 'pending' },
  IN_PROGRESS: { label: 'In Progress', className: 'in-progress' },
  COMPLETED: { label: 'Completed', className: 'completed' },
};

const StatusBadge = ({ status }) => {
  const config = STATUS_MAP[status] || STATUS_MAP.PENDING;

  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;
