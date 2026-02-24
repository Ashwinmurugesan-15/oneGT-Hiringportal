"""
routes/interviews.py
GET   /api/interviews
POST  /api/interviews
PATCH /api/interviews
"""
import time
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from db import read_db, write_db
from cache import api_cache
import guhatek_api as gapi

router = APIRouter()

CACHE_KEY = "interviews_list"


@router.get("/interviews")
async def get_interviews():
    cached = api_cache.get(CACHE_KEY)
    if cached is not None:
        return JSONResponse(content=cached)
    try:
        interviews = await gapi.get_scheduled_meetings()
        api_cache.set(CACHE_KEY, interviews)
        return JSONResponse(content=interviews)
    except Exception as exc:
        print(f"⚠️ API issue, falling back to local DB for interviews: {exc}")
        db = await read_db()
        local = db.get("interviews", [])
        api_cache.set(CACHE_KEY, local)
        return JSONResponse(content=local)


@router.post("/interviews", status_code=201)
async def create_interview(body: dict):
    try:
        response = await gapi.schedule_meet(body)
        if response.get("success"):
            return JSONResponse(content={"id": response.get("id"), **body}, status_code=201)

        if response.get("status") == 404:
            db = await read_db()
            interview_id = str(int(time.time() * 1000))
            new_interview = {"id": interview_id, **body, "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())}
            db.setdefault("interviews", []).append(new_interview)
            await write_db(db)
            api_cache.clear(CACHE_KEY)
            return JSONResponse(content=new_interview, status_code=201)

        raise HTTPException(400, response.get("message") or response.get("error") or "Failed to schedule interview")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Failed to add interview: {exc}")


@router.patch("/interviews")
async def update_interview(body: dict):
    interview_id = body.get("id")
    if not interview_id:
        raise HTTPException(400, "Interview ID is required")
    rest = {k: v for k, v in body.items() if k != "id"}

    try:
        response = await gapi.update_meet(interview_id, rest)
        if response.get("success"):
            return {"id": interview_id, **(response.get("updated") or {})}

        if response.get("status") == 404:
            db = await read_db()
            interviews = db.get("interviews", [])
            idx = next((i for i, iv in enumerate(interviews) if iv.get("id") == interview_id), -1)
            if idx != -1:
                db["interviews"][idx] = {**interviews[idx], **rest}
                await write_db(db)
                return JSONResponse(content=db["interviews"][idx])
            raise HTTPException(404, "Interview not found locally")

        raise HTTPException(400, response.get("message") or response.get("error") or "Failed to update interview")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Failed to update interview: {exc}")
