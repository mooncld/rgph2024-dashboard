# Matches the Python version this app was developed and tested against.
# If this base image tag isn't available yet on your build platform, fall
# back to python:3.13-slim and re-resolve requirements.txt for that version.
FROM python:3.14-slim

WORKDIR /app

# openpyxl/pyarrow don't need extra system libs beyond the base image, but
# gcc is kept for any package that falls back to a source build on Linux.
RUN apt-get update && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY data/processed ./data/processed
COPY geojson ./geojson

# Render (and most PaaS) inject $PORT at runtime; default to 8000 for local
# `docker run`. Single worker is enough here — DuckDB holds the whole
# dataset in one in-memory process, so scaling workers would just duplicate
# it rather than add real capacity.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
