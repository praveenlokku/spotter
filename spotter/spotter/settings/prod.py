"""Production settings — hardened security, no DEBUG."""
from .base import *  # noqa
import os

DEBUG = False

SECRET_KEY = os.environ['SECRET_KEY']  # Crashes fast if not set in Railway

ALLOWED_HOSTS = [
    '.railway.app',
    '.up.railway.app',
    os.getenv('PROD_HOST', ''),   # custom domain if you add one
]

# CORS — allow your Vercel frontend (and any preview deployments)
CORS_ALLOWED_ORIGINS = [
    os.getenv('FRONTEND_URL', ''),   # e.g. https://spotter-eld.vercel.app
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.vercel\.app$",    # all Vercel preview URLs
]
CORS_ALLOW_CREDENTIALS = True

# HTTPS enforcement (Railway always serves HTTPS)
SECURE_SSL_REDIRECT             = False   # Railway handles SSL termination — don't redirect
SESSION_COOKIE_SECURE           = True
CSRF_COOKIE_SECURE              = True
SECURE_HSTS_SECONDS             = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS  = True
SECURE_HSTS_PRELOAD             = True
SECURE_PROXY_SSL_HEADER         = ('HTTP_X_FORWARDED_PROTO', 'https')

# Production logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'WARNING'},
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'Trips':  {'handlers': ['console'], 'level': 'INFO',    'propagate': False},
    },
}
