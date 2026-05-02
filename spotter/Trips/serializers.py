from rest_framework import serializers
from .models import Trip


class TripInputSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=500)
    pickup_location = serializers.CharField(max_length=500)
    dropoff_location = serializers.CharField(max_length=500)
    current_cycle_used_hrs = serializers.FloatField(min_value=0.0, max_value=70.0, default=0.0)


class TripSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = [
            'id', 'current_location', 'pickup_location', 'dropoff_location',
            'current_cycle_used_hrs', 'route_data', 'stops_data', 'eld_logs_data',
            'created_at'
        ]
        read_only_fields = ['id', 'route_data', 'stops_data', 'eld_logs_data', 'created_at']


class TripListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the history list (no heavy JSON fields)."""
    total_miles = serializers.SerializerMethodField()
    total_hours = serializers.SerializerMethodField()
    num_days = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            'id', 'current_location', 'pickup_location', 'dropoff_location',
            'current_cycle_used_hrs', 'total_miles', 'total_hours', 'num_days', 'created_at'
        ]

    def get_total_miles(self, obj):
        return obj.route_data.get('total_distance_miles', 0) if obj.route_data else 0

    def get_total_hours(self, obj):
        return obj.route_data.get('total_trip_hours', 0) if obj.route_data else 0

    def get_num_days(self, obj):
        return len(obj.eld_logs_data) if obj.eld_logs_data else 0
