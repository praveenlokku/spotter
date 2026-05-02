FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_ENV=production

WORKDIR /app

# System deps for psycopg2 (ReportLab is pure Python — no extra deps needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# NOTE: collectstatic runs at container START (not build time)
# because SECRET_KEY and DATABASE_URL are only available at runtime.
EXPOSE 8000

# At startup: migrate → collectstatic → start gunicorn
CMD python manage.py migrate --noinput && \
    python manage.py collectstatic --noinput && \
    gunicorn spotter.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120
