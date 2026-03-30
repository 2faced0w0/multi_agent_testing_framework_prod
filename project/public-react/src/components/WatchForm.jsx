import { useState } from 'react';
import { fetchJson } from '../utils/api';

function WatchForm({ onSuccess }) {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setSubmitting(true);
    try {
      await fetchJson('/api/v1/gui/watchers', {
        method: 'POST',
        body: JSON.stringify({ repoUrl: repoUrl.trim(), branch: branch.trim() }),
      });
      setRepoUrl('');
      setBranch('');
      if (onSuccess) onSuccess();
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card">
      <h2>Watch a GitHub Repository</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="https://github.com/owner/repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          disabled={submitting}
        />
        <input
          type="text"
          placeholder="branch (default: main)"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          disabled={submitting}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Adding...' : 'Add & Queue Analysis'}
        </button>
      </form>
      <p className="hint">We only accept public GitHub URLs. Set ALLOWED_REPOS for stricter control.</p>
    </section>
  );
}

export default WatchForm;
