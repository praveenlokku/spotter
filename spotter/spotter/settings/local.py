"""Local development settings — verbose errors, no HTTPS enforcement."""
from .base import *  # noqa

DEBUG = True
SECRET_KEY = 'local-dev-secret-key-not-used-in-prod'

ALLOWED_HOSTS = ['*']

# Show SQL queries in dev
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'INFO'},
        'Trips':  {'handlers': ['console'], 'level': 'DEBUG'},
        'users':  {'handlers': ['console'], 'level': 'DEBUG'},
    },
}
