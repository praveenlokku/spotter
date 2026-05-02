# Settings package — auto-selects local or prod based on DJANGO_ENV env var
import os
env = os.getenv('DJANGO_ENV', 'local')
if env == 'production':
    from .prod import *
else:
    from .local import *
