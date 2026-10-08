import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const AuthPanel: React.FC = () => {
  const { configured, user, loading, signInWithMagicLink, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!configured) return null;
  if (loading) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await signInWithMagicLink(email);
      setMessage('Check your email for a sign-in link.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send sign-in link.');
    }
  };

  return (
    <div style={{ position: 'fixed', top: 14, right: 14, zIndex: 1100, fontFamily: 'system-ui, sans-serif' }}>
      {user ? (
        <button type="button" onClick={() => void signOut()} style={{ padding: '8px 12px', border: '1px solid #888', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
          Sign out
        </button>
      ) : open ? (
        <form onSubmit={submit} style={{ display: 'grid', gap: 8, width: 250, padding: 12, background: '#fff', border: '1px solid #bbb', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,.15)' }}>
          <label htmlFor="auth-email" style={{ fontSize: 13 }}>Email to sign in</label>
          <input id="auth-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required autoFocus style={{ padding: 8 }} />
          <button type="submit" style={{ padding: 8, cursor: 'pointer' }}>Send magic link</button>
          <button type="button" onClick={() => setOpen(false)} style={{ padding: 6, border: 0, background: 'transparent', cursor: 'pointer' }}>Cancel</button>
          {message && <small role="status">{message}</small>}
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} style={{ padding: '8px 12px', border: '1px solid #888', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
          Sign in
        </button>
      )}
    </div>
  );
};

export default AuthPanel;
