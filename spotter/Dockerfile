FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_ENV=production

WORKDIR /app

# System deps for ReportLab + psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 libffi-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["gunicorn", "spotter.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120"]
