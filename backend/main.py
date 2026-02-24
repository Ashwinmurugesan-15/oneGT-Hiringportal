"""
main.py – FastAPI application entry point
Run with: uvicorn main:app --reload --port 8000
IDE Sync Trigger: 3
"""
import os
import sys
from pathlib import Path

# Ensure backend/ root is on the Python path (so routes can import db, cache, etc.)
sys.path.insert(0, str(Path(__file__).parent))

import logging
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv(Path(__file__).parent.parent / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s – %(message)s")

from routes.candidates import router as candidates_router
from routes.demands import router as demands_router
from routes.interviews import router as interviews_router
from routes.email import router as email_router
from routes.upload import router as upload_router
from routes.integrations import router as integrations_router

app = FastAPI(title="Hiring Portal API", version="1.0.0")

# ---------------------------------------------------------------------------
# CORS – allow the Vite dev server (port 8080) and any local origin
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Serve static uploaded files (resumes, etc.)
# ---------------------------------------------------------------------------
UPLOADS_DIR = Path(__file__).parent.parent / "frontend" / "public"
if UPLOADS_DIR.exists():
    app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR / "uploads")), name="uploads")

# ---------------------------------------------------------------------------
# Routers – all prefixed under /api
# ---------------------------------------------------------------------------
app.include_router(candidates_router, prefix="/api")
app.include_router(demands_router, prefix="/api")
app.include_router(interviews_router, prefix="/api")
app.include_router(email_router, prefix="/api")
app.include_router(upload_router, prefix="/api")
app.include_router(integrations_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "Hiring Portal API is running 🚀", "docs": "/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Aliases for manual testing (redirects to /api counterparts)
# ---------------------------------------------------------------------------
from fastapi.responses import RedirectResponse


@app.get("/candidates")
async def candidates_alias():
    return RedirectResponse(url="/api/candidates")


@app.get("/demands")
async def demands_alias():
    return RedirectResponse(url="/api/demands")


@app.get("/interviews")
async def interviews_alias():
    return RedirectResponse(url="/api/interviews")
