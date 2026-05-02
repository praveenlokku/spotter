from django.http import HttpResponse

class ForceCORSMiddleware:
    """
    Injects CORS headers on ALL responses, including preflight OPTIONS.
    This acts as a fallback to django-cors-headers.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == 'OPTIONS':
            response = HttpResponse(status=200)
            self._add_headers(request, response)
            return response

        response = self.get_response(request)
        self._add_headers(request, response)
        return response

    def _add_headers(self, request, response):
        origin = request.META.get('HTTP_ORIGIN', '*')
        response['Access-Control-Allow-Origin'] = origin
        response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Authorization, Content-Type, Accept, X-Requested-With'
        response['Access-Control-Allow-Credentials'] = 'false'
