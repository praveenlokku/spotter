from django.db import models
from django.conf import settings


class Trip(models.Model):
    """Stores a complete HOS trip plan."""

    RULESET_CHOICES = [
        ('70_8', '70 hrs / 8 days'),
        ('60_7', '60 hrs / 7 days'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='trips'
    )

    # Inputs
    current_location  = models.CharField(max_length=500)
    pickup_location   = models.CharField(max_length=500)
    dropoff_location  = models.CharField(max_length=500)
    current_cycle_used_hrs = models.FloatField(default=0.0)
    ruleset           = models.CharField(max_length=10, choices=RULESET_CHOICES, default='70_8')

    # HOS options
    adverse_conditions   = models.BooleanField(default=False)
    short_haul           = models.BooleanField(default=False)
    split_sleeper_berth  = models.BooleanField(default=False)

    # Carrier info (for PDF)
    carrier_name   = models.CharField(max_length=200, blank=True, default='Independent')
    truck_number   = models.CharField(max_length=50,  blank=True, default='')
    co_driver_name = models.CharField(max_length=200, blank=True, default='')

    # Computed outputs (JSON blobs)
    stops_data    = models.JSONField(default=list)
    route_data    = models.JSONField(default=dict)
    eld_logs_data = models.JSONField(default=list)
    summary_data  = models.JSONField(default=dict)
    locations_data = models.JSONField(default=dict)

    # Summary scalars (for history list view — avoid loading full JSON)
    total_miles   = models.FloatField(default=0.0)
    total_hours   = models.FloatField(default=0.0)
    num_days      = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes  = [models.Index(fields=['user', 'created_at'])]

    def __str__(self):
        return f"{self.user.username}: {self.current_location} → {self.dropoff_location}"
