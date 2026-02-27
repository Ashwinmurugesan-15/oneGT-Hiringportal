import os
import logging
import traceback
import sys
import asyncio
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from config import settings
from utils.logging_utils import trace_exceptions_async

# Configure logging
log_level = logging.DEBUG if settings.DEBUG else getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("chrms")
logger.setLevel(log_level)

# Also set uvicorn loggers
logging.getLogger("uvicorn").setLevel(log_level)
logging.getLogger("uvicorn.error").setLevel(log_level)

# Import routers
# Import routers
from routers.hrms import associates, projects, allocations, payroll, expenses, dashboard, timesheets, customers, skills, assets, organization
from routers.common import currency, notifications, drive as drive_router
from routers.common import auth as auth_router

# Import CRMS routers
from routers.crms import leads as crms_leads, customers as crms_customers, opportunities as crms_opportunities, contacts as crms_contacts, deals as crms_deals, tasks as crms_tasks, calls as crms_calls, dashboard as crms_dashboard, invoices as crms_invoices, invoice_templates as crms_invoice_templates

# Import Talent routers
from routers.talent import candidates as talent_candidates, demands as talent_demands, interviews as talent_interviews, email as talent_email

# ─────────────────────────────────────────────
# Startup connectivity check
# ─────────────────────────────────────────────
async def _check_external_apis():
    """Run at startup: ping each external API and print coloured status."""
    import httpx
    from utils.recruitment_api import _get_config

    GREEN  = "\033[92m"
    RED    = "\033[91m"
    YELLOW = "\033[93m"
    BOLD   = "\033[1m"
    RESET  = "\033[0m"

    print(f"\n{BOLD}{'─'*60}{RESET}")
    print(f"{BOLD}  Guhatek External API — Connectivity Check{RESET}")
    print(f"{BOLD}{'─'*60}{RESET}")

    checks = []

    cfg     = _get_config()
    api_url = cfg.get("api_url", "")
    api_key = cfg.get("api_key", "")

    if not api_url or not api_key:
        print(f"  {YELLOW}⚠️ {RESET}  {BOLD}GUHATEK_API_URL or GUHATEK_API_KEY not set in .env{RESET}")
        print(f"{BOLD}{'─'*60}{RESET}\n")
        return

    token = None

    async with httpx.AsyncClient(verify=False, timeout=8) as client:

        # ── 1. Auth Token ──────────────────────────────────────────
        try:
            r = await client.get(f"{api_url}/api/token", headers={"x-api-key": api_key})
            if r.status_code == 200 and "token" in r.json():
                token = r.json()["token"]
                checks.append((f"{GREEN}✅{RESET}", "Auth Token",     "/api/token",                       "Token fetched OK"))
            else:
                checks.append((f"{RED}❌{RESET}", "Auth Token",      "/api/token",                       f"HTTP {r.status_code}"))
        except Exception as e:
            checks.append((f"{RED}❌{RESET}", "Auth Token",          "/api/token",                       str(e)[:55]))

        if token:
            auth = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

            # ── 2. Candidates (Applications) ───────────────────────
            try:
                r = await client.get(f"{api_url}/api/applications", headers=auth)
                if r.status_code == 200:
                    data = r.json()
                    arr  = data if isinstance(data, list) else data.get("data", data.get("applications", []))
                    checks.append((f"{GREEN}✅{RESET}", "Candidates",     "/api/applications",                f"{len(arr)} records returned"))
                else:
                    checks.append((f"{RED}❌{RESET}", "Candidates",      "/api/applications",                f"HTTP {r.status_code}"))
            except Exception as e:
                checks.append((f"{RED}❌{RESET}", "Candidates",          "/api/applications",                str(e)[:55]))

            # ── 3. Job Demands (Job Openings) ──────────────────────
            try:
                r = await client.get(f"{api_url}/api/applications/jobOpenings", headers=auth)
                if r.status_code == 200:
                    data = r.json()
                    arr  = data if isinstance(data, list) else data.get("data", data.get("jobOpenings", []))
                    checks.append((f"{GREEN}✅{RESET}", "Job Demands",    "/api/applications/jobOpenings",    f"{len(arr)} records returned"))
                elif r.status_code == 404:
                    checks.append((f"{RED}❌{RESET}", "Job Demands",      "/api/applications/jobOpenings",    "404 — Not deployed on this server"))
                else:
                    checks.append((f"{RED}❌{RESET}", "Job Demands",      "/api/applications/jobOpenings",    f"HTTP {r.status_code}"))
            except Exception as e:
                checks.append((f"{RED}❌{RESET}", "Job Demands",          "/api/applications/jobOpenings",    str(e)[:55]))

            # ── 4. Interview Meetings (Schedule Meet) ──────────────
            try:
                r = await client.get(f"{api_url}/api/applications/scheduleMeet", headers=auth)
                if r.status_code == 200:
                    data = r.json()
                    arr  = data if isinstance(data, list) else data.get("data", data.get("meetings", []))
                    checks.append((f"{GREEN}✅{RESET}", "Interviews",     "/api/applications/scheduleMeet",   f"{len(arr)} records returned"))
                elif r.status_code == 404:
                    checks.append((f"{RED}❌{RESET}", "Interviews",       "/api/applications/scheduleMeet",   "404 — Not deployed on this server"))
                else:
                    checks.append((f"{RED}❌{RESET}", "Interviews",       "/api/applications/scheduleMeet",   f"HTTP {r.status_code}"))
            except Exception as e:
                checks.append((f"{RED}❌{RESET}", "Interviews",           "/api/applications/scheduleMeet",   str(e)[:55]))

    # ── Always show Backend itself ─────────────────────────────────
    checks.append((f"{GREEN}✅{RESET}", "Backend API", f"http://localhost:{settings.PORT}", "Running"))

    # ── Print table ────────────────────────────────────────────────
    for icon, name, endpoint, status_msg in checks:
        print(f"  {icon}  {BOLD}{name:<18}{RESET}  {endpoint:<42}  {status_msg}")

    print(f"{BOLD}{'─'*60}{RESET}\n")


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run on startup
    await _check_external_apis()
    yield
    # Run on shutdown (nothing needed)


app = FastAPI(
    title="OneGT API",
    description="OneGT API",
    version="1.0.0",
    lifespan=lifespan,
)

# Middleware to log all requests and catch errors
class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as exc:
            # Log the full exception with stack trace
            error_header = f"ERROR in {request.method} {request.url.path}"
            logger.error(error_header, exc_info=True)
            
            # Also print to stderr for immediate visibility in console
            print(f"\n{'='*60}\n{error_header}\n{'='*60}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            print(f"{'='*60}\n", file=sys.stderr)
            
            return JSONResponse(
                status_code=500,
                content={"detail": str(exc), "type": type(exc).__name__}
            )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_header = f"VALIDATION ERROR in {request.method} {request.url.path}"
    logger.error(f"{error_header}: {exc.errors()}")
    
    # Print to stderr for immediate visibility
    print(f"\n{'!'*60}\n{error_header}\n{'!'*60}", file=sys.stderr)
    for err in exc.errors():
        print(f"  - Loc: {err.get('loc')}\n    Msg: {err.get('msg')}\n    Type: {err.get('type')}", file=sys.stderr)
    print(f"{'!'*60}\n", file=sys.stderr)
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": exc.body}
    )

app.add_middleware(ErrorLoggingMiddleware)

# Static files directory (for production deployment)
STATIC_DIR = Path(__file__).parent / "static"

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(organization.router, prefix="/api/organization", tags=["Organization"])
app.include_router(crms_invoice_templates.router, prefix="/api/crms/invoice-templates", tags=["CRMS Invoice Templates"])

app.include_router(associates.router, prefix="/api/associates", tags=["Associates"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(allocations.router, prefix="/api/allocations", tags=["Allocations"])
app.include_router(payroll.router, prefix="/api/payroll", tags=["Payroll"])
app.include_router(expenses.router, prefix="/api/expenses", tags=["Expenses"])
app.include_router(currency.router, prefix="/api/currency", tags=["Currency"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(timesheets.router, prefix="/api/timesheets", tags=["Timesheets"])
app.include_router(customers.router, prefix="/api/customers", tags=["Customers"])
app.include_router(skills.router, prefix="/api/skills", tags=["Skills"])
app.include_router(assets.router, prefix="/api/assets", tags=["Assets"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(drive_router.router, prefix="/api/common", tags=["Common"])
app.include_router(talent_candidates.router, prefix="/api/talent", tags=["Talent - Candidates"])
app.include_router(talent_demands.router, prefix="/api/talent", tags=["Talent - Demands"])
app.include_router(talent_interviews.router, prefix="/api/talent", tags=["Talent - Interviews"])
app.include_router(talent_email.router, prefix="/api/talent", tags=["Talent - Email"])

# CRMS routers
app.include_router(crms_leads.router, prefix="/api")
app.include_router(crms_customers.router, prefix="/api")
app.include_router(crms_opportunities.router, prefix="/api")
app.include_router(crms_contacts.router, prefix="/api")
app.include_router(crms_deals.router, prefix="/api")
app.include_router(crms_tasks.router, prefix="/api")
app.include_router(crms_calls.router, prefix="/api")
app.include_router(crms_invoices.router, prefix="/api")
app.include_router(crms_invoice_templates.router, prefix="/api")
app.include_router(crms_dashboard.router, prefix="/api")

@app.get("/")
async def root():
    # In production with static files, serve index.html
    if STATIC_DIR.exists():
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
    return {"message": "OneGT API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Mount static files for production (must be after API routes)
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")
    
    # Catch-all route for SPA - must be last
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't serve API routes through this
        if full_path.startswith("api/"):
            return {"error": "Not found"}
        
        # Try to serve the file if it exists
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        # Fall back to index.html for SPA routing
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        
        return {"error": "Not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)

