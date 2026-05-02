import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../lib/api';

const TripHistory = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/trips/history/')
      .then(r => setTrips(r.data))
      .catch(() => setError('Failed to load trips.'))
      .finally(() => setLoading(false));
  }, []);

  const load = async (id: number) => {
    try {
      const r = await api.get(`/api/trips/${id}/`);
      sessionStorage.setItem('tripResult', JSON.stringify({
        stops: r.data.stops_data, route: r.data.route_data,
        eld_logs: r.data.eld_logs_data,
        locations: {
          current: { name: r.data.current_location },
          pickup:  { name: r.data.pickup_location },
          dropoff: { name: r.data.dropoff_location },
        }
      }));
      navigate('/result');
    } catch { alert('Could not load trip.'); }
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--p)', marginBottom: '0.3rem' }}>
            Your Trips
          </p>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800 }}>Trip History</h1>
          <p style={{ color: 'var(--t2)', fontSize: '0.875rem', marginTop: '0.3rem' }}>All your previously computed ELD trip plans.</p>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" style={{ width: '28px', height: '28px', borderWidth: '3px' }} /></div>}
        {error && <div className="alert alert-error">{error}</div>}
        {!loading && !trips.length && !error && (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--t3)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
            <p>No trips yet. <a href="/planner" style={{ color: 'var(--p)' }}>Plan your first →</a></p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {trips.map((t: any, i: number) => (
            <div key={t.id} className="history-item fade-up" style={{ animationDelay: `${i*0.05}s` }}>
              <div>
                <div className="history-route">
                  🚛
                  <span style={{ color: 'var(--p)' }}>{t.current_location?.split(',')[0]}</span>
                  <span style={{ color: 'var(--t3)' }}>→</span>
                  <span>{t.pickup_location?.split(',')[0]}</span>
                  <span style={{ color: 'var(--t3)' }}>→</span>
                  <span>{t.dropoff_location?.split(',')[0]}</span>
                </div>
                <div className="history-meta">
                  <span>📅 {new Date(t.created_at).toLocaleDateString()}</span>
                  {t.total_miles > 0 && <span>📏 {Math.round(t.total_miles)} mi</span>}
                  {t.total_hours > 0 && <span>⏱ {t.total_hours.toFixed(1)} hrs</span>}
                  {t.num_days > 0 && <span>📋 {t.num_days} log {t.num_days===1?'day':'days'}</span>}
                  <span>⚙️ {t.current_cycle_used_hrs} hrs cycle</span>
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => load(t.id)}>View →</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TripHistory;
