import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import Navbar from '../components/Navbar';

interface Suggestion { display_name: string; lat: string; lon: string; }

/* Debounced Nominatim geocode — US only */
const useGeo = (val: string) => {
  const [sugg, setSugg] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (val.length < 3) { setSugg([]); return; }
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&countrycodes=us&addressdetails=1`,
          { headers: { 'User-Agent': 'SpotterELD/2.0' } }
        );
        setSugg(await r.json());
      } catch { setSugg([]); }
      finally { setBusy(false); }
    }, 500);
  }, [val]);
  return { sugg, busy, clear: () => setSugg([]) };
};

const shortenName = (name: string) => name.split(',').slice(0, 3).join(', ');

const DOT = { current: 'var(--t2)', pickup: 'var(--success)', dropoff: 'var(--danger)' } as Record<string, string>;

const LocationField = ({ id, type, value, onChange, label }: {
  id: string; type: string; value: string; onChange: (v: string) => void; label: string;
}) => {
  const { sugg, busy, clear } = useGeo(value);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpen(sugg.length > 0); }, [sugg]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <div className="form-group">
        <label className="form-label" htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: DOT[type], display: 'inline-block', flexShrink: 0 }} />
          {label}
        </label>
        <div style={{ position: 'relative' }}>
          <input id={id} className="form-input" type="text" autoComplete="off"
            placeholder="Start typing a US city or address…" value={value}
            onChange={e => onChange(e.target.value)}
            style={{ paddingRight: '2.5rem' }} />
          {busy
            ? <span className="spinner" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14 }} />
            : value && <button type="button" onClick={() => { onChange(''); clear(); }}
                style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: '1rem', lineHeight: 1, padding: '2px' }}>✕</button>
          }
        </div>
      </div>
      {open && (
        <ul className="suggest-list">
          {sugg.map((s, i) => (
            <li key={i} className="suggest-item" onMouseDown={() => { onChange(s.display_name); clear(); setOpen(false); }}>
              <span style={{ flexShrink: 0 }}>📍</span>
              <div>
                <div style={{ fontSize: '0.82rem', color: 'var(--t1)', fontWeight: 500 }}>{shortenName(s.display_name)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.display_name}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const LOADING_STEPS = [
  'Geocoding your addresses…',
  'Fetching real road route via OSRM…',
  'Applying FMCSA HOS regulations…',
  'Computing stops & mandatory breaks…',
  'Calculating sleeper berth rest periods…',
  'Building ELD duty-status logs…',
  'Finalising your trip plan…',
];

const TripPlanner = () => {
  const navigate = useNavigate();

  // Locations
  const [cur,  setCur]  = useState('');
  const [pick, setPick] = useState('');
  const [drop, setDrop] = useState('');

  // Cycle hours
  const [hrs, setHrs] = useState('0');

  // HOS options
  const [ruleset,          setRuleset]          = useState('70_8');
  const [adverse,          setAdverse]          = useState(false);
  const [shortHaul,        setShortHaul]        = useState(false);
  const [splitSleeper,     setSplitSleeper]     = useState(false);

  // Carrier info (for PDF)
  const [carrier,          setCarrier]          = useState('');
  const [truckNum,         setTruckNum]         = useState('');
  const [coDriver,         setCoDriver]         = useState('');

  // UI state
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hrsNum = Math.min(70, Math.max(0, parseFloat(hrs) || 0));
  const cycleLimit = ruleset === '60_7' ? 60 : 70;
  const pct = (hrsNum / cycleLimit) * 100;
  const barColor = pct >= 100 ? 'var(--danger)' : pct >= 85 ? 'var(--p)' : pct >= 60 ? 'var(--amber)' : 'var(--success)';

  // React Query: rolling cycle hours from history
  const { data: rollingData, isLoading: rollingLoading } = useQuery({
    queryKey: ['cycle-hours', ruleset],
    queryFn: () => api.get(`/api/trips/cycle-hours/?ruleset=${ruleset}`).then(r => r.data),
    retry: 1,
  });

  // Plan mutation
  const planMutation = useMutation({
    mutationFn: (payload: object) => api.post('/api/trips/plan/', payload).then(r => r.data),
    onSuccess: (data) => {
      sessionStorage.setItem('tripResult', JSON.stringify(data));
      navigate('/result');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || 'Failed to plan trip.';
      setError(msg);
    },
  });

  // Cycling loading messages
  useEffect(() => {
    if (!planMutation.isPending) { setLoadingMsg(''); return; }
    let i = 0;
    setLoadingMsg(LOADING_STEPS[0]);
    const iv = setInterval(() => {
      i = Math.min(i + 1, LOADING_STEPS.length - 1);
      setLoadingMsg(LOADING_STEPS[i]);
    }, 3000);
    return () => clearInterval(iv);
  }, [planMutation.isPending]);

  // GPS "Use my location"
  const getGPS = () => {
    if (!navigator.geolocation) { setError('GPS not available in this browser.'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { 'User-Agent': 'SpotterELD/2.0' } }
          );
          const d = await r.json();
          setCur(d.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        } catch {
          setCur(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        }
      },
      () => setError('Could not get GPS location. Please enter manually.'),
      { timeout: 10000 }
    );
  };

  // Auto-fill cycle hours from history
  const autoFillCycle = () => {
    if (rollingData?.cycle_hours_used != null) {
      setHrs(String(rollingData.cycle_hours_used));
    }
  };

  const allFilled = cur.trim() && pick.trim() && drop.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allFilled) { setError('Please fill in all three location fields.'); return; }
    if (hrsNum >= cycleLimit) {
      setError(`Your ${cycleLimit}-hour cycle is exhausted. You need a 34-hour restart before driving again.`);
      return;
    }
    setError('');
    planMutation.mutate({
      current_location:       cur.trim(),
      pickup_location:        pick.trim(),
      dropoff_location:       drop.trim(),
      current_cycle_used_hrs: hrsNum,
      ruleset,
      adverse_conditions:     adverse,
      short_haul:             shortHaul,
      split_sleeper_berth:    splitSleeper,
      carrier_name:           carrier,
      truck_number:           truckNum,
      co_driver_name:         coDriver,
    });
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div className="planner-wrap">

        <div className="planner-header fade-up">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span style={{ width: 8, height: 8, background: 'var(--p)', borderRadius: '50%', boxShadow: '0 0 8px var(--p-glow)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p)' }}>FMCSA HOS Trip Planner</span>
          </div>
          <h1 className="planner-title">Plan your trip</h1>
          <p className="planner-sub">Enter locations, choose your ruleset and HOS options — we enforce every federal regulation automatically.</p>
        </div>

        {/* Ruleset selector */}
        <div className="fade-up delay-1" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {[
            { key: '70_8', label: '70 hrs / 8 days', sub: 'Most common' },
            { key: '60_7', label: '60 hrs / 7 days', sub: 'Alternative' },
          ].map(rs => (
            <button key={rs.key} type="button" onClick={() => setRuleset(rs.key)}
              style={{
                flex: 1, padding: '0.7rem', border: `2px solid ${ruleset === rs.key ? 'var(--p)' : 'var(--border)'}`,
                borderRadius: 'var(--r-md)', background: ruleset === rs.key ? 'var(--p-bg)' : 'var(--bg-card)',
                cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
              }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: ruleset === rs.key ? 'var(--p)' : 'var(--t1)' }}>{rs.label}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--t3)' }}>{rs.sub} property carrier ruleset</div>
            </button>
          ))}
        </div>

        {/* HOS rules banner */}
        <div className="hos-banner fade-up delay-1">
          <strong>Rules applied ({ruleset === '60_7' ? '60/7' : '70/8'}):</strong>
          <div className="hos-pills">
            {[
              `${ruleset === '60_7' ? '60' : '70'}-hr cycle`,
              '11-hr drive limit',
              '14-hr on-duty window',
              '30-min break @ 8 hrs',
              '10-hr sleeper rest',
              'Fuel ≤ 1,000 mi',
              ...(adverse   ? ['+2 hrs (adverse)']   : []),
              ...(shortHaul ? ['Short-haul exempt']  : []),
              ...(splitSleeper ? ['Split sleeper']   : []),
            ].map(p => <span key={p} className="hos-pill">{p}</span>)}
          </div>
        </div>

        {error && (
          <div className="alert alert-error fade-up" style={{ marginBottom: '1rem' }}>
            <span>⚠</span>
            <div><strong>Error</strong><div style={{ marginTop: 2, fontSize: '0.82rem' }}>{error}</div></div>
          </div>
        )}

        <div className="card fade-up delay-2" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Route visual connector */}
            <div style={{ display: 'flex', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2.4rem', flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--t2)', border: '2px solid var(--bg)' }} />
                <div style={{ width: 2, flex: 1, background: 'linear-gradient(to bottom, var(--t2), var(--success))', minHeight: 36 }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)', border: '2px solid var(--bg)' }} />
                <div style={{ width: 2, flex: 1, background: 'linear-gradient(to bottom, var(--success), var(--danger))', minHeight: 36 }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--danger)', border: '2px solid var(--bg)' }} />
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Current location with GPS button */}
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <LocationField id="current-location" type="current" label="Current Location" value={cur} onChange={setCur} />
                    </div>
                    <button type="button" onClick={getGPS} className="btn btn-ghost btn-sm"
                      title="Use GPS location" style={{ marginBottom: '1.3rem', padding: '0.5rem 0.8rem', flexShrink: 0 }}>
                      📍 GPS
                    </button>
                  </div>
                </div>
                <LocationField id="pickup-location"  type="pickup"  label="Pickup Location"  value={pick} onChange={setPick} />
                <LocationField id="dropoff-location" type="dropoff" label="Dropoff Location" value={drop} onChange={setDrop} />
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* Cycle hours */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0 }} htmlFor="cycle-hrs">
                  Cycle Hours Used <span style={{ fontWeight: 400, color: 'var(--t3)', textTransform: 'none', letterSpacing: 0 }}>— out of {cycleLimit} hrs</span>
                </label>
                {rollingData && (
                  <button type="button" onClick={autoFillCycle}
                    style={{ fontSize: '0.72rem', color: 'var(--amber)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    Auto-fill from history ({rollingData.cycle_hours_used}h)
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <input id="cycle-hrs" className="form-input" type="number"
                  min="0" max={cycleLimit} step="0.5" value={hrs}
                  onChange={e => setHrs(e.target.value)}
                  style={{ width: 110, textAlign: 'center', fontSize: '1.2rem', fontWeight: 700, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.77rem', marginBottom: 5 }}>
                    <span style={{ color: barColor, fontWeight: 700 }}>{hrsNum.toFixed(1)} hrs used ({pct.toFixed(0)}%)</span>
                    <span style={{ color: 'var(--t3)' }}>{cycleLimit} hrs max</span>
                  </div>
                  <div className="cycle-bar-track">
                    <div className="cycle-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                  </div>
                  <p style={{ fontSize: '0.73rem', color: barColor, marginTop: 4, fontWeight: 600 }}>
                    {pct >= 100 ? '⛔ Cycle exhausted — 34-hr restart required' :
                     pct >= 85  ? '⚠ Nearly exhausted' :
                     pct >= 60  ? '⚠ Use cycle hours carefully' :
                     `${(cycleLimit - hrsNum).toFixed(1)} hrs remaining`}
                  </p>
                </div>
              </div>
            </div>

            {/* HOS exemptions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { key: 'adverse', label: 'Adverse Conditions Exemption', sub: '+2 hrs driving / +2 hrs window for snow, ice, or fog', value: adverse, set: setAdverse },
                { key: 'short',   label: 'Short-Haul Exemption (150 air miles)', sub: 'No ELD log required if returning to home terminal daily', value: shortHaul, set: setShortHaul },
                { key: 'split',   label: 'Split Sleeper Berth (7+3 or 8+2)', sub: 'Split the 10-hr rest into two qualifying periods', value: splitSleeper, set: setSplitSleeper },
              ].map(opt => (
                <label key={opt.key} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.7rem 0.9rem', border: `1px solid ${opt.value ? 'var(--border-2)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-md)', background: opt.value ? 'var(--p-bg)' : 'var(--bg-card)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <input type="checkbox" checked={opt.value} onChange={e => opt.set(e.target.checked)}
                    style={{ accentColor: 'var(--p)', width: 16, height: 16, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600, color: opt.value ? 'var(--p)' : 'var(--t1)' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--t3)' }}>{opt.sub}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Advanced (carrier info for PDF) */}
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: '0.8rem', textAlign: 'left', padding: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {showAdvanced ? '▾' : '▸'} Carrier info for PDF log (optional)
            </button>
            {showAdvanced && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                {[
                  { id: 'carrier', label: 'Carrier Name', val: carrier, set: setCarrier, ph: 'e.g. ABC Trucking' },
                  { id: 'truck',   label: 'Truck #',      val: truckNum, set: setTruckNum, ph: 'e.g. T-4421' },
                  { id: 'codrv',  label: 'Co-Driver',    val: coDriver, set: setCoDriver, ph: 'Optional' },
                ].map(f => (
                  <div key={f.id} className="form-group">
                    <label className="form-label" htmlFor={f.id}>{f.label}</label>
                    <input id={f.id} className="form-input" type="text" placeholder={f.ph}
                      value={f.val} onChange={e => f.set(e.target.value)} />
                  </div>
                ))}
              </div>
            )}

            <button id="plan-trip-submit" className="btn btn-primary btn-lg w-full"
              type="submit" disabled={planMutation.isPending || !allFilled}
              style={{ marginTop: '0.5rem' }}>
              {planMutation.isPending
                ? <><span className="spinner" /> {loadingMsg}</>
                : allFilled
                  ? '→ Generate Trip Plan & ELD Logs'
                  : 'Fill in all 3 locations to continue'}
            </button>
          </form>
        </div>

        {/* What happens next */}
        {!planMutation.isPending && (
          <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }} className="fade-up">
            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--t3)', marginBottom: '0.6rem' }}>After submit you'll get</p>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {[
                ['🛣️', 'Real road route (OSRM)'],
                ['⚖️', 'All FMCSA rules enforced'],
                ['🗺️', 'Interactive route map'],
                ['📋', 'ELD log sheets'],
                ['📄', 'Downloadable PDF'],
                ['📊', 'CSV export'],
              ].map(([icon, text]) => (
                <div key={text as string} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--t2)' }}>
                  {icon} {text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripPlanner;
