from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.throttling import AnonRateThrottle
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from .models import User, OTPCode
from .utils import send_otp_email
import logging

logger = logging.getLogger(__name__)


class AuthRateThrottle(AnonRateThrottle):
    """Strict throttle for auth endpoints — 10 requests/min per IP."""
    rate = '10/min'


def _create_and_send_otp(user, purpose):
    """Invalidate old OTPs, create a new one, send via email."""
    OTPCode.objects.filter(user=user, purpose=purpose, is_used=False).update(is_used=True)
    code = OTPCode.generate_code()
    expires_at = timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
    otp = OTPCode.objects.create(user=user, code=code, purpose=purpose, expires_at=expires_at)
    send_otp_email(user.email, code, purpose)
    return otp


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def SignupView(request):
    username = request.data.get('username', '').strip()
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')

    if not username or not email or not password:
        return Response({'error': 'All fields are required.'}, status=400)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'An account with this email already exists.'}, status=400)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'This username is already taken.'}, status=400)

    user = User.objects.create_user(
        username=username, email=email, password=password, is_verified=False
    )
    _create_and_send_otp(user, OTPCode.PURPOSE_SIGNUP)
    return Response({
        'message': 'Account created. A 6-digit OTP has been sent to your email.',
        'email': email,
        'next': 'verify-otp',
        'purpose': 'signup',
    }, status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def LoginView(request):
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')

    if not email or not password:
        return Response({'error': 'Email and password are required.'}, status=400)

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'No account found with this email.'}, status=404)

    if not user.check_password(password):
        return Response({'error': 'Incorrect password.'}, status=401)

    if not user.is_verified:
        _create_and_send_otp(user, OTPCode.PURPOSE_SIGNUP)
        return Response({
            'error': 'Email not verified.',
            'message': 'A new OTP has been sent to your email to complete verification.',
            'email': email,
            'next': 'verify-otp',
            'purpose': 'signup',
        }, status=403)

    _create_and_send_otp(user, OTPCode.PURPOSE_LOGIN)
    return Response({
        'message': 'OTP sent to your email. Please verify to complete login.',
        'email': email,
        'next': 'verify-otp',
        'purpose': 'login',
    }, status=200)


@api_view(['POST'])
@permission_classes([AllowAny])
def VerifyOTPView(request):
    email = request.data.get('email', '').strip().lower()
    code = request.data.get('code', '').strip()
    purpose = request.data.get('purpose', '')

    if not email or not code or not purpose:
        return Response({'error': 'email, code, and purpose are required.'}, status=400)

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=404)

    otp = OTPCode.objects.filter(
        user=user, purpose=purpose, is_used=False
    ).order_by('-created_at').first()

    if not otp or not otp.is_valid():
        return Response({'error': 'OTP has expired or is invalid. Please request a new one.'}, status=400)

    if otp.code != code:
        return Response({'error': 'Incorrect OTP code.'}, status=400)

    otp.is_used = True
    otp.save()

    if purpose == OTPCode.PURPOSE_SIGNUP:
        user.is_verified = True
        user.save()

    # Issue JWT tokens
    refresh = RefreshToken.for_user(user)
    return Response({
        'message': 'Verification successful.',
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
        }
    }, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ProfileView(request):
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'role': user.role,
        'is_verified': user.is_verified,
    })