import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, loggedIn, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <nav className="navbar">
      <Link to={loggedIn ? '/planner' : '/'} className="navbar-logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#0ea5e9' }}>
          <path d="M1 3h15l3 9H1L1 3z"/><circle cx="6" cy="18" r="2"/><circle cx="16" cy="18" r="2"/>
          <path d="M19 12l3 3-3 3"/>
        </svg>
        Spotter ELD
      </Link>
      <div className="navbar-links">
        {loggedIn ? (
          <>
            <Link to="/planner" className="btn btn-ghost btn-sm">Plan Trip</Link>
            <Link to="/history" className="btn btn-ghost btn-sm">History</Link>
            <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 0.25rem' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--t3)', padding: '0 0.25rem' }}>
              {user?.username}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
            <Link to="/signup" className="btn btn-primary btn-sm">Get Started</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
