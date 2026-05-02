import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import ELDLogSheet from '../components/ELDLogSheet';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

const STOP_COLORS: Record<string,string> = {
  start:'#22d3ee', pickup:'#22c55e', dropoff:'#818cf8',
  fuel:'#f59e0b', rest_break:'#a78bfa', sleeper_berth:'#6366f1'
};
const STOP_ICONS: Record<string,string> = {
  start:'🏠', pickup:'📦', dropoff:'🏁', fuel:'⛽', rest_break:'☕', sleeper_berth:'😴'
};
const STATUS_LABELS: Record<string,string> = { D:'Driving', ON:'On Duty', SB:'Sleeper Berth', OFF:'Off Duty' };

const fmtTime = (iso: string) => {
  try { return new Date(iso).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC'; }
  catch { return iso; }
};

const TripResult = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<'map'|'logs'|'stops'>('map');
  const [logDay, setLogDay] = useState(0);

  useEffect(() => {
    const raw = sessionStorage.getItem('tripResult');
    if (!raw) { navigate('/planner'); return; }
    setData(JSON.parse(raw));
  }, []);

  if (!data) return null;

  const { stops=[], route={}, eld_logs=[], locations={} } = data;
  const geometry: [number,number][] = (route.geometry||[]).map((p:number[])=>[p[0],p[1]]);

  const STATS = [
    { icon:'📏', val:`${Math.round(route.total_distance_miles||0)} mi`, label:'Distance' },
    { icon:'⏱', val:`${(route.total_trip_hours||0).toFixed(1)} hrs`, label:'Trip time' },
    { icon:'📋', val:`${eld_logs.length}`, label:'Log days' },
    { icon:'📍', val:`${stops.length}`, label:'Total stops' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* Top bar */}
      <div className="result-topbar">
        <div style={{ marginBottom: '0.75rem' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '2px' }}>Trip Plan Results</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--t3)' }}>
            {locations.current?.name?.split(',')[0]} → {locations.pickup?.name?.split(',')[0]} → {locations.dropoff?.name?.split(',')[0]}
          </p>
        </div>
        <div className="result-stats">
          {STATS.map(s => (
            <div key={s.label} className="result-stat">
              <span style={{ fontSize: '1rem' }}>{s.icon}</span>
              <div>
                <div className="result-stat-val">{s.val}</div>
                <div className="result-stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {(['map','logs','stops'] as const).map(t => (
          <button key={t} className={`tab-btn${tab===t?' active':''}`} onClick={() => setTab(t)}>
            {t==='map'?'🗺️ Route Map':t==='logs'?'📋 ELD Logs':'📍 All Stops'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '1.5rem' }}>
        {tab === 'map' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.25rem', height: '580px' }}>
            <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <MapView geometry={geometry} stops={stops} />
            </div>
            <div className="card" style={{ overflowY: 'auto', padding: '1rem' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--t3)', marginBottom: '0.75rem' }}>
                Route Stops ({stops.length})
              </p>
              <div className="stop-timeline">
                {stops.map((s:any, i:number) => (
                  <div key={i} className="stop-item">
                    <div className="stop-dot" style={{ background: `${STOP_COLORS[s.type]}18`, border: `1.5px solid ${STOP_COLORS[s.type]}55` }}>
                      <span style={{ fontSize: '0.9rem' }}>{STOP_ICONS[s.type]||'📍'}</span>
                    </div>
                    <div className="stop-body">
                      <div className="stop-type" style={{ color: STOP_COLORS[s.type] }}>{s.type.replace('_',' ')}</div>
                      <div className="stop-loc">{s.location?.split(',').slice(0,2).join(',')}</div>
                      <div className="stop-meta">{fmtTime(s.arrival)}{s.duration_hrs>0?` · ${s.duration_hrs.toFixed(1)} hrs`:''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'logs' && (
          <div>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              {eld_logs.map((l:any, i:number) => (
                <button key={i}
                  className={`btn btn-sm ${logDay===i?'btn-primary':'btn-ghost'}`}
                  onClick={() => setLogDay(i)}>
                  Day {l.day_number} · {l.date}
                </button>
              ))}
            </div>
            {eld_logs[logDay] && (
              <div className="card" style={{ padding: '1.25rem' }}>
                <ELDLogSheet log={eld_logs[logDay]} driverName={user?.username||'Driver'} />
              </div>
            )}
            {!eld_logs.length && <div className="alert alert-info">No ELD log data generated.</div>}
          </div>
        )}

        {tab === 'stops' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1rem' }}>
            {stops.map((s:any, i:number) => (
              <div key={i} className="card" style={{ padding: '1.1rem', borderLeft: `3px solid ${STOP_COLORS[s.type]||'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>{STOP_ICONS[s.type]||'📍'}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: STOP_COLORS[s.type], textTransform: 'capitalize' }}>
                    {s.type.replace('_',' ')}
                  </span>
                  <span className="badge badge-gray" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>
                    {STATUS_LABELS[s.duty_status]||s.duty_status}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--t2)', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                  {s.location?.split(',').slice(0,3).join(',')}
                </p>
                <div style={{ fontSize: '0.75rem', color: 'var(--t3)' }}>
                  <div>🕐 {fmtTime(s.arrival)}</div>
                  {s.duration_hrs>0 && <div style={{ marginTop: '2px' }}>⏱ {s.duration_hrs.toFixed(1)} hrs</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => navigate('/planner')}>← New Trip</button>
        <button className="btn btn-ghost" onClick={() => navigate('/history')}>📜 History</button>
        {data.trip_id && (<>
          <a
            href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/trips/${data.trip_id}/pdf/`}
            className="btn btn-amber"
            target="_blank" rel="noopener noreferrer"
            download={`ELD_Log_Trip_${data.trip_id}.pdf`}
          >
            📄 Download PDF Log
          </a>
          <a
            href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/trips/${data.trip_id}/csv/`}
            className="btn btn-ghost"
            download={`ELD_Trip_${data.trip_id}.csv`}
          >
            📊 Export CSV
          </a>
        </>)}
      </div>

    </div>
  );
};

export default TripResult;
