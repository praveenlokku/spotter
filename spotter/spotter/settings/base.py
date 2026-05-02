"""
BASE settings — shared across all environments.
Do NOT import this directly. Use local.py or prod.py.
"""
from pathlib import Path
import dj_database_url
from dotenv import load_dotenv
import os
from datetime import timedelta

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'change-me-in-production')

ALLOWED_HOSTS = ['*']

# CORS — allow all for JWT header-based auth (safe — no cookies used)
CORS_ALLOW_ALL_ORIGINS   = True
CORS_ALLOW_CREDENTIALS   = False

AUTH_USER_MODEL = 'users.User'

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'users',
    'Trips',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'spotter.urls'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

WSGI_APPLICATION = 'spotter.wsgi.application'

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("Database_url")
DATABASES = {
    "default": dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=60,
        conn_health_checks=True,
    )
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '30/min',
        'user': '120/min',
    },
}

# JWT — token rotation + blacklist enabled
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':   timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME':  timedelta(days=7),
    'ROTATE_REFRESH_TOKENS':   True,
    'BLACKLIST_AFTER_ROTATION': True,   # ← now enabled
    'AUTH_HEADER_TYPES': ('Bearer',),
}

OTP_EXPIRY_MINUTES = 10

# Email
_email_pw = os.getenv('EMAIL_HOST_PASSWORD', '')
if _email_pw:
    EMAIL_BACKEND    = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST       = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT       = int(os.getenv('EMAIL_PORT', 587))
    EMAIL_USE_TLS    = True
    EMAIL_HOST_USER  = os.getenv('EMAIL_HOST_USER', 'pravipraveenlokku@gmail.com')
    EMAIL_HOST_PASSWORD = _email_pw
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'Spotter ELD <pravipraveenlokku@gmail.com>')

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Redis / Celery (optional — falls back gracefully if Redis not available)
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

_redis_available = bool(os.getenv('REDIS_URL'))
if _redis_available:
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': REDIS_URL,
            'OPTIONS': {'CLIENT_CLASS': 'django_redis.client.DefaultClient'},
            'TIMEOUT': 86400,  # 24 hours — for geocode caching
        }
    }
    CELERY_BROKER_URL        = REDIS_URL
    CELERY_RESULT_BACKEND    = REDIS_URL
    CELERY_TASK_SERIALIZER   = 'json'
    CELERY_RESULT_SERIALIZER = 'json'
    CELERY_ACCEPT_CONTENT    = ['json']
else:
    CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}

# Sentry error tracking (optional)
_sentry_dsn = os.getenv('SENTRY_DSN', '')
if _sentry_dsn:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=_sentry_dsn,
            traces_sample_rate=0.2,
            profiles_sample_rate=0.1,
        )
    except ImportError:
        pass

# OpenRouteService routing (falls back to OSRM if not set)
ORS_API_KEY = os.getenv('ORS_API_KEY', '')
