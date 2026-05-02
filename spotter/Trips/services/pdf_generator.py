"""
FMCSA ELD Log Sheet PDF Generator
Produces pixel-accurate Form 395A duty-status graphs using ReportLab.
One page per calendar day.
"""
from io import BytesIO
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Spacer, Paragraph, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.graphics import renderPDF
import logging

logger = logging.getLogger(__name__)

# ── FMCSA duty-status rows (order matches physical log sheet) ──
DUTY_ROWS = ['OFF', 'SB', 'D', 'ON']
ROW_LABELS = {
    'OFF': '1. Off Duty',
    'SB':  '2. Sleeper Berth',
    'D':   '3. Driving',
    'ON':  '4. On Duty\n(Not Driving)',
}
DUTY_MAP = {
    'OFF': 'OFF', 'SB': 'SB',
    'D': 'D', 'ON': 'ON',
    'Driving': 'D', 'On Duty': 'ON',
    'Sleeper Berth': 'SB', 'Off Duty': 'OFF',
}
STATUS_MAP = {
    'D': 'D', 'ON': 'ON', 'SB': 'SB', 'OFF': 'OFF',
    'Driving': 'D', 'On Duty Not Driving': 'ON',
    'Sleeper Berth': 'SB', 'Off Duty': 'OFF',
}

ROW_COLORS = {
    'OFF': colors.HexColor('#2d4a3e'),
    'SB':  colors.HexColor('#1e3a5f'),
    'D':   colors.HexColor('#7c2d12'),
    'ON':  colors.HexColor('#713f12'),
}


def _parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace('Z', '+00:00'))


def _draw_grid(log: dict, driver_name: str, carrier: str = 'Independent') -> Drawing:
    """Draw a single 24-hour duty-status grid as a ReportLab Drawing."""
    W = 6.5 * inch
    HEADER = 0.35 * inch
    ROW_H  = 0.45 * inch
    GRID_H = ROW_H * 4
    TOTAL_H = HEADER + GRID_H + 0.15 * inch

    d = Drawing(W, TOTAL_H)

    # Background
    d.add(Rect(0, 0, W, TOTAL_H, fillColor=colors.HexColor('#1a1510'), strokeColor=None))

    # Hour grid lines (0–24)
    col_w = (W - 0.85 * inch) / 24
    grid_x = 0.85 * inch

    # Row backgrounds + labels
    for i, status in enumerate(DUTY_ROWS):
        y = HEADER + i * ROW_H
        d.add(Rect(0, y, 0.84 * inch, ROW_H,
                   fillColor=ROW_COLORS[status], strokeColor=colors.HexColor('#3d3020')))
        d.add(String(0.02 * inch, y + ROW_H * 0.3,
                     ROW_LABELS[status],
                     fontSize=5.5, fillColor=colors.white, fontName='Helvetica'))

    # Hour labels at top
    for h in range(25):
        x = grid_x + h * col_w
        label = 'M' if h == 0 else ('N' if h == 12 else (str(h) if h < 13 else str(h - 12)))
        d.add(String(x - 2, HEADER + GRID_H + 0.02 * inch,
                     label, fontSize=5, fillColor=colors.HexColor('#a89880'), fontName='Helvetica'))
        d.add(Line(x, HEADER, x, HEADER + GRID_H,
                   strokeColor=colors.HexColor('#2d2618'), strokeWidth=0.5))

    # Plot duty status segments from log
    segments = log.get('segments', [])
    date_str = log.get('date', '')

    for seg in segments:
        status = STATUS_MAP.get(seg.get('status', 'OFF'), 'OFF')
        row_i  = DUTY_ROWS.index(status)
        start_frac = seg.get('start_hour', 0) / 24
        end_frac   = seg.get('end_hour', 0) / 24

        x1 = grid_x + start_frac * (W - 0.85 * inch)
        x2 = grid_x + end_frac   * (W - 0.85 * inch)
        y  = HEADER + row_i * ROW_H + ROW_H * 0.1

        d.add(Rect(x1, y, max(0.5, x2 - x1), ROW_H * 0.8,
                   fillColor=colors.HexColor('#f97316'),
                   strokeColor=colors.HexColor('#fbbf24'),
                   strokeWidth=0.8))

    # Outer border
    d.add(Rect(0, HEADER, W, GRID_H,
               fillColor=None, strokeColor=colors.HexColor('#5c5040'), strokeWidth=1))

    return d


def generate_eld_pdf(eld_logs: list, trip_summary: dict,
                     driver_name: str = 'Driver',
                     carrier: str = 'Independent',
                     truck_number: str = '',
                     co_driver: str = '') -> bytes:
    """
    Generate a complete FMCSA-style ELD log PDF.
    Returns raw PDF bytes.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        leftMargin=0.5 * inch, rightMargin=0.5 * inch,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('title', parent=styles['Normal'],
                                 fontSize=14, fontName='Helvetica-Bold',
                                 textColor=colors.HexColor('#fef3e2'),
                                 alignment=TA_CENTER, spaceAfter=4)
    sub_style = ParagraphStyle('sub', parent=styles['Normal'],
                               fontSize=8, fontName='Helvetica',
                               textColor=colors.HexColor('#a89880'),
                               alignment=TA_CENTER, spaceAfter=12)
    field_style = ParagraphStyle('field', parent=styles['Normal'],
                                 fontSize=8, fontName='Helvetica',
                                 textColor=colors.HexColor('#fef3e2'),
                                 alignment=TA_LEFT)
    label_style = ParagraphStyle('label', parent=styles['Normal'],
                                 fontSize=7, fontName='Helvetica',
                                 textColor=colors.HexColor('#a89880'),
                                 alignment=TA_LEFT)

    story = []

    for log in eld_logs:
        day_num  = log.get('day_number', 1)
        date_str = log.get('date', '')
        total_miles = trip_summary.get('total_miles', 0)

        # Header
        story.append(Paragraph('DRIVER\'S DAILY LOG', title_style))
        story.append(Paragraph('FMCSA 49 CFR § 395.8 — Required for Commercial Motor Vehicles', sub_style))

        # Info fields table
        info_data = [
            [Paragraph('Date', label_style),         Paragraph(date_str, field_style),
             Paragraph('Driver', label_style),        Paragraph(driver_name, field_style)],
            [Paragraph('Carrier', label_style),       Paragraph(carrier, field_style),
             Paragraph('Truck #', label_style),       Paragraph(truck_number or '—', field_style)],
            [Paragraph('Co-Driver', label_style),     Paragraph(co_driver or '—', field_style),
             Paragraph('Total Miles', label_style),   Paragraph(f"{round(total_miles)} mi", field_style)],
            [Paragraph('Day', label_style),           Paragraph(f"Day {day_num} of trip", field_style),
             Paragraph('Ruleset', label_style),       Paragraph(trip_summary.get('ruleset', '70/8'), field_style)],
        ]
        info_table = Table(info_data, colWidths=[0.8*inch, 2.2*inch, 0.8*inch, 2.2*inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#1f1b12')),
            ('GRID',       (0, 0), (-1, -1), 0.5, colors.HexColor('#3d3020')),
            ('PADDING',    (0, 0), (-1, -1), 4),
            ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.15 * inch))

        # Grid
        grid = _draw_grid(log, driver_name, carrier)
        story.append(grid)
        story.append(Spacer(1, 0.15 * inch))

        # Hours summary
        hours = log.get('hours_summary', {})
        hours_data = [[
            Paragraph(f"OFF: {hours.get('OFF', 0):.1f} hrs", field_style),
            Paragraph(f"SB: {hours.get('SB', 0):.1f} hrs", field_style),
            Paragraph(f"Driving: {hours.get('D', 0):.1f} hrs", field_style),
            Paragraph(f"On Duty: {hours.get('ON', 0):.1f} hrs", field_style),
            Paragraph(f"Total: {sum(hours.values()):.1f} / 24 hrs", field_style),
        ]]
        hours_table = Table(hours_data, colWidths=[1.3*inch]*5)
        hours_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#272115')),
            ('GRID',       (0, 0), (-1, -1), 0.5, colors.HexColor('#3d3020')),
            ('PADDING',    (0, 0), (-1, -1), 5),
            ('ALIGN',      (0, 0), (-1, -1), 'CENTER'),
        ]))
        story.append(hours_table)
        story.append(Spacer(1, 0.1 * inch))

        # Remarks / stops for this day
        day_stops = log.get('stops', [])
        if day_stops:
            remarks_data = [['Time (UTC)', 'Activity', 'Duration', 'Status']]
            for s in day_stops[:12]:  # max 12 rows per page
                remarks_data.append([
                    s.get('arrival', '')[:16].replace('T', ' '),
                    s.get('type', '').replace('_', ' ').title(),
                    f"{s.get('duration_hrs', 0):.1f} hrs",
                    s.get('duty_status', ''),
                ])
            rm_table = Table(remarks_data, colWidths=[1.3*inch, 2.8*inch, 1.0*inch, 0.9*inch])
            rm_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3d3020')),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#1f1b12')),
                ('TEXTCOLOR',  (0, 0), (-1, -1), colors.HexColor('#fef3e2')),
                ('FONTSIZE',   (0, 0), (-1, -1), 7),
                ('GRID',       (0, 0), (-1, -1), 0.5, colors.HexColor('#3d3020')),
                ('PADDING',    (0, 0), (-1, -1), 4),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1),
                 [colors.HexColor('#1f1b12'), colors.HexColor('#272115')]),
            ]))
            story.append(rm_table)

        # Page break between days
        if log != eld_logs[-1]:
            from reportlab.platypus import PageBreak
            story.append(PageBreak())

    doc.build(story)
    return buffer.getvalue()
