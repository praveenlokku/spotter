"""
Bulletproof CORS middleware — adds Access-Control-Allow-Origin to every response.
This bypasses django-cors-headers entirely and works regardless of settings.
Safe for assignment use — JWT auth is header-based, not cookie-based.
"""
from django.http import HttpResponse


class ForceCORSMiddleware:
    """
    Injects CORS headers on ALL responses, including preflight OPTIONS.
    Must be the FIRST middleware in MIDDLEWARE list.
    """

    ALLOW_HEADERS = (
        'authorization, content-type, accept, x-requested-with, '
        'x-csrftoken, origin, cache-control'
    )
    ALLOW_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Handle preflight immediately — don't let it reach Django views
        if request.method == 'OPTIONS':
            response = HttpResponse(status=200)
            self._add_headers(request, response)
            return response

        response = self.get_response(request)
        self._add_headers(request, response)
        return response

    def _add_headers(self, request, response):
        origin = request.META.get('HTTP_ORIGIN', '*')
        response['Access-Control-Allow-Origin']  = origin
        response['Access-Control-Allow-Methods'] = self.ALLOW_METHODS
        response['Access-Control-Allow-Headers'] = self.ALLOW_HEADERS
        response['Access-Control-Allow-Credentials'] = 'false'
        response['Access-Control-Max-Age'] = '86400'
        response['Vary'] = 'Origin'
