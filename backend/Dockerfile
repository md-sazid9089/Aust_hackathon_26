# ============================================================
# GoliTransit Backend — Dockerfile
# ============================================================
# Multi-stage build for the FastAPI backend service.
#
# Stage 1 (builder): Install Python dependencies into a venv
# Stage 2 (runtime): Copy venv + app code into slim image
#
# Usage:
#   docker build -t golitransit-backend ./backend
#   docker run -p 8000:8000 golitransit-backend
#
# In production, the docker-compose.yml orchestrates this
# alongside the ML and frontend services.
# ============================================================

# ─── Stage 1: Builder ───────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install system deps needed by OSMnx/NetworkX (GDAL, spatial libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libgdal-dev \
    libspatialindex-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies (cached layer if requirements.txt unchanged)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt


# ─── Stage 2: Runtime ───────────────────────────────────────
FROM python:3.11-slim AS runtime

LABEL maintainer="GoliTransit Team"
LABEL description="GoliTransit FastAPI Backend — Multi-modal routing engine"

WORKDIR /app

# Install minimal runtime system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgdal-dev \
    libspatialindex-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Set Python to run unbuffered (logs appear immediately in Docker)
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Copy application code
COPY . .

# Remove test files and cache from the image
RUN rm -rf tests/ __pycache__/ .pytest_cache/

# Expose the backend API port
EXPOSE 8000

# Health check — hit the /health endpoint every 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command (overridden by docker-compose for --reload in dev)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
