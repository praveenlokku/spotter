import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

type Stage = 'creds' | 'otp';
type Mode = 'password' | 'otp';

const FEATURES = [
  'HOS-compliant route planning',
  'Automatic rest & break scheduling',
  'ELD log sheet generation',
  'Live map with all stops',
];

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [stage, setStage] = useState<Stage>('creds');
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [digits, setDigits] = useState(['','','','','','']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const refs = useRef<(HTMLInputElement|null)[]>([]);

  useEffect(() => { if (stage === 'otp') refs.current[0]?.focus(); }, [stage]);

  const handleCreds = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (mode === 'password') {
        const r = await api.post('/api/users/login/', { email, password });
        // Password login returns tokens immediately now
        login(r.data.user, r.data.access, r.data.refresh);
        navigate('/planner');
      } else {
        const r = await api.post('/api/users/send-login-otp/', { email });
        setInfo(r.data.message); setStage('otp');
      }
    } catch (err: any) {
      const d = err.response?.data;
      if (d?.next === 'verify-otp') { setInfo(d.message); setStage('otp'); }
      else setError(d?.error || 'Login failed.');
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
      let r;
      try { r = await api.post('/api/users/verify-otp/', { email, code, purpose: 'login' }); }
      catch { r = await api.post('/api/users/verify-otp/', { email, code, purpose: 'signup' }); }
      login(r.data.user, r.data.access, r.data.refresh);
      navigate('/planner');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid code.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page" style={{ minHeight: '100vh' }}>
      {/* Left brand panel */}
      <div className="auth-brand" style={{ display: 'flex' }}>
        <div className="auth-brand-content">
          <div className="auth-brand-logo">⚡ Spotter ELD</div>
          <h2 className="auth-brand-title">Plan smarter.<br />Drive compliant.</h2>
          <p className="auth-brand-desc">
            The only ELD trip planner that computes every mandatory stop, rest period,
            and fuel break automatically — so you stay focused on the road.
          </p>
          <div className="auth-brand-features">
            {FEATURES.map(f => (
              <div key={f} className="auth-feature">
                <div className="auth-feature-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="auth-form-side">
        <div className="auth-form-box fade-up">
          <p style={{ fontSize: '0.78rem', color: 'var(--t3)', marginBottom: '0.5rem' }}>WELCOME BACK</p>
          <h1 className="auth-form-title">Sign in to Spotter</h1>
          <p className="auth-form-sub">
            {stage === 'otp' ? `Check ${email} for a 6-digit code.` : 
             mode === 'password' ? 'Enter your credentials to continue.' : 'We will send a login code to your email.'}
          </p>

          {error && <div className="alert alert-error mb-2">⚠ {error}</div>}
          {info && !error && <div className="alert alert-info mb-2">✉ {info}</div>}

          {stage === 'creds' ? (
            <form className="auth-form-body" onSubmit={handleCreds}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input id="login-email" className="form-input" type="email"
                  placeholder="driver@company.com" value={email}
                  onChange={e => setEmail(e.target.value)} required autoFocus />
              </div>
              
              {mode === 'password' && (
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input id="login-password" className="form-input" type="password"
                    placeholder="Your password" value={password}
                    onChange={e => setPassword(e.target.value)} required />
                </div>
              )}

              <button id="login-submit" className="btn btn-primary btn-lg w-full" type="submit" disabled={loading} style={{ marginTop: '0.25rem' }}>
                {loading ? <><span className="spinner" /> {mode === 'password' ? 'Signing in...' : 'Sending OTP...'}</> : 
                 mode === 'password' ? 'Sign In →' : 'Send Login Code →'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => { setMode(mode === 'password' ? 'otp' : 'password'); setError(''); setInfo(''); }}>
                  {mode === 'password' ? 'Login with OTP instead' : 'Login with password instead'}
                </button>
              </div>
            </form>
          ) : (
            <form className="auth-form-body" onSubmit={handleOtp}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.83rem', color: 'var(--t2)', marginBottom: '0.25rem' }}>
                  Enter the 6-digit verification code
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--t3)' }}>Code expires in 10 minutes</p>
              </div>
              <div className="otp-wrap" onPaste={onPaste}>
                {digits.map((d, i) => (
                  <input key={i} ref={el => { refs.current[i] = el; }}
                    className={`otp-digit${d ? ' has-val' : ''}`}
                    type="text" inputMode="numeric" maxLength={1} value={d}
                    onChange={e => onDigit(i, e.target.value)}
                    onKeyDown={e => onKey(i, e)} id={`otp-${i}`} />
                ))}
              </div>
              <button id="otp-verify" className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
                {loading ? <><span className="spinner" /> Verifying…</> : 'Verify & Sign In'}
              </button>
              <button type="button" className="btn btn-ghost w-full btn-sm"
                onClick={() => { setStage('creds'); setDigits(['','','','','','']); setError(''); setInfo(''); }}>
                ← Back to login options
              </button>
            </form>
          )}

          <div className="auth-divider">
            New to Spotter? <Link to="/signup">Create a free account</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;