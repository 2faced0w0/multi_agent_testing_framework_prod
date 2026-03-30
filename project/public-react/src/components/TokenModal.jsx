import { useState } from 'react';
import { setToken } from '../utils/api';

function TokenModal({ onClose, onSuccess }) {
  const [tokenValue, setTokenValue] = useState('');
  const [status, setStatus] = useState('');

  const handleSave = () => {
    const val = tokenValue.trim();
    if (!val) {
      setStatus('Token required.');
      return;
    }

    try {
      setToken(val);
      setStatus('Saved. Retrying…');
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 400);
    } catch (e) {
      setStatus('Store failed: ' + e.message);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-body">
        <h3>Authentication Required</h3>
        <p className="modal-text">
          Repeated 401 responses detected. Provide a JWT (payload with <code>roles:['admin']</code>) or disable GUI
          auth for development (<code>GUI_AUTH_ENABLED=false</code>).
        </p>
        <textarea
          className="token-input"
          placeholder="Paste Bearer token here"
          value={tokenValue}
          onChange={(e) => setTokenValue(e.target.value)}
        />
        <div className="modal-actions">
          <button onClick={handleCancel} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            Save Token
          </button>
        </div>
        {status && <div className="hint token-status">{status}</div>}
      </div>
    </div>
  );
}

export default TokenModal;
