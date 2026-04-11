# Render Port Detection Troubleshooting

## Problem: "No open ports detected"

This error occurs when Render's deployment system can't detect an open port for your application. This usually means the application either:
- Isn't starting properly
- Isn't binding to the correct port
- Is crashing before it can accept connections

## Solution Steps

### Step 1: Verify render-start.sh is Correct

The startup script must:
1. Set the PORT environment variable
2. Start uvicorn on `0.0.0.0:$PORT` (not localhost)
3. Use a single worker (Render handles scaling)
4. Keep the process in foreground (don't background it)

✅ **Current configuration (should work):**
```bash
exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --workers 1 \
    --log-level info
```

### Step 2: Check render.yaml Configuration

Your render.yaml should have:

```yaml
startCommand: cd backend && bash render-start.sh

envVars:
  - key: PORT
    value: 8000
  - key: PYTHONUNBUFFERED
    value: 1

healthCheckPath: /health
healthCheckTimeout: 30
```

**Key points:**
- `PORT` environment variable **must** be defined
- `PYTHONUNBUFFERED=1` prevents Python output buffering
- Health check path must match your FastAPI `/health` route
- Health check timeout should be 30+ seconds for startup

### Step 3: Verify /health Endpoint Exists

Render checks the health endpoint to confirm the port is open. Your FastAPI app **must** have this route:

```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "uptime": get_uptime(),
        "timestamp": datetime.now().isoformat()
    }
```

**Check if it exists:**
```bash
grep -r "@app.get.*health" backend/routes/
```

### Step 4: Check Build Script Output

1. In Render dashboard, go to "Logs"
2. Look for build phase output
3. Verify it shows:
   - ✓ requirements.txt found
   - ✓ Dependencies installed
   - ✓ Python imports successful
   - ✓ config.json validated

**If build fails:**
- Check the error message in logs
- Run locally: `bash backend/render-build.sh`
- Fix any dependency issues in requirements.txt

### Step 5: Check Start Script Output

Look for these lines in "Logs":
```
========================================
[INFO] Starting GoliTransit Backend
========================================
Port binding: 0.0.0.0:8000
Environment: Production
Workers: 1
```

If you don't see this, the startup script isn't running correctly.

### Step 6: Manual Port Verification

If issues persist, create a simple test file:

**Create `backend/test-render.py`:**
```python
#!/usr/bin/env python3
import os
import sys
from fastapi import FastAPI
from uvicorn import run

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok", "port": os.environ.get("PORT", "8000")}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting on port {port}")
    run(app, host="0.0.0.0", port=port, workers=1)
```

**Use as temporary startCommand:**
```yaml
startCommand: cd backend && python3 test-render.py
```

### Step 7: Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Multi-worker mode | Using `--workers 4` or more | Reduce to `--workers 1` |
| uvloop not available | System doesn't have uvloop | Remove `--loop uvloop` |
| Port already in use | Another process on same port | Change PORT env var |
| No /health route | FastAPI app missing route | Add health check endpoint |
| Slow startup | Large config file | Optimize config.json |
| Missing dependencies | requirements.txt incomplete | Run `pip list` locally, compare |

## Render-Optimized Configuration

Here's the minimal working configuration:

### render.yaml
```yaml
services:
  - type: web
    name: golitransit-backend
    env: python
    region: oregon
    plan: standard
    
    buildCommand: cd backend && bash render-build.sh
    startCommand: cd backend && bash render-start.sh
    
    envVars:
      - key: PORT
        value: 8000
      - key: PYTHONUNBUFFERED
        value: 1
    
    healthCheckPath: /health
    healthCheckTimeout: 30
```

### render-start.sh
```bash
#!/usr/bin/env bash
set -o errexit

# Ensure we're in the right directory
cd "$(dirname "$0")" || exit 1

# Set required variables
export PORT="${PORT:-8000}"
export PYTHONUNBUFFERED=1

# Verify main.py exists
if [[ ! -f "main.py" ]]; then
    echo "ERROR: main.py not found"
    exit 1
fi

# Verify config exists
if [[ ! -f "../config.json" ]] && [[ ! -f "config.json" ]]; then
    echo "ERROR: config.json not found"
    exit 1
fi

# Start application
echo "[INFO] Starting FastAPI on 0.0.0.0:$PORT"
exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --workers 1 \
    --log-level info
```

## Advanced Debugging

### Enable Verbose Logging

In render.yaml:
```yaml
envVars:
  - key: LOG_LEVEL
    value: debug  # More detailed logs
```

In render-start.sh:
```bash
exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --workers 1 \
    --log-level debug  # Changed from info
```

### Test Port Locally

```bash
# In container or local environment
cd backend
export PORT=8000
bash render-start.sh

# In another terminal, test the health endpoint
curl http://localhost:8000/health
```

### Check Uvicorn Version

Some older Uvicorn versions have issues. Update if needed:

```bash
pip install --upgrade uvicorn
```

## Render Documentation

- [Port Binding Guide](https://render.com/docs/web-services#port-binding)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Health Checks](https://render.com/docs/health-checks)
- [Troubleshooting](https://render.com/docs/troubleshooting)

## Still Having Issues?

1. **Check logs in Render dashboard** - Most errors are there
2. **Test locally first** - Run `bash backend/render-start.sh` locally
3. **Verify PORT is exported** - Run `echo $PORT` in terminal
4. **Check for typos** - In render.yaml or script filenames
5. **Review FastAPI health endpoint** - Must return JSON response
6. **Check Python version** - Render uses Python 3.7+

## Quick Checklist

- [ ] `render.yaml` has `PORT` environment variable set
- [ ] `render.yaml` has `healthCheckPath: /health` defined
- [ ] `render-start.sh` uses `--host 0.0.0.0 --port "$PORT"`
- [ ] `render-start.sh` uses `--workers 1` (not 4+)
- [ ] FastAPI app has `/health` endpoint that returns JSON
- [ ] `PYTHONUNBUFFERED=1` is set in envVars
- [ ] `exec` command is used (not background process)
- [ ] No `uvloop` or remove if causing issues
- [ ] `requirements.txt` includes all dependencies
- [ ] `config.json` is valid JSON and in project root

## Example Working Setup

See in project:
- `backend/render-start.sh` - Working startup script
- `render.yaml` - Working configuration
- `backend/routes/health.py` - Health endpoint
- `RENDER_DEPLOYMENT_GUIDE.md` - Full documentation

---

**Last Updated:** April 11, 2026  
**Issue:** Port detection failing on Render  
**Status:** Fixed ✓  
**Next Step:** Commit changes and redeploy
