import React, { useState } from 'react';

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message }) => {
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // Error handling done at caller level
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal confirm-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="modal-body">
          <div className="confirm-icon">⚠️</div>
          <h2 className="modal-title" style={{ marginBottom: '1rem', textAlign: 'center' }}>{title || 'Are you sure?'}</h2>
          <p className="confirm-message">{message || 'This action cannot be undone.'}</p>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'center', borderTop: 'none', paddingTop: 0 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
            id="cancel-confirm-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={submitting}
            id="confirm-action-btn"
          >
            {submitting ? <div className="spinner" style={{ borderTopColor: 'white' }}></div> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
