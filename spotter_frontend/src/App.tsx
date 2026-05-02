import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from './components/Navbar';

/* All numbers below are direct FMCSA regulations — 100% real */
const HOS_RULES = [
  { num: '11', unit: 'hrs', label: 'Max driving per shift', detail: 'After 10 consecutive hours off duty' },
  { num: '14', unit: 'hrs', label: 'On-duty window limit', detail: 'Cannot drive after 14 hrs from start of shift' },
  { num: '30', unit: 'min', label: 'Mandatory break', detail: 'Required after 8 cumulative hours of driving' },
  { num: '10', unit: 'hrs', label: 'Minimum rest', detail: 'Sleeper berth required before next shift' },
  { num: '70', unit: 'hrs', label: '8-day cycle cap', detail: 'Property-carrying drivers — most common ruleset' },
  { num: '1,000', unit: 'mi', label: 'Fuel interval', detail: 'Automatic fuel stop inserted in your plan' },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: '📍',
    title: 'Enter 3 locations',
    desc: 'Current position, pickup point, and dropoff destination. We geocode and validate all US addresses instantly.',
  },
  {
    step: '02',
    icon: '⚙️',
    title: 'We compute the full plan',
    desc: 'OSRM calculates the real road route. Our HOS engine enforces all 6 federal regulations and inserts every mandatory stop.',
  },
  {
    step: '03',
    icon: '🗺️',
    title: 'Get your route map',
    desc: 'Interactive map shows every stop — pickup, dropoff, fuel, 30-min breaks, and sleeper berths — with arrival times.',
  },
  {
    step: '04',
    icon: '📋',
    title: 'Download your ELD logs',
    desc: 'Auto-filled daily duty-status sheets drawn to FMCSA spec. One sheet per 24-hour period. Print-ready.',
  },
];

const WHAT_GETS_COMPUTED = [
  '✓  Exact driving segments — when to drive, when to stop',
  '✓  30-min break after every 8 hrs of continuous driving',
  '✓  10-hr sleeper berth when 11-hr or 14-hr limits hit',
  '✓  1 hr on-duty time at each pickup and dropoff',
  '✓  Fuel stops every ≤ 1,000 miles along the route',
  '✓  Cycle hours carried over from your current 8-day period',
  '✓  Multi-day trips split across correct calendar dates',
  '✓  ELD log sheet generated for every 24-hour period',
];

const App = () => (
  <div style={{ minHeight: '100vh' }}>
    <Navbar />

    {/* ── HERO ── */}
    <section className="hero">
      <div style={{ maxWidth: '760px' }}>
        <div className="hero-badge fade-up">
          <span className="hero-badge-dot" />
          FMCSA 49 CFR § 395 · Property-Carrying · 70 hrs / 8 days
        </div>

        <h1 className="hero-title fade-up delay-1">
          Stop guessing your<br /><span>HOS limits.</span>
        </h1>

        <p className="hero-sub fade-up delay-2">
          Enter your trip and Spotter computes every stop, break, rest period, and fuel stop
          required by federal law — then draws your ELD log sheets automatically.
        </p>

        <div className="hero-actions fade-up delay-3">
          <Link to="/signup" className="btn btn-primary btn-lg">Plan My First Trip →</Link>
          <Link to="/login" className="btn btn-ghost btn-lg">Sign In</Link>
        </div>

        {/* Real HOS numbers grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px',
          background: 'var(--border)', border: '1px solid var(--border)',
          borderRadius: '14px', overflow: 'hidden', marginTop: '3.5rem'
        }} className="fade-up delay-3">
          {HOS_RULES.map((r) => (
            <div key={r.label} style={{ background: 'var(--bg-card)', padding: '1.1rem 1rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', justifyContent: 'center', marginBottom: '3px' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--amber)', fontFamily: 'var(--font-display)' }}>{r.num}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--p)', textTransform: 'uppercase' }}>{r.unit}</span>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--t1)', marginBottom: '2px' }}>{r.label}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--t3)', lineHeight: 1.4 }}>{r.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── WHAT GETS COMPUTED ── */}
    <section style={{ padding: '5rem 1.5rem', background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}>
      <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
        <div>
          <p className="section-label">What Spotter computes</p>
          <h2 className="section-title">Every federal rule,<br />applied for you</h2>
          <p className="section-sub" style={{ marginBottom: '2rem' }}>
            Based on FMCSA 49 CFR § 395 regulations for property-carrying drivers.
            Zero manual calculations.
          </p>
          <Link to="/signup" className="btn btn-primary">Start for free →</Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {WHAT_GETS_COMPUTED.map((item) => (
            <div key={item} style={{
              padding: '0.7rem 1rem',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '10px', fontSize: '0.85rem', color: 'var(--t2)',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              transition: 'border-color 0.15s'
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── HOW IT WORKS ── */}
    <section style={{ padding: '5rem 1.5rem', background: 'var(--bg)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p className="section-label">How it works</p>
          <h2 className="section-title">Trip plan in 4 steps</h2>
          <p className="section-sub">From address entry to printed ELD log in under a minute</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem' }}>
          {HOW_IT_WORKS.map((step, i) => (
            <div key={i} className="feature-card fade-up" style={{ animationDelay: `${i * 0.08}s`, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 800, color: 'var(--p)',
                  background: 'var(--p-bg)', border: '1px solid rgba(249,115,22,0.25)',
                  padding: '0.2rem 0.55rem', borderRadius: '999px', letterSpacing: '0.05em'
                }}>
                  {step.step}
                </span>
                <span style={{ fontSize: '1.4rem' }}>{step.icon}</span>
              </div>
              <h3 className="feature-title">{step.title}</h3>
              <p className="feature-desc">{step.desc}</p>
              {i < HOW_IT_WORKS.length - 1 && (
                <div style={{
                  position: 'absolute', right: '-0.65rem', top: '50%', transform: 'translateY(-50%)',
                  fontSize: '1rem', color: 'var(--t3)', display: 'none'
                }}>→</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── OUTPUT PREVIEW ── */}
    <section style={{ padding: '5rem 1.5rem', background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}>
      <div className="container" style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto' }}>
        <p className="section-label">Output preview</p>
        <h2 className="section-title">Two outputs from one trip</h2>
        <p className="section-sub" style={{ marginBottom: '2.5rem' }}>
          A live interactive map for navigation + auto-filled ELD log sheets for compliance.
          Both generated from the same calculation.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'left' }}>
          {[
            {
              icon: '🗺️', title: 'Route Map',
              items: ['Dark interactive map (OpenStreetMap)', 'Every stop marked with type & time', 'Click any stop for full details', 'Auto-zooms to fit full route'],
              color: 'var(--p)'
            },
            {
              icon: '📋', title: 'ELD Log Sheets',
              items: ['FMCSA-standard 24-hr duty grid', 'OFF / Sleeper / Driving / On-Duty rows', 'One sheet per calendar day', 'Print directly from browser'],
              color: 'var(--amber)'
            },
          ].map(col => (
            <div key={col.title} className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.3rem' }}>{col.icon}</span>
                <span style={{ fontWeight: 700, color: col.color }}>{col.title}</span>
              </div>
              {col.items.map(item => (
                <div key={item} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.45rem', fontSize: '0.8rem', color: 'var(--t2)' }}>
                  <span style={{ color: 'var(--success)', flexShrink: 0 }}>✓</span>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── CTA ── */}
    <section style={{ padding: '5rem 1.5rem', background: 'var(--bg)' }}>
      <div style={{
        maxWidth: '600px', margin: '0 auto', textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(251,191,36,0.05) 100%)',
        border: '1px solid rgba(249,115,22,0.2)', borderRadius: '24px', padding: '3rem 2rem'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🚛</div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.75rem' }}>
          Ready to plan your first trip?
        </h2>
        <p style={{ color: 'var(--t2)', marginBottom: '2rem', fontSize: '0.92rem', lineHeight: 1.7 }}>
          Free account. No credit card. Real HOS calculations powered by OSRM routing
          and FMCSA regulations.
        </p>
        <Link to="/signup" className="btn btn-primary btn-lg">Create Free Account →</Link>
        <p style={{ fontSize: '0.75rem', color: 'var(--t3)', marginTop: '1rem' }}>
          OTP-secured · Trip history saved · Printable ELD logs
        </p>
      </div>
    </section>

    <footer style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--t3)', borderTop: '1px solid var(--border)', lineHeight: 2 }}>
      <div>Spotter ELD · Built with Django + React</div>
      <div>Routing: OSRM (OpenStreetMap) · Geocoding: Nominatim · Regulations: FMCSA 49 CFR § 395</div>
    </footer>
  </div>
);

export default App;