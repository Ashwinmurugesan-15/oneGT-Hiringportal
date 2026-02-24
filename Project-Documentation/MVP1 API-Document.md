# Hiring Portal API Documentation 📝

The Hiring Portal backend is built with FastAPI and provides a bridge between the React frontend and the external GuhaTek API. It includes caching, local data persistence fallback, and specialized routes for recruitment management.

**Base URL**: `http://localhost:8000/api`

---

## 📡 Core Endpoints

### 👥 Candidates
Manage candidate profiles and their journey through the recruitment pipeline.

- **GET `/candidates`**: Fetches all candidates. Combines data from GuhaTek API and local `db.json`. 
  - *Merging Logic*: If a candidate exists in both, local feedback/status overrides API data to ensure session continuity.
- **POST `/candidates`**: Adds a new candidate to the local database.
- **PATCH `/candidates/update`**: Updates candidate details, status, or interview feedback. Attempts to sync with GuhaTek API first; if unavailable, updates local `db.json`.

### 📋 Job Demands
Manage internal job openings and their requirements.

- **GET `/demands`**: Fetches all active job openings from GuhaTek API (with local fallback).
- **POST `/demands`**: Creates a new job demand.
- **PATCH `/demands`**: Updates an existing demand's details.
- **PATCH `/demands/update`**: Alias for PATCH `/demands`.
- **DELETE `/demands/{id}`**: Removes a job demand from both API and local fallback.

### 📅 Interviews
Schedule and evaluate interview rounds.

- **GET `/interviews`**: Fetches all scheduled interview meetings.
- **POST `/interviews`**: Schedules a new interview round, generates meeting links, and adds to the calendar.
- **PATCH `/interviews`**: Updates interview status or adds feedback details.

### 📧 Email Services
Automated notifications for candidates and interviewers using SMTP.

- **POST `/email/send`**: Sends a custom HTML email. 
- **Required Env**: `EMAIL_USER` and `EMAIL_PASS` (App Password) must be configured in `.env`.

### 📁 File Uploads
- **POST `/upload`**: Uploads files (primarily resumes) to the server. Returns a public URL.
- **Storage Path**: `frontend/public/uploads/` (accessible via `/uploads/` URL prefix).

### � External Integrations
- **GET `/integrations/applicants`**: Directly fetches raw applications from the external GuhaTek API bypasses local merge.

---

## 💾 Cache & Fallback Logic

The API uses an **External-First with Local-Fallback** strategy:

1.  **GET Requests**: The backend attempts to reach the external GuhaTek API. On failure (e.g., 404, connection error), it automatically serves data from `frontend/src/data/db.json`.
2.  **POST/PATCH Requests**: Updates are primarily sent to the external API. If the API returns a 404 or is down, the changes are saved to the local `db.json`.
3.  **Caching**: An in-memory cache (`api_cache`) is used to minimize external API calls. The cache is invalidated automatically on POST/PATCH/DELETE operations.

---

## 🛠 Manual Testing

You can access the interactive API documentation (Swagger UI) at:
`http://localhost:8000/docs`

Direct Browser Access (Aliases):
- `http://localhost:8000/api/candidates`
- `http://localhost:8000/api/demands`
- `http://localhost:8000/api/interviews`
