from django.contrib import admin
from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('signup/', views.SignupView),
    path('login/', views.LoginView),
    path('send-login-otp/', views.SendLoginOTPView),
    path('verify-otp/', views.VerifyOTPView),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', views.ProfileView),
]