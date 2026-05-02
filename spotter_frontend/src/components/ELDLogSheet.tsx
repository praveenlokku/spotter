import React, { useRef, useEffect } from 'react';

interface Period {
  status: 'OFF' | 'SB' | 'D' | 'ON';
  start_hour: number;
  end_hour: number;
}

interface ELDLogData {
  date: string;
  day_number: number;
  from_location: string;
  to_location: string;
  periods: Period[];
  totals: { OFF: number; SB: number; D: number; ON: number };
}

const STATUS_COLORS: Record<string, string> = {
  OFF: '#475569',
  SB:  '#818cf8',
  D:   '#3b82f6',
  ON:  '#10b981',
};

const STATUS_LABELS: Record<string, string> = {
  OFF: 'Off Duty',
  SB:  'Sleeper Berth',
  D:   'Driving',
  ON:  'On Duty (Not Driving)',
};

const ROW_ORDER = ['OFF', 'SB', 'D', 'ON'];

const ELDLogSheet: React.FC<{ log: ELDLogData; driverName: string }> = ({ log, driverName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const CANVAS_W = 860;
  const CANVAS_H = 380;
  const MARGIN_LEFT = 160;
  const MARGIN_RIGHT = 20;
  const MARGIN_TOP = 80;
  const MARGIN_BOTTOM = 50;
  const GRID_W = CANVAS_W - MARGIN_LEFT - MARGIN_RIGHT;
  const GRID_H = CANVAS_H - MARGIN_TOP - MARGIN_BOTTOM;
  const ROW_H = GRID_H / 4;
  const HOUR_W = GRID_W / 24;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Header
    ctx.fillStyle = '#1e2130';
    ctx.fillRect(0, 0, CANVAS_W, 65);

    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText(`Day ${log.day_number} — ${log.date}`, 16, 26);

    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Driver: ${driverName || 'N/A'}`, 16, 46);
    ctx.fillText(`From: ${(log.from_location || '').split(',')[0]}  →  To: ${(log.to_location || '').split(',')[0]}`, 16, 60);

    // Totals (top right)
    let tx = CANVAS_W - 10;
    const totalEntries = [
      { label: 'Drive', val: log.totals.D, color: STATUS_COLORS.D },
      { label: 'ON', val: log.totals.ON, color: STATUS_COLORS.ON },
      { label: 'SB', val: log.totals.SB, color: STATUS_COLORS.SB },
      { label: 'OFF', val: log.totals.OFF, color: STATUS_COLORS.OFF },
    ];
    totalEntries.reverse().forEach(({ label, val, color }) => {
      const text = `${label}: ${(val || 0).toFixed(1)}h`;
      ctx.font = 'bold 11px Inter, sans-serif';
      const tw = ctx.measureText(text).width + 16;
      tx -= tw + 8;
      ctx.fillStyle = color + '33';
      ctx.beginPath();
      ctx.roundRect(tx, 20, tw, 22, 6);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillText(text, tx + 8, 35);
    });

    // Row labels
    ROW_ORDER.forEach((status, i) => {
      const y = MARGIN_TOP + i * ROW_H;
      ctx.fillStyle = '#1a1d26';
      ctx.fillRect(0, y, MARGIN_LEFT - 2, ROW_H);
      ctx.strokeStyle = '#2a2d3a';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, y, MARGIN_LEFT - 2, ROW_H);

      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillStyle = STATUS_COLORS[status];
      ctx.fillText(STATUS_LABELS[status], 10, y + ROW_H / 2 - 5);
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(`(${(log.totals[status as keyof typeof log.totals] || 0).toFixed(1)} hrs)`, 10, y + ROW_H / 2 + 9);
    });

    // Grid background
    ctx.fillStyle = '#111318';
    ctx.fillRect(MARGIN_LEFT, MARGIN_TOP, GRID_W, GRID_H);

    // Hour grid lines
    for (let h = 0; h <= 24; h++) {
      const x = MARGIN_LEFT + h * HOUR_W;
      ctx.strokeStyle = h % 6 === 0 ? '#2a2d3a' : '#1e2130';
      ctx.lineWidth = h % 6 === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, MARGIN_TOP);
      ctx.lineTo(x, MARGIN_TOP + GRID_H);
      ctx.stroke();

      // Hour label
      if (h % 2 === 0) {
        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.fillText(h === 0 ? 'Mid' : h === 12 ? 'Noon' : h === 24 ? 'Mid' : `${h}`, x, MARGIN_TOP + GRID_H + 16);
      }
    }
    ctx.textAlign = 'left';

    // Row separator lines
    ROW_ORDER.forEach((_, i) => {
      const y = MARGIN_TOP + i * ROW_H;
      ctx.strokeStyle = '#2a2d3a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN_LEFT, y);
      ctx.lineTo(MARGIN_LEFT + GRID_W, y);
      ctx.stroke();
    });

    // Draw duty periods
    log.periods.forEach((period) => {
      const rowIdx = ROW_ORDER.indexOf(period.status);
      if (rowIdx === -1) return;
      const x = MARGIN_LEFT + period.start_hour * HOUR_W;
      const w = (period.end_hour - period.start_hour) * HOUR_W;
      const y = MARGIN_TOP + rowIdx * ROW_H;
      const barY = y + ROW_H * 0.2;
      const barH = ROW_H * 0.6;

      const color = STATUS_COLORS[period.status];

      // Glow effect
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, barY, Math.max(w, 2), barH, 3);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Crosshatch line at top of each period (ELD standard look)
      if (w > 4) {
        ctx.fillStyle = color + 'aa';
        ctx.fillRect(x, y, 2, ROW_H);
        ctx.fillRect(x + w - 2, y, 2, ROW_H);
      }
    });

    // Draw connecting vertical lines between status changes
    let lastStatus = '';
    let lastEndHour = 0;
    const sortedPeriods = [...log.periods].sort((a, b) => a.start_hour - b.start_hour);
    sortedPeriods.forEach((period) => {
      if (lastStatus && lastStatus !== period.status && Math.abs(period.start_hour - lastEndHour) < 0.1) {
        const fromRow = ROW_ORDER.indexOf(lastStatus);
        const toRow = ROW_ORDER.indexOf(period.status);
        const x = MARGIN_LEFT + period.start_hour * HOUR_W;
        const y1 = MARGIN_TOP + fromRow * ROW_H + ROW_H / 2;
        const y2 = MARGIN_TOP + toRow * ROW_H + ROW_H / 2;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      lastStatus = period.status;
      lastEndHour = period.end_hour;
    });

    // Border around grid
    ctx.strokeStyle = '#2a2d3a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(MARGIN_LEFT, MARGIN_TOP, GRID_W, GRID_H);

  }, [log, driverName]);

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const img = canvas.toDataURL('image/png');
    win.document.write(`
      <html><head><title>ELD Log Day ${log.day_number} — ${log.date}</title>
      <style>body{margin:0;background:#fff;} img{max-width:100%;}</style></head>
      <body><img src="${img}" /><script>window.onload=()=>{window.print();}</script></body></html>
    `);
    win.document.close();
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ width: '100%', height: 'auto', borderRadius: '8px', display: 'block' }}
      />
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={handlePrint}>
          🖨️ Print Day {log.day_number}
        </button>
      </div>
    </div>
  );
};

export default ELDLogSheet;
