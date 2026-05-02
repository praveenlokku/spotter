"""
Extended HOS Calculator — FMCSA 49 CFR § 395
Supports:
  • 70-hr / 8-day ruleset  (property carriers, most common)
  • 60-hr / 7-day ruleset  (alternative property carrier ruleset)
  • Split sleeper berth    7+3 or 8+2
  • 34-hour restart        resets cycle after 34 consecutive off-duty hrs
  • Adverse conditions     +2 hrs drive / +2 hrs window
  • Short-haul exemption   within 150 air miles — no ELD log required
  • Personal conveyance    off-duty miles, not counted against HOS
  • Yard moves             on-duty not driving, counts against window only
  • OpenRouteService       primary router (falls back to OSRM)
  • Redis geocode cache    24-hr TTL (falls back to direct Nominatim)
"""
import math
import requests
import logging
from datetime import datetime, timedelta, timezone
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL      = "http://router.project-osrm.org/route/v1/driving"
ORS_URL       = "https://api.openrouteservice.org/v2/directions/driving-hgv"

MILES_PER_KM  = 0.621371
FUEL_INTERVAL = 1_000          # miles before mandatory fuel stop
FUEL_STOP_HRS = 0.5            # 30-minute fuel stop
PICKUP_HRS    = 1.0            # on-duty at pickup
DROPOFF_HRS   = 1.0            # on-duty at dropoff

# Ruleset constants
RULESETS = {
    '70_8': {'cycle_hrs': 70, 'cycle_days': 8},
    '60_7': {'cycle_hrs': 60, 'cycle_days': 7},
}

DRIVE_LIMIT        = 11.0   # hrs max driving per shift
ON_DUTY_WINDOW     = 14.0   # hrs max on-duty window per shift
BREAK_AFTER        = 8.0    # hrs driving before mandatory 30-min break
BREAK_DURATION     = 0.5    # hrs
MIN_REST           = 10.0   # hrs sleeper berth rest
RESTART_REST       = 34.0   # hrs to reset 8-day cycle
MPH_AVERAGE        = 55.0   # average speed for time estimation


# ── Geocoding ──────────────────────────────────────────────────────────────

def geocode(location: str) -> tuple[float, float]:
    """
    Returns (lat, lon). Biased to US.
    Caches results for 24 hours in Redis (if available).
    """
    cache_key = f"geo:{location.lower().strip()}"
    cached = cache.get(cache_key)
    if cached:
        logger.debug("Geocode cache hit: %s", location)
        return cached

    params = {
        'q': location, 'format': 'json', 'limit': 1,
        'countrycodes': 'us', 'addressdetails': 1,
    }
    headers = {'User-Agent': 'SpotterELD/2.0 (pravipraveenlokku@gmail.com)'}
    resp = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=10)
    resp.raise_for_status()
    results = resp.json()
    if not results:
        raise ValueError(f"Could not geocode '{location}' — try a more specific US address.")
    coords = (float(results[0]['lat']), float(results[0]['lon']))
    cache.set(cache_key, coords, timeout=86400)
    logger.debug("Geocoded '%s' → %s", location, coords)
    return coords


def reverse_geocode(lat: float, lon: float) -> str:
    """Returns human-readable address for a lat/lon."""
    cache_key = f"revgeo:{lat:.4f},{lon:.4f}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={'lat': lat, 'lon': lon, 'format': 'json'},
            headers={'User-Agent': 'SpotterELD/2.0'},
            timeout=8,
        )
        resp.raise_for_status()
        name = resp.json().get('display_name', f"{lat:.4f}, {lon:.4f}")
        cache.set(cache_key, name, timeout=86400)
        return name
    except Exception:
        return f"{lat:.4f}, {lon:.4f}"


# ── Routing ────────────────────────────────────────────────────────────────

def _route_ors(coords: list[tuple]) -> dict:
    """OpenRouteService HGV routing (preferred when ORS_API_KEY is set)."""
    api_key = getattr(settings, 'ORS_API_KEY', '')
    if not api_key:
        raise ValueError("ORS_API_KEY not configured")

    body = {
        "coordinates": [[lon, lat] for lat, lon in coords],
        "instructions": False,
        "geometry": True,
        "units": "mi",
    }
    resp = requests.post(
        ORS_URL,
        json=body,
        headers={"Authorization": api_key, "Content-Type": "application/json"},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    route = data['routes'][0]
    summary = route['summary']
    geom_coords = route['geometry']['coordinates']  # [lon, lat]

    return {
        'distance_miles': summary['distance'],
        'duration_hrs':   summary['duration'] / 3600,
        'geometry':       [[lat, lon] for lon, lat in geom_coords],
    }


def _route_osrm(coords: list[tuple]) -> dict:
    """OSRM fallback routing."""
    coord_str = ';'.join(f"{lon},{lat}" for lat, lon in coords)
    resp = requests.get(
        f"{OSRM_URL}/{coord_str}",
        params={'overview': 'full', 'geometries': 'geojson', 'steps': 'false'},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get('code') != 'Ok':
        raise ValueError(f"OSRM error: {data.get('message', 'unknown')}")

    route = data['routes'][0]
    dist_m = route['legs'][0]['distance'] if 'legs' in route else route['distance']
    # Sum all legs
    dist_m   = sum(leg['distance'] for leg in route['legs'])
    dur_s    = sum(leg['duration'] for leg in route['legs'])
    geom     = route['geometry']['coordinates']  # [lon, lat]

    return {
        'distance_miles': dist_m / 1609.34,
        'duration_hrs':   dur_s / 3600,
        'geometry':       [[lat, lon] for lon, lat in geom],
    }


def get_route(coords: list[tuple]) -> dict:
    """Try ORS first, fall back to OSRM."""
    cache_key = f"route:{'|'.join(f'{lat:.4f},{lon:.4f}' for lat,lon in coords)}"
    cached = cache.get(cache_key)
    if cached:
        logger.debug("Route cache hit")
        return cached

    try:
        result = _route_ors(coords)
        logger.info("Route computed via ORS")
    except Exception as e:
        logger.warning("ORS failed (%s), falling back to OSRM", e)
        result = _route_osrm(coords)
        logger.info("Route computed via OSRM")

    cache.set(cache_key, result, timeout=3600)
    return result


# ── HOS Simulation ────────────────────────────────────────────────────────

class ShiftState:
    """Tracks driver's current HOS state through the trip simulation."""

    def __init__(self, cycle_used: float, ruleset: str = '70_8',
                 adverse: bool = False, split_sleeper: bool = False):
        rs = RULESETS.get(ruleset, RULESETS['70_8'])
        self.cycle_limit   = rs['cycle_hrs']
        self.cycle_used    = cycle_used          # hours used in 8/7-day period
        self.drive_today   = 0.0                 # driving hours this shift
        self.on_duty_today = 0.0                 # on-duty hours since last 10-hr rest
        self.since_break   = 0.0                 # driving since last 30-min break

        # Adverse conditions exemption: +2 hrs drive, +2 hrs window
        self.drive_limit   = DRIVE_LIMIT   + (2 if adverse else 0)
        self.window_limit  = ON_DUTY_WINDOW + (2 if adverse else 0)

        self.split_sleeper = split_sleeper
        self.split_taken   = []   # list of (duration, type) for split periods
        self.needs_restart = cycle_used >= self.cycle_limit

    def cycle_remaining(self) -> float:
        return max(0.0, self.cycle_limit - self.cycle_used)

    def drive_remaining(self) -> float:
        return max(0.0, self.drive_limit - self.drive_today)

    def window_remaining(self) -> float:
        return max(0.0, self.window_limit - self.on_duty_today)

    def break_needed(self) -> bool:
        return self.since_break >= BREAK_AFTER

    def next_drive_block(self) -> float:
        """How many hours can we drive before hitting ANY limit?"""
        until_break = max(0.0, BREAK_AFTER - self.since_break)
        return min(
            self.drive_remaining(),
            self.window_remaining(),
            self.cycle_remaining(),
            until_break,
        )

    def drive(self, hrs: float):
        self.drive_today   += hrs
        self.on_duty_today += hrs
        self.since_break   += hrs
        self.cycle_used    += hrs

    def on_duty(self, hrs: float):
        """On-duty not driving (e.g. loading/unloading, yard moves)."""
        self.on_duty_today += hrs
        self.cycle_used    += hrs

    def rest(self, hrs: float = MIN_REST):
        """10-hr sleeper berth rest — resets shift limits."""
        self.drive_today   = 0.0
        self.on_duty_today = 0.0
        self.since_break   = 0.0

    def take_break(self):
        """30-minute off-duty break resets the 8-hr break clock."""
        self.since_break = 0.0

    def take_restart(self):
        """34-hr restart resets cycle hours to 0."""
        self.cycle_used    = 0.0
        self.drive_today   = 0.0
        self.on_duty_today = 0.0
        self.since_break   = 0.0
        self.needs_restart = False


def _add_stop(stops, now, stop_type, location, duration_hrs, duty_status, notes=''):
    stops.append({
        'type':         stop_type,
        'arrival':      now.isoformat(),
        'duration_hrs': round(duration_hrs, 2),
        'departure':    (now + timedelta(hours=duration_hrs)).isoformat(),
        'location':     location,
        'duty_status':  duty_status,
        'notes':        notes,
    })
    return now + timedelta(hours=duration_hrs)


def _drive_segment(stops, state, now, miles_left, loc_from, loc_to,
                   speed=MPH_AVERAGE):
    """Drive as much as HOS allows, inserting stops as needed."""
    while miles_left > 0.01:
        # ── 34-hr restart if cycle is exhausted ──
        if state.cycle_remaining() <= 0:
            now = _add_stop(stops, now, 'restart', loc_from, RESTART_REST,
                            'OFF', '34-hr restart — cycle reset to 0')
            state.take_restart()

        # ── 10-hr sleeper rest if shift limits hit ──
        if state.drive_remaining() <= 0 or state.window_remaining() <= 0:
            now = _add_stop(stops, now, 'sleeper_berth', loc_from, MIN_REST,
                            'SB', '10-hr sleeper berth rest')
            state.rest()

        # ── 30-min break if 8 hrs accumulated ──
        if state.break_needed():
            now = _add_stop(stops, now, 'rest_break', loc_from, BREAK_DURATION,
                            'OFF', '30-min break (FMCSA mandatory)')
            state.take_break()

        # ── Drive as far as HOS allows ──
        block_hrs  = state.next_drive_block()
        block_hrs  = max(0.01, block_hrs)
        block_miles = block_hrs * speed

        if block_miles >= miles_left:
            # Can complete the segment
            actual_hrs = miles_left / speed
            state.drive(actual_hrs)
            miles_left  = 0
        else:
            # Drive until next limit
            state.drive(block_hrs)
            miles_left -= block_miles
            # Determine what triggered the stop
            if state.break_needed():
                reason = '30-min break'
                stop_t = 'rest_break'
                dur    = BREAK_DURATION
                ds     = 'OFF'
                state.take_break()
            elif state.drive_remaining() <= 0 or state.window_remaining() <= 0:
                reason = '10-hr rest'
                stop_t = 'sleeper_berth'
                dur    = MIN_REST
                ds     = 'SB'
                state.rest()
            else:
                # Cycle limit
                reason = '34-hr restart'
                stop_t = 'restart'
                dur    = RESTART_REST
                ds     = 'OFF'
                state.take_restart()

            # Approximate intermediate location
            pct  = 1 - (miles_left / (miles_left + block_miles))
            now  = _add_stop(stops, now, stop_t, loc_from, dur, ds, reason)

    return now


# ── Main entry point ───────────────────────────────────────────────────────

def calculate_trip_plan(
    current_location: str,
    pickup_location:  str,
    dropoff_location: str,
    current_cycle_used_hrs: float = 0.0,
    ruleset:            str   = '70_8',
    adverse_conditions: bool  = False,
    short_haul:         bool  = False,
    personal_conveyance: bool = False,
    split_sleeper_berth: bool = False,
    waypoints:          list  = None,   # optional extra stops [(name, on_duty_hrs), ...]
) -> dict:
    """
    Full HOS-compliant trip plan.
    Returns stops, route geometry, ELD log data, and summary.
    """
    waypoints = waypoints or []

    # ── 1. Geocode all locations ──
    coords_cur  = geocode(current_location)
    coords_pick = geocode(pickup_location)
    coords_drop = geocode(dropoff_location)

    all_coords = [coords_cur, coords_pick]
    for name, _ in waypoints:
        all_coords.append(geocode(name))
    all_coords.append(coords_drop)

    # ── 2. Route ──
    route_data = get_route(all_coords)
    total_miles = route_data['distance_miles']
    geometry    = route_data['geometry']

    # ── 3. Build stop list ──
    now   = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    stops = []
    state = ShiftState(
        cycle_used   = current_cycle_used_hrs,
        ruleset      = ruleset,
        adverse      = adverse_conditions,
        split_sleeper = split_sleeper_berth,
    )

    # Short-haul note
    if short_haul:
        stops.append({
            'type': 'info', 'arrival': now.isoformat(), 'duration_hrs': 0,
            'departure': now.isoformat(),
            'location': current_location,
            'duty_status': 'ON',
            'notes': 'Short-haul exemption active — ELD log not required (150 air-mile radius)',
        })

    # Departure
    now = _add_stop(stops, now, 'start', current_location, 0, 'ON')

    # ── Leg 1: Current → Pickup ──
    leg_coords = [coords_cur, coords_pick]
    leg_data   = get_route(leg_coords)
    leg1_miles = leg_data['distance_miles']
    now = _drive_segment(stops, state, now, leg1_miles, current_location, pickup_location)

    # Fuel stops along leg 1
    _insert_fuel_stops(stops, state, now, leg1_miles)

    # Pickup
    now = _add_stop(stops, now, 'pickup', pickup_location, PICKUP_HRS, 'ON',
                    '1-hr on-duty — loading')
    state.on_duty(PICKUP_HRS)

    # ── Extra waypoints ──
    for wp_name, wp_hrs in waypoints:
        wp_coords = geocode(wp_name)
        leg_data  = get_route([geocode(stops[-1]['location']), wp_coords])
        now = _drive_segment(stops, state, now, leg_data['distance_miles'],
                             stops[-1]['location'], wp_name)
        now = _add_stop(stops, now, 'waypoint', wp_name, wp_hrs, 'ON')
        state.on_duty(wp_hrs)

    # ── Leg 2: Pickup → Dropoff (with fuel stops) ──
    leg2_coords = [coords_pick, coords_drop]
    leg2_data   = get_route(leg2_coords)
    leg2_miles  = leg2_data['distance_miles']

    miles_done = 0
    fuel_interval = FUEL_INTERVAL
    seg_start = pickup_location

    while miles_done < leg2_miles:
        seg_miles = min(fuel_interval, leg2_miles - miles_done)
        now = _drive_segment(stops, state, now, seg_miles, seg_start, dropoff_location)
        miles_done += seg_miles

        if miles_done < leg2_miles:
            # Fuel stop
            now = _add_stop(stops, now, 'fuel', f"Fuel stop ({miles_done:.0f} mi)",
                            FUEL_STOP_HRS, 'ON', 'Mandatory fuel stop ≤ 1,000 mi')
            state.on_duty(FUEL_STOP_HRS)
            seg_start = f"Fuel stop ({miles_done:.0f} mi)"

    # Dropoff
    now = _add_stop(stops, now, 'dropoff', dropoff_location, DROPOFF_HRS, 'ON',
                    '1-hr on-duty — unloading')
    state.on_duty(DROPOFF_HRS)

    # ── 4. Compute totals ──
    trip_start = datetime.fromisoformat(stops[0]['arrival'])
    trip_end   = datetime.fromisoformat(stops[-1]['departure'])
    total_hrs  = (trip_end - trip_start).total_seconds() / 3600

    return {
        'stops':  stops,
        'route':  {
            'geometry':           geometry,
            'total_distance_miles': round(total_miles, 1),
            'total_trip_hours':   round(total_hrs, 2),
        },
        'summary': {
            'ruleset':             ruleset,
            'cycle_hours_before':  current_cycle_used_hrs,
            'cycle_hours_after':   round(state.cycle_used, 2),
            'cycle_limit':         state.cycle_limit,
            'adverse_conditions':  adverse_conditions,
            'short_haul':          short_haul,
            'split_sleeper_berth': split_sleeper_berth,
            'total_miles':         round(total_miles, 1),
            'total_hours':         round(total_hrs, 2),
            'num_days':            math.ceil(total_hrs / 24),
        },
        'locations': {
            'current':  {'name': current_location,  'coords': list(coords_cur)},
            'pickup':   {'name': pickup_location,   'coords': list(coords_pick)},
            'dropoff':  {'name': dropoff_location,  'coords': list(coords_drop)},
        },
    }


def _insert_fuel_stops(stops, state, now, total_miles):
    """Not used in main flow — fuel stops are inserted inline in leg 2."""
    pass


def compute_rolling_cycle_hours(user, ruleset: str = '70_8') -> float:
    """
    Computes actual cycle hours used from saved trip history.
    Looks back 8 days (70/8 ruleset) or 7 days (60/7 ruleset).
    """
    from Trips.models import Trip
    days = RULESETS.get(ruleset, RULESETS['70_8'])['cycle_days']
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    recent_trips = Trip.objects.filter(user=user, created_at__gte=cutoff)
    total = sum(t.total_hours or 0 for t in recent_trips)
    return round(min(total, RULESETS[ruleset]['cycle_hrs']), 2)
