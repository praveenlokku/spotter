import csv
import io
import logging
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Trip
from .services.hos_calculator import calculate_trip_plan, compute_rolling_cycle_hours
from .services.eld_log_builder import build_eld_logs
from .services.pdf_generator import generate_eld_pdf

logger = logging.getLogger(__name__)


# ── Plan Trip ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def plan_trip(request):
    data = request.data
    required = ['current_location', 'pickup_location', 'dropoff_location']
    for field in required:
        if not data.get(field, '').strip():
            return Response({'error': f"'{field}' is required."}, status=400)

    try:
        result = calculate_trip_plan(
            current_location       = data['current_location'].strip(),
            pickup_location        = data['pickup_location'].strip(),
            dropoff_location       = data['dropoff_location'].strip(),
            current_cycle_used_hrs = float(data.get('current_cycle_used_hrs', 0)),
            ruleset                = data.get('ruleset', '70_8'),
            adverse_conditions     = bool(data.get('adverse_conditions', False)),
            short_haul             = bool(data.get('short_haul', False)),
            split_sleeper_berth    = bool(data.get('split_sleeper_berth', False)),
            waypoints              = data.get('waypoints', []),
        )
    except ValueError as e:
        logger.warning("Trip plan error (user %s): %s", request.user.id, e)
        return Response({'error': str(e)}, status=400)
    except Exception as e:
        logger.exception("Unexpected error in plan_trip for user %s", request.user.id)
        return Response({'error': f"Route calculation failed: {e}"}, status=500)

    # Build ELD logs from stops
    eld_logs = build_eld_logs(result['stops'])

    summary = result.get('summary', {})

    # Save trip
    trip = Trip.objects.create(
        user                   = request.user,
        current_location       = data['current_location'].strip(),
        pickup_location        = data['pickup_location'].strip(),
        dropoff_location       = data['dropoff_location'].strip(),
        current_cycle_used_hrs = float(data.get('current_cycle_used_hrs', 0)),
        ruleset                = data.get('ruleset', '70_8'),
        adverse_conditions     = bool(data.get('adverse_conditions', False)),
        short_haul             = bool(data.get('short_haul', False)),
        split_sleeper_berth    = bool(data.get('split_sleeper_berth', False)),
        carrier_name           = data.get('carrier_name', 'Independent'),
        truck_number           = data.get('truck_number', ''),
        co_driver_name         = data.get('co_driver_name', ''),
        stops_data             = result['stops'],
        route_data             = result['route'],
        eld_logs_data          = eld_logs,
        summary_data           = summary,
        locations_data         = result.get('locations', {}),
        total_miles            = summary.get('total_miles', 0),
        total_hours            = summary.get('total_hours', 0),
        num_days               = summary.get('num_days', 0),
    )

    return Response({
        'trip_id':   trip.id,
        'stops':     result['stops'],
        'route':     result['route'],
        'eld_logs':  eld_logs,
        'summary':   summary,
        'locations': result.get('locations', {}),
    })


# ── Trip History ──────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def trip_history(request):
    trips = Trip.objects.filter(user=request.user).values(
        'id', 'current_location', 'pickup_location', 'dropoff_location',
        'current_cycle_used_hrs', 'ruleset', 'total_miles', 'total_hours',
        'num_days', 'adverse_conditions', 'short_haul', 'created_at',
    )
    return Response(list(trips))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def trip_detail(request, trip_id):
    try:
        trip = Trip.objects.get(id=trip_id, user=request.user)
    except Trip.DoesNotExist:
        return Response({'error': 'Trip not found'}, status=404)
    return Response({
        'id':                    trip.id,
        'current_location':      trip.current_location,
        'pickup_location':       trip.pickup_location,
        'dropoff_location':      trip.dropoff_location,
        'current_cycle_used_hrs': trip.current_cycle_used_hrs,
        'ruleset':               trip.ruleset,
        'adverse_conditions':    trip.adverse_conditions,
        'short_haul':            trip.short_haul,
        'split_sleeper_berth':   trip.split_sleeper_berth,
        'carrier_name':          trip.carrier_name,
        'truck_number':          trip.truck_number,
        'co_driver_name':        trip.co_driver_name,
        'stops_data':            trip.stops_data,
        'route_data':            trip.route_data,
        'eld_logs_data':         trip.eld_logs_data,
        'summary_data':          trip.summary_data,
        'locations_data':        trip.locations_data,
        'total_miles':           trip.total_miles,
        'total_hours':           trip.total_hours,
        'num_days':              trip.num_days,
        'created_at':            trip.created_at,
    })


# ── Rolling Cycle Hours ───────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def rolling_cycle_hours(request):
    """Returns actual cycle hours used from trip history in the last 7/8 days."""
    ruleset = request.query_params.get('ruleset', '70_8')
    hours   = compute_rolling_cycle_hours(request.user, ruleset=ruleset)
    return Response({'cycle_hours_used': hours, 'ruleset': ruleset})


# ── PDF Export ───────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_pdf(request, trip_id):
    try:
        trip = Trip.objects.get(id=trip_id, user=request.user)
    except Trip.DoesNotExist:
        return Response({'error': 'Trip not found'}, status=404)

    try:
        pdf_bytes = generate_eld_pdf(
            eld_logs    = trip.eld_logs_data,
            trip_summary = trip.summary_data,
            driver_name = request.user.username,
            carrier     = trip.carrier_name or 'Independent',
            truck_number = trip.truck_number or '',
            co_driver   = trip.co_driver_name or '',
        )
    except Exception as e:
        logger.exception("PDF generation failed for trip %s", trip_id)
        return Response({'error': f"PDF generation failed: {e}"}, status=500)

    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="ELD_Log_Trip_{trip_id}.pdf"'
    return response


# ── CSV Export ───────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_csv(request, trip_id):
    try:
        trip = Trip.objects.get(id=trip_id, user=request.user)
    except Trip.DoesNotExist:
        return Response({'error': 'Trip not found'}, status=404)

    out = io.StringIO()
    writer = csv.writer(out)

    # Header info
    writer.writerow(['Spotter ELD — Trip Export'])
    writer.writerow(['Driver', request.user.username])
    writer.writerow(['Carrier', trip.carrier_name or 'Independent'])
    writer.writerow(['Truck #', trip.truck_number or '—'])
    writer.writerow(['From',    trip.current_location])
    writer.writerow(['Pickup',  trip.pickup_location])
    writer.writerow(['Dropoff', trip.dropoff_location])
    writer.writerow(['Ruleset', trip.ruleset])
    writer.writerow(['Total Miles',  trip.total_miles])
    writer.writerow(['Total Hours',  trip.total_hours])
    writer.writerow(['Adverse Conditions', trip.adverse_conditions])
    writer.writerow(['Short Haul', trip.short_haul])
    writer.writerow([])

    # Stops table
    writer.writerow(['Stop #', 'Type', 'Arrival (UTC)', 'Duration (hrs)', 'Duty Status', 'Location', 'Notes'])
    for i, stop in enumerate(trip.stops_data, 1):
        writer.writerow([
            i,
            stop.get('type', ''),
            stop.get('arrival', ''),
            stop.get('duration_hrs', ''),
            stop.get('duty_status', ''),
            stop.get('location', ''),
            stop.get('notes', ''),
        ])

    out.seek(0)
    response = HttpResponse(out.getvalue(), content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="ELD_Trip_{trip_id}.csv"'
    return response
