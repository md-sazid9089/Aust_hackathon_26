# GoliTransit Render Deployment Guide

## Overview

This guide explains how to deploy the GoliTransit backend to Render using the provided build and start scripts.

## Files Included

1. **`backend/render-build.sh`** - Build script that installs dependencies and verifies the environment
2. **`backend/render-start.sh`** - Start script that launches the FastAPI application
3. **`render.yaml`** - Render configuration file for automated deployment

## Build Script (`render-build.sh`)

### What It Does

```bash
#!/usr/bin/env bash
```

The build script performs these steps in sequence:

1. **Verify Directory Structure**
   - Checks for `requirements.txt` (Python dependencies)
   - Checks for `main.py` (FastAPI entry point)
   - Ensures we're in the backend directory

2. **Check System Dependencies**
   - Verifies Python 3 is installed
   - Verifies pip3 is available
   - Optionally checks for git

3. **Upgrade Package Managers**
   - Upgrades pip, setuptools, and wheel
   - Ensures compatible versions for dependency installation

4. **Install Python Dependencies**
   - Runs: `pip3 install -r requirements.txt`
   - Installs FastAPI, uvicorn, networkx, osmnx, SQLAlchemy, etc.

5. **Verify Critical Imports**
   - Tests importing all critical modules:
     - `fastapi` - Web framework
     - `uvicorn` - ASGI server
     - `pydantic` - Data validation
     - `networkx` - Graph algorithms
     - `osmnx` - OSM graph downloading
     - `sqlalchemy` - ORM
     - `pymysql` - MySQL driver
     - `httpx` - HTTP client

6. **Verify Configuration**
   - Checks that `config.json` exists in project root
   - Ensures backend can read its configuration

### Running Locally

```bash
cd backend
bash render-build.sh
```

### Expected Output

```
==========================================
GoliTransit Backend Build Script
==========================================
[INFO] Starting from directory: /path/to/backend
[✓] Verified backend directory structure
[INFO] Checking system dependencies...
[✓] Found Python 3.10.6
[✓] Found pip
...
[✓] Build completed successfully!
```

## Start Script (`render-start.sh`)

### What It Does

The start script prepares and launches the application:

1. **Verify Backend Directory**
   - Ensures `main.py` is present
   - Locates `config.json`

2. **Set Environment Variables**
   - `PORT` - Application port (default 8000)
   - `CONFIG_PATH` - Path to config.json
   - `DATABASE_URL` - (optional) Override database connection
   - `JWT_SECRET_KEY` - (optional) Override JWT secret
   - `ML_PREDICTION_URL` - (optional) ML service endpoint

3. **Verify Python Environment**
   - Ensures all dependencies are installed
   - Quick import test of critical modules

4. **Validate Configuration**
   - Parses config.json to ensure valid JSON
   - Checks for required configuration sections

5. **Start FastAPI Application**
   - Runs: `uvicorn main:app --host 0.0.0.0 --port 8000`
   - Enables 4 workers for concurrent requests
   - Uses uvloop for performance
   - Logs all HTTP access

### Running Locally

```bash
cd backend
bash render-start.sh
```

### Expected Output

```
==========================================
GoliTransit Backend Start Script
==========================================
[INFO] Starting from directory: /path/to/backend
[✓] Verified backend directory structure
[INFO] Setting up environment variables...
[✓] PORT=8000
...
==========================================
[INFO] Starting GoliTransit Backend
==========================================

FastAPI will be available at:
  - API: http://0.0.0.0:8000
  - Docs: http://0.0.0.0:8000/docs
  - ReDoc: http://0.0.0.0:8000/redoc
...
```

## Render Configuration (`render.yaml`)

The `render.yaml` file configures automated deployment on Render.

### Service Configuration

```yaml
services:
  - type: web
    name: golitransit-backend
    env: python
    region: oregon
```

**Key Fields:**
- `buildCommand` - Executed during build phase
- `startCommand` - Executed to start the application
- `healthCheckPath` - Health check endpoint (`/health`)
- `disk` - Persistent storage for OSM graph cache (5GB)

### Environment Variables

Set these in the Render dashboard:

```
DATABASE_URL=mysql+pymysql://user:pass@host:port/db
JWT_SECRET_KEY=your-secure-secret-key-here
ML_PREDICTION_URL=https://ml-service.onrender.com/predict
PYTHONUNBUFFERED=1
PORT=8000
```

### Database Configuration

The `render.yaml` includes MySQL database setup:

```yaml
databases:
  - name: golitransit-mysql
    databaseName: golitransit
    user: golitransit
    region: oregon
```

## Deployment Instructions

### Step 1: Prepare Your Repository

```bash
# Ensure all scripts are executable
chmod +x backend/render-build.sh
chmod +x backend/render-start.sh

# Commit changes
git add backend/render-*.sh render.yaml
git commit -m "Add Render deployment configuration"
git push origin main
```

### Step 2: Connect to Render

1. Visit https://render.com
2. Click "New +"
3. Select "Web Service"
4. Connect your GitHub repository
5. Render will detect `render.yaml`

### Step 3: Configure Environment Variables

In the Render dashboard, set:

- `DATABASE_URL` - MySQL connection string (from database service)
- `JWT_SECRET_KEY` - Generate a secure random key
- `ML_PREDICTION_URL` - URL of your ML service

### Step 4: Deploy

Click "Create Web Service" - Render will:

1. Run `bash backend/render-build.sh` (build phase)
2. Run `bash backend/render-start.sh` (start phase)
3. Monitor `/health` endpoint for healthchecks
4. Auto-scale based on traffic (if enabled)

### Step 5: Monitor

- View logs in Render dashboard
- Monitor CPU/Memory usage
- Check health status

## Troubleshooting

### Build Fails - Missing requirements.txt

**Error:** `requirements.txt not found`

**Solution:**
```bash
# Verify you're in backend directory
cd backend
ls -la requirements.txt
```

### Start Fails - Config not found

**Error:** `config.json not found at ../config.json`

**Solution:**
- Ensure `config.json` is in project root
- Set `CONFIG_PATH` environment variable correctly

### Database Connection Fails

**Error:** `Can't connect to MySQL at 'host'`

**Solution:**
1. Verify `DATABASE_URL` is set correctly in Render dashboard
2. Check database service is running
3. Verify firewall/IP allowlist settings

### High Memory Usage

**Solution:**
- Reduce number of uvicorn workers: `--workers 2`
- Enable caching for OSM graphs
- Check for memory leaks in routes

## Performance Optimization

### Current Settings (render-start.sh)

```bash
uvicorn main:app \
    --workers 4              # 4 concurrent request handlers
    --loop uvloop            # Fast event loop
    --log-level info         # Verbose logging
    --access-log             # Log all HTTP requests
```

### For Production (High Traffic)

```bash
# In render.yaml, modify startCommand:
startCommand: cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT --workers 8 --loop uvloop --log-level warning
```

### For Development (Low Traffic)

```bash
# In render.yaml, modify startCommand:
startCommand: cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1 --reload --log-level debug
```

## Health Checks

Render monitors the `/health` endpoint:

```bash
# Test locally
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "uptime_seconds": 123,
  "version": "1.0.0"
}
```

## Accessing Your Deployed Backend

Once deployed to Render:

- **API Base URL:** `https://golitransit-backend.onrender.com`
- **Interactive Docs:** `https://golitransit-backend.onrender.com/docs`
- **ReDoc Docs:** `https://golitransit-backend.onrender.com/redoc`
- **Health Check:** `https://golitransit-backend.onrender.com/health`

## Next Steps

1. Deploy the ML service to Render
2. Configure frontend to use Render backend URL
3. Set up monitoring and alerting
4. Configure custom domain (optional)
5. Set up database backups

## References

- [Render Python Documentation](https://render.com/docs/deploy-python)
- [render.yaml Specification](https://render.com/docs/blueprint)
- [FastAPI Production Deployment](https://fastapi.tiangolo.com/deployment/concepts/)
- [Uvicorn Configuration](https://www.uvicorn.org/)
