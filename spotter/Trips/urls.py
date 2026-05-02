from django.urls import path
from . import views

urlpatterns = [
    path('plan/',                    views.plan_trip,           name='plan_trip'),
    path('history/',                 views.trip_history,        name='trip_history'),
    path('<int:trip_id>/',           views.trip_detail,         name='trip_detail'),
    path('cycle-hours/',             views.rolling_cycle_hours, name='rolling_cycle_hours'),
    path('<int:trip_id>/pdf/',       views.export_pdf,          name='export_pdf'),
    path('<int:trip_id>/csv/',       views.export_csv,          name='export_csv'),
]
