FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_ENV=production

WORKDIR /app

# Only what ReportLab + psycopg2 actually need
# (WeasyPrint removed — we use ReportLab for PDFs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["gunicorn", "spotter.wsgi:application", "--bind", "0.0.0.0:$PORT", "--workers", "2", "--timeout", "120"]
