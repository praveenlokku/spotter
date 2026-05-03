import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';

type Stage = 'creds' | 'otp';

const Signup = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('creds');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [digits, setDigits] = useState(['','','','','','']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const refs = useRef<(HTMLInputElement|null)[]>([]);

  useEffect(() => { if (stage === 'otp') refs.current[0]?.focus(); }, [stage]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError(''); setLoading(true);
    try {
      const r = await api.post('/api/users/signup/', { username, email, password });
      login(r.data.access, r.data.refresh, r.data.user);
      navigate('/planner');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Signup failed.');
    } finally { setLoading(false); }
  };

  const onDigit = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const d = [...digits]; d[i] = v; setDigits(d);
    if (v && i < 5) refs.current[i+1]?.focus();
  };
  const onKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i-1]?.focus();
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const p = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
    if (p.length === 6) { setDigits(p.split('')); refs.current[5]?.focus(); }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < 6) { setError('Enter all 6 digits.'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/api/users/verify-otp/', { email, code, purpose: 'signup' });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid code.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page" style={{ minHeight: '100vh' }}>
      <div className="auth-brand" style={{ display: 'flex' }}>
        <div className="auth-brand-content">
          <div className="auth-brand-logo">⚡ Spotter ELD</div>
          <h2 className="auth-brand-title">Start planning<br />in minutes.</h2>
          <p className="auth-brand-desc">
            Create your free account and plan your first HOS-compliant trip in under 30 seconds.
            No credit card required.
          </p>
          <div style={{
            background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.18)',
            borderRadius: '12px', padding: '1.25rem', marginTop: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: '0.6rem'
          }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--amber)' }}>HOS Rules applied automatically</p>
            {[
              '11-hr driving limit per shift',
              '14-hr on-duty window per shift',
              '30-min break after 8 hrs driving',
              '10-hr sleeper berth rest required',
              '70 hrs / 8-day cycle limit tracked',
              'Fuel stop every ≤ 1,000 miles',
            ].map(r => (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--t2)' }}>
                <span style={{ color: 'var(--success)', fontSize: '0.7rem' }}>✓</span> {r}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-box fade-up">
          <p style={{ fontSize: '0.78rem', color: 'var(--t3)', marginBottom: '0.5rem' }}>GET STARTED FREE</p>
          <h1 className="auth-form-title">Create your account</h1>
          <p className="auth-form-sub">
            {stage === 'creds' ? "We'll send a verification code to your email." : `Enter the code sent to ${email}`}
          </p>

          {error && <div className="alert alert-error mb-2">⚠ {error}</div>}
          {info && !error && <div className="alert alert-info mb-2">✉ {info}</div>}

          {stage === 'creds' ? (
            <form className="auth-form-body" onSubmit={handleSignup}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input id="signup-username" className="form-input" type="text"
                  placeholder="johndoe" value={username}
                  onChange={e => setUsername(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input id="signup-email" className="form-input" type="email"
                  placeholder="driver@company.com" value={email}
                  onChange={e => setEmail(e.target.value)} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input id="signup-password" className="form-input" type="password"
                    placeholder="Min 8 chars" value={password}
                    onChange={e => setPassword(e.target.value)} required minLength={8} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm</label>
                  <input id="signup-confirm" className="form-input" type="password"
                    placeholder="Repeat" value={confirm}
                    onChange={e => setConfirm(e.target.value)} required />
                </div>
              </div>
              <button id="signup-submit" className="btn btn-primary btn-lg w-full" type="submit" disabled={loading} style={{ marginTop: '0.25rem' }}>
                {loading ? <><span className="spinner" /> Creating account…</> : 'Create Account →'}
              </button>
            </form>
          ) : (
            <form className="auth-form-body" onSubmit={handleOtp}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.83rem', color: 'var(--t2)' }}>6-digit verification code</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--t3)', marginTop: '0.2rem' }}>Expires in 10 minutes</p>
              </div>
              <div className="otp-wrap" onPaste={onPaste}>
                {digits.map((d, i) => (
                  <input key={i} ref={el => { refs.current[i] = el; }}
                    className={`otp-digit${d ? ' has-val' : ''}`}
                    type="text" inputMode="numeric" maxLength={1} value={d}
                    onChange={e => onDigit(i, e.target.value)}
                    onKeyDown={e => onKey(i, e)} id={`signup-otp-${i}`} />
                ))}
              </div>
              <button id="signup-otp-submit" className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
                {loading ? <><span className="spinner" /> Verifying…</> : 'Verify Email & Continue'}
              </button>
              <button type="button" className="btn btn-ghost w-full btn-sm"
                onClick={() => { setStage('creds'); setDigits(['','','','','','']); setError(''); setInfo(''); }}>
                ← Edit details
              </button>
            </form>
          )}

          <div className="auth-divider">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
