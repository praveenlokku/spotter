"""
ELD Log Sheet Builder.

Takes the list of stops produced by hos_calculator and converts them into
a list of daily duty-status grids (one per calendar day).

Each log entry:
{
    "date": "2024-01-15",
    "day_number": 1,
    "from_location": "Chicago, IL",
    "to_location": "Dallas, TX",
    "periods": [
        {"status": "OFF" | "SB" | "D" | "ON", "start_hour": 0.0, "end_hour": 6.5}
    ],
    "totals": {"OFF": hrs, "SB": hrs, "D": hrs, "ON": hrs}
}

Status codes:
    OFF  - Off duty
    SB   - Sleeper Berth
    D    - Driving
    ON   - On Duty Not Driving
"""

from datetime import datetime, timezone, timedelta, date
from collections import defaultdict


DUTY_STATUS_MAP = {
    "start":         "OFF",
    "driving":       "D",
    "rest_break":    "OFF",
    "sleeper_berth": "SB",
    "fuel":          "ON",
    "pickup":        "ON",
    "dropoff":       "ON",
}


def _parse_iso(iso_str: str) -> datetime:
    return datetime.fromisoformat(iso_str)


def _hour_of_day(dt: datetime) -> float:
    """Convert datetime to fractional hour of day (0–24)."""
    return dt.hour + dt.minute / 60 + dt.second / 3600


def build_eld_logs(stops: list, trip_locations: dict) -> list:
    """
    Convert a flat stops list into daily ELD log sheets.
    Returns a list of log dicts (one per calendar day).
    """
    if not stops:
        return []

    # Build a timeline of duty-status events
    # Each event: (start_dt, end_dt, status, location)
    events = []
    for stop in stops:
        arr = _parse_iso(stop["arrival"])
        dep = _parse_iso(stop["departure"])
        stop_type = stop["type"]

        if stop_type == "start":
            continue  # zero-duration, skip

        # While in transit to this stop, status is Driving (for non-start stops)
        # The driving time is BETWEEN stops, but our stops model only has stop events.
        # We need to infer driving segments between consecutive stops.
        events.append({
            "start": arr,
            "end": dep,
            "status": DUTY_STATUS_MAP.get(stop_type, "ON"),
            "location": stop.get("location", ""),
        })

    # Infer driving segments between stops
    # Sort all stops by arrival
    sorted_stops = sorted(stops, key=lambda s: _parse_iso(s["arrival"]))

    all_events = []
    for i in range(len(sorted_stops) - 1):
        curr = sorted_stops[i]
        nxt = sorted_stops[i + 1]
        curr_dep = _parse_iso(curr["departure"])
        nxt_arr = _parse_iso(nxt["arrival"])

        # Driving segment between this stop's departure and next stop's arrival
        if nxt_arr > curr_dep:
            all_events.append({
                "start": curr_dep,
                "end": nxt_arr,
                "status": "D",
                "location": curr.get("location", ""),
            })

        # The stop itself
        stop_type = sorted_stops[i + 1]["type"]
        if stop_type != "start":
            all_events.append({
                "start": nxt_arr,
                "end": _parse_iso(sorted_stops[i + 1]["departure"]),
                "status": DUTY_STATUS_MAP.get(stop_type, "ON"),
                "location": sorted_stops[i + 1].get("location", ""),
            })

    # Sort all events chronologically
    all_events.sort(key=lambda e: e["start"])

    # Group events by calendar date
    days: dict[date, list] = defaultdict(list)
    for event in all_events:
        start_dt = event["start"]
        end_dt = event["end"]
        if end_dt <= start_dt:
            continue

        # Split events that span midnight
        current = start_dt
        while current < end_dt:
            day = current.date()
            midnight_next = datetime(day.year, day.month, day.day, tzinfo=current.tzinfo) + timedelta(days=1)
            segment_end = min(end_dt, midnight_next)
            days[day].append({
                "start": current,
                "end": segment_end,
                "status": event["status"],
                "location": event["location"],
            })
            current = segment_end

    if not days:
        return []

    # Sort days and build log entries
    sorted_days = sorted(days.keys())
    trip_start = sorted_days[0]

    logs = []
    for day_num, day in enumerate(sorted_days, start=1):
        segs = sorted(days[day], key=lambda s: s["start"])

        periods = []
        totals = {"OFF": 0.0, "SB": 0.0, "D": 0.0, "ON": 0.0}

        # Fill gaps at start of day as OFF
        day_start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        if segs and segs[0]["start"] > day_start:
            gap_hrs = (segs[0]["start"] - day_start).total_seconds() / 3600
            periods.append({"status": "OFF", "start_hour": 0.0, "end_hour": round(gap_hrs, 3)})
            totals["OFF"] += gap_hrs

        for seg in segs:
            start_h = _hour_of_day(seg["start"])
            end_h = _hour_of_day(seg["end"])
            if seg["end"].date() > day:
                end_h = 24.0
            duration = end_h - start_h
            if duration <= 0:
                continue
            status = seg["status"]
            if status not in totals:
                status = "ON"
            periods.append({"status": status, "start_hour": round(start_h, 3), "end_hour": round(end_h, 3)})
            totals[status] = totals.get(status, 0) + duration

        # Fill remaining hours as OFF
        if periods and periods[-1]["end_hour"] < 24.0:
            gap_start = periods[-1]["end_hour"]
            periods.append({"status": "OFF", "start_hour": round(gap_start, 3), "end_hour": 24.0})
            totals["OFF"] += (24.0 - gap_start)

        # Merge consecutive same-status periods
        merged = []
        for p in periods:
            if merged and merged[-1]["status"] == p["status"] and abs(merged[-1]["end_hour"] - p["start_hour"]) < 0.01:
                merged[-1]["end_hour"] = p["end_hour"]
            else:
                merged.append(dict(p))

        # Determine from/to locations
        locations_today = [s["location"] for s in segs if s["location"]]
        from_loc = locations_today[0] if locations_today else ""
        to_loc = locations_today[-1] if locations_today else ""

        logs.append({
            "date": day.isoformat(),
            "day_number": day_num,
            "from_location": from_loc,
            "to_location": to_loc,
            "periods": merged,
            "totals": {k: round(v, 2) for k, v in totals.items()},
        })

    return logs
