# HireFlow Portal (Vite + FastAPI)

A modern recruitment portal designed for managing job demands, candidates, and interview schedules.

## Project Structure

The project is organized into two main directories:

- **`frontend/`**: Vite + React + Tailwind CSS application.
- **`backend/`**: FastAPI (Python) backend serving the API and managing data.

## Tech Stack

### Frontend
- **Framework**: React 18 (Vite)
- **Routing**: `react-router-dom`
- **Component Lib**: Shadcn UI + Framer Motion
- **Icons**: Lucide Icons
- **State**: React Context API

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Server**: Uvicorn
- **Data Persistence**: Local JSON Database (`frontend/src/data/db.json`)
- **API Clients**: `httpx` (for external GuhaTek API integration)

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v18 or later
- **Python**: v3.10 or later
- **Pip**: For backend dependencies

### 2. Environment Setup
Copy the example environment file and fill in your details (Email app password is required for notifications):
```bash
cp .env.example .env
```

### 3. Quick Start (Root Commands)
The easiest way to run the project is from the root directory:

**Start Backend:**
```bash
npm run backend
```
*Note: Make sure your Python virtual environment in `backend/.venv` is ready.*

**Start Frontend:**
```bash
npm run dev
```

---

## Backend Manual Setup
If you prefer running the backend manually:
1. `cd backend`
2. `python -m venv .venv`
3. `source .venv/bin/activate` (or `.venv\Scripts\activate` on Windows)
4. `pip install -r requirements.txt`
5. `python main.py` (or use `uvicorn main:app --reload`)

---

## Directory Structure
- `/frontend`: React application source code.
- `/backend`: FastAPI application and routes.
- `/src`: Symlink to `/frontend/src` for easier imports.
- `db.json`: Located in `frontend/src/data/db.json`, acts as the local storage fallback.

---

## API Documentation
Detailed documentation of the backend endpoints can be found in `API_DOCUMENTATION.md`.

## Key Features
- **Demand Management**: Create and track job demands.
- **Candidate Pipeline**: Manage candidate applications and their status.
- **Interview Scheduling**: Integrated meeting scheduling with email reminders.
- **Local Fallback**: Seamlessly switches to local `db.json` if the external API is unreachable.
