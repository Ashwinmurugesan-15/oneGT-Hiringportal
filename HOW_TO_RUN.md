# Running the OneGT Project Locally

This is a step-by-step guide to setting up and running the OneGT (Hiring Portal + CRMS) project on your local machine. The project consists of a **Python FastAPI backend** and a **React Vite frontend**.

Both frontend and backend folders are located inside the `onegt-release-OneGT_MVP_0.1` folder.

---

## Prerequisites

Before you begin, ensure you have the following installed on your system:
1. **Python 3.11** or higher.
2. **Node.js** (version 20 or higher).
3. **Google Chrome** (recommended for testing the web app).

---

## Step 1: Open Terminal Windows
You will need **two separate terminal windows** open inside the `onegt-release-OneGT_MVP_0.1` folder.

* **Terminal 1:** Will be used to run the Backend API.
* **Terminal 2:** Will be used to run the Frontend UI.

---

## Step 2: Set up the Backend (Terminal 1)

The backend handles all API requests.

1. **Navigate to the backend directory:**
   ```bash
   cd onegt-release-OneGT_MVP_0.1/backend
   ```

2. **Activate the Python Virtual Environment:**
   The project comes with a pre-configured virtual environment folder named `.venv`. You must activate it before running Python.
   * **On Linux/macOS:**
     ```bash
     source .venv/bin/activate
     ```
   * **On Windows:**
     ```bash
     .venv\Scripts\activate
     ```
   *(Note: You should see `(.venv)` appear at the beginning of your terminal prompt).*

3. **Install Dependencies:**
   Ensure all required Python packages are installed by running:
   ```bash
   python3 -m pip install -r requirements.txt
   ```

4. **Verify Environment Variables (`.env` file):**
   Ensure you have a `.env` file inside the `backend/` directory with all the required Google Credentials, Spreadsheet IDs, and Guhatek External API variables.

5. **Start the Backend Server:**
   ```bash
   python3 main.py
   ```
   **Success Indicator:** You should see terminal logs saying `Uvicorn running on http://0.0.0.0:8000`.

---

## Step 3: Set up the Frontend (Terminal 2)

The frontend is a React application built with Vite.

1. **Navigate to the frontend directory:**
   From your main project folder, go to:
   ```bash
   cd onegt-release-OneGT_MVP_0.1/frontend
   ```

2. **Install Node Modules:**
   ```bash
   npm install
   ```

3. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   **Success Indicator:** You should see terminal logs saying `VITE v5.x.x ready in ... ms` and providing a local URL (usually `http://localhost:5173`).

---

## Step 4: Access the Application

Once both servers are running successfully without errors:

1. Open your web browser.
2. Navigate to: **[http://localhost:5173](http://localhost:5173)**
3. You will be greeted by the login screen. You can use the "Developer Login Bypass" button for local testing.

### Useful Links:
* **Frontend Web App:** [http://localhost:5173](http://localhost:5173)
* **Backend API URL:** [http://localhost:8000](http://localhost:8000)
* **API Documentation (Swagger UI):** [http://localhost:8000/docs](http://localhost:8000/docs)
