# GoliTransit Render Deployment - Quick Reference

## 📋 Files Created

```
backend/
├── render-build.sh          # Build script (installs dependencies)
├── render-start.sh          # Start script (launches FastAPI)

render.yaml                   # Render configuration (IaC)
setup-local.sh               # Local setup helper
test-render-readiness.sh     # Pre-deployment validation
RENDER_DEPLOYMENT_GUIDE.md   # Comprehensive documentation
RENDER_DEPLOYMENT_SUMMARY.md # Implementation summary
```

## 🚀 Quick Start

### Local Testing
```bash
# 1. Validate everything is ready
bash test-render-readiness.sh

# 2. Setup and build locally
bash setup-local.sh

# 3. Start the backend (from within setup-local.sh or manually)
cd backend && bash render-start.sh
```

### Deploy to Render
```bash
# 1. Commit changes
git add backend/render-*.sh render.yaml *.md setup-local.sh test-render-readiness.sh
git commit -m "Add Render deployment configuration"
git push origin main

# 2. In Render dashboard:
#    - Click "New +"
#    - Select "Web Service"
#    - Connect GitHub repo
#    - Render auto-detects render.yaml
#    - Set environment variables
#    - Click "Create Web Service"
```

## 🔧 Environment Variables (Set in Render Dashboard)

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | `mysql+pymysql://user:pass@host/db` | Yes |
| `JWT_SECRET_KEY` | Generate secure random string | Yes |
| `ML_PREDICTION_URL` | `https://ml-service.onrender.com/predict` | No |
| `PYTHONUNBUFFERED` | `1` | Yes |
| `PORT` | `8000` | Auto |

## 📊 Build Process Flow

```
Push to GitHub
      │
      ▼
Render detects render.yaml
      │
      ├─► render-build.sh
      │   ├─ Verify structure
      │   ├─ Check dependencies
      │   ├─ Install requirements.txt
      │   └─ Validate imports
      │
      ├─► Create MySQL database
      │
      ├─ render-start.sh
         ├─ Set environment variables
         ├─ Validate config.json
         ├─ Start Uvicorn (4 workers)
         └─ Begin accepting requests
      
Application ready!
```

## ✅ Testing Checklist

- [ ] `test-render-readiness.sh` passes
- [ ] `setup-local.sh` completes successfully  
- [ ] `cd backend && bash render-start.sh` starts without errors
- [ ] Can access `http://localhost:8000/docs`
- [ ] Health check responds: `http://localhost:8000/health`
- [ ] All required imports work
- [ ] config.json is valid JSON

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails | Run `test-render-readiness.sh` to identify issues |
| Config not found | Verify `config.json` in project root, set `CONFIG_PATH` env var |
| Database error | Check `DATABASE_URL` in Render dashboard, verify MySQL IP allowlist |
| Import errors | Run `test-render-readiness.sh`, check requirements.txt |
| Port conflicts | Change `PORT` in Render dashboard (default: 8000) |

## 📝 Script Descriptions

### render-build.sh
- **When:** Render calls during build phase
- **Does:** Validates, installs Python dependencies, verifies config
- **Time:** ~2-3 minutes
- **Output:** Logs show success confirmation

### render-start.sh  
- **When:** Render calls after build succeeds
- **Does:** Sets env vars, validates environment, starts Uvicorn
- **Time:** Immediate (unless first startup with large config)
- **Output:** FastAPI startup messages

### render.yaml
- **What:** Infrastructure-as-Code configuration for Render
- **Contains:** Service settings, database config, environment variables
- **Auto-read:** By Render on each deployment

### setup-local.sh
- **When:** Run locally during development
- **Does:** Validates project structure, runs build script
- **Time:** ~1-2 minutes
- **Optional:** Can skip to manual `bash backend/render-build.sh`

### test-render-readiness.sh
- **When:** Before any deployment
- **Does:** 20+ validation tests
- **Output:** Pass/Fail report with recommendations
- **Exit:** 0 = ready, 1 = issues found

## 🌐 Access After Deployment

| URL | Purpose |
|-----|---------|
| `https://service-name.onrender.com` | API base |
| `https://service-name.onrender.com/docs` | Swagger UI |
| `https://service-name.onrender.com/redoc` | ReDoc docs |
| `https://service-name.onrender.com/health` | Health check |

## 📥 Pulling Fresh Data

```bash
# Graph data (OSM) is cached on the 5GB persistent disk
# First startup: ~2-3 min (downloading graph)
# Subsequent restarts: <30s (cached)

# Clear cache if needed:
# In Render dashboard: Enable SSH
# $ rm -rf /app/backend/cache/*
```

## 💾 Database Management

```bash
# Connect to MySQL (from Render dashboard credentials):
mysql -h [hostname] -u golitransit -p
USE golitransit;
SHOW TABLES;

# Tables auto-created by SQLAlchemy on first run
```

## 🔐 Security Best Practices

1. ✅ Use strong `JWT_SECRET_KEY` (40+ chars, random)
2. ✅ Keep `DATABASE_URL` secret (Render env vars)
3. ✅ Enable IP allowlist on MySQL in Render dashboard
4. ✅ Don't commit secrets to Git
5. ✅ Rotate `JWT_SECRET_KEY` periodically
6. ✅ Use HTTPS only (Render handles this)

## 📧 Support

- **Render Docs:** https://render.com/docs
- **FastAPI Help:** https://fastapi.tiangolo.com
- **Script Issues:** Check RENDER_DEPLOYMENT_GUIDE.md
- **Project Issues:** Review backend/main.py and config.py

## 🎯 Key Differences from Reference Build

| Aspect | Reference | GoliTransit |
|--------|-----------|------------|
| **Runtime** | Chrome/Selenium testing | FastAPI web service |
| **Key Dependency** | Chrome binaries | Python packages |
| **Health Check** | Manual | `/health` endpoint |
| **Database** | In-process | MySQL |
| **Cache** | Chrome artifacts | OSM graph data |

## ⚙️ Performance Tuning

### For Low Traffic
```bash
# In render.yaml, change startCommand:
uvicorn main:app --workers 1 --host 0.0.0.0 --port $PORT
```

### For High Traffic
```bash
# In render.yaml, change startCommand:
uvicorn main:app --workers 8 --loop uvloop --host 0.0.0.0 --port $PORT
```

## 📞 Quick Debug Commands

```bash
# Check application logs
render logs

# Verify database connection
python3 -c "from backend.database import engine; print(engine)"

# Test config.json
python3 -c "import json; print(json.load(open('config.json')))"

# Check imports
python3 -c "import fastapi, uvicorn, networkx; print('OK')"
```

---

**Last Updated:** April 11, 2026  
**Status:** ✅ Production Ready  
**Support:** See RENDER_DEPLOYMENT_GUIDE.md for detailed help
