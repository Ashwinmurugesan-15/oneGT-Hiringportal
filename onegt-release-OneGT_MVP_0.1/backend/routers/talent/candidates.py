"""
routes/candidates.py
GET  /api/candidates
POST /api/candidates
PATCH /api/candidates/update
"""
import json
import time
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import List

from utils.talent_db import read_db, write_db
from utils.talent_cache import api_cache
import utils.recruitment_api as gapi
from utils.logging_utils import trace_exceptions_async
from middleware.auth_middleware import get_current_user, TokenData

logger = logging.getLogger("chrms.talent.candidates")

router = APIRouter()

CACHE_KEY = "candidates_list"


def _map_api_candidate(app: dict) -> dict:
    r1_obj: dict = {}
    r2_obj: dict = {}
    try:
        if app.get("round1_feedback"):
            r1_obj = json.loads(app["round1_feedback"])
    except Exception:
        pass
    try:
        if app.get("round2_feedback"):
            r2_obj = json.loads(app["round2_feedback"])
    except Exception:
        pass

    current_round = 1
    if app.get("round2_feedback") or (r1_obj.get("recommendation") == "proceed_to_round2"):
        current_round = 2

    def _parse_client_rec():
        try:
            return json.loads(app["client_feedback"]).get("recommendation") if app.get("client_feedback") else None
        except Exception:
            return None

    return {
        "id": app.get("id"),
        "name": app.get("full_name") or app.get("name") or "Unknown",
        "email": app.get("email"),
        "phone": app.get("contact_number") or app.get("phone"),
        "demandId": (app.get("interested_position") or "unknown").lower().replace(" ", "-"),
        "role": app.get("interested_position") or app.get("role"),
        "status": app.get("application_status") or "applied",
        "appliedAt": app.get("submitted_at") or app.get("applied_at"),
        "skills": [app.get("interested_position") or "General"],
        "experience": f"{app['total_experience']} years" if app.get("total_experience") else "External",
        "location": app.get("current_location") or "Remote",
        "source": "Guhatek API",
        "resumeUrl": app.get("resume_url"),
        "round1Feedback": app.get("round1_feedback"),
        "round1Recommendation": r1_obj.get("recommendation"),
        "round2Feedback": app.get("round2_feedback"),
        "round2Recommendation": r2_obj.get("recommendation"),
        "clientFeedback": app.get("client_feedback"),
        "clientRecommendation": _parse_client_rec(),
        "currentRound": current_round,
        "interviewStatus": "pending",
        "screeningFeedback": app.get("initial_screening"),
    }


@router.get("/candidates")
@trace_exceptions_async
async def get_candidates(current_user: TokenData = Depends(get_current_user)):
    cached = api_cache.get(CACHE_KEY)
    if cached is not None:
        return JSONResponse(content=cached)

    try:
        api_applications = await gapi.get_applications()
        api_candidates = [_map_api_candidate(a) for a in api_applications]

        db = await read_db()
        local_candidates = db.get("candidates", [])

        api_ids = {c["id"] for c in api_candidates}
        combined = []
        for ac in api_candidates:
            local = next((lc for lc in local_candidates if lc.get("id") == ac["id"]), None)
            if local:
                combined.append({
                    **ac,
                    "round1Feedback": local.get("round1Feedback") or ac.get("round1Feedback"),
                    "round1Recommendation": local.get("round1Recommendation") or ac.get("round1Recommendation"),
                    "round2Feedback": local.get("round2Feedback") or ac.get("round2Feedback"),
                    "round2Recommendation": local.get("round2Recommendation") or ac.get("round2Recommendation"),
                    "clientFeedback": local.get("clientFeedback") or ac.get("clientFeedback"),
                    "clientRecommendation": local.get("clientRecommendation") or ac.get("clientRecommendation"),
                    "screeningFeedback": local.get("screeningFeedback") or ac.get("screeningFeedback"),
                    "currentRound": local.get("currentRound") or ac.get("currentRound"),
                    "interviewStatus": local.get("interviewStatus") or ac.get("interviewStatus"),
                    "status": local.get("status") or ac.get("status"),
                })
            else:
                combined.append(ac)

        for lc in local_candidates:
            if lc.get("id") not in api_ids:
                combined.append(lc)

        api_cache.set(CACHE_KEY, combined)
        return JSONResponse(content=combined)

    except Exception as exc:
        print(f"⚠️ API fetch failed, falling back to local DB: {exc}")
        db = await read_db()
        return JSONResponse(content=db.get("candidates", []))


@router.post("/candidates", status_code=201)
@trace_exceptions_async
async def add_candidate(candidate: dict, current_user: TokenData = Depends(get_current_user)):
    try:
        db = await read_db()
        db.setdefault("candidates", []).append(candidate)
        await write_db(db)
        api_cache.clear(CACHE_KEY)
        return JSONResponse(content=candidate, status_code=201)
    except Exception as exc:
        raise HTTPException(500, f"Failed to add candidate: {exc}")


@router.patch("/candidates/update")
@trace_exceptions_async
async def update_candidate(body: dict, current_user: TokenData = Depends(get_current_user)):
    candidate_id = body.get("id")
    rest = {k: v for k, v in body.items() if k != "id"}

    api_updates: dict = {}
    if rest.get("round1Feedback"):
        api_updates["round1_feedback"] = rest["round1Feedback"]
    if rest.get("round2Feedback"):
        api_updates["round2_feedback"] = rest["round2Feedback"]
    if rest.get("clientFeedback"):
        api_updates["client_feedback"] = rest["clientFeedback"]

    if not api_updates.get("round1_feedback") and rest.get("round1Recommendation"):
        api_updates["round1_feedback"] = json.dumps({"recommendation": rest["round1Recommendation"]})
    if not api_updates.get("round2_feedback") and rest.get("round2Recommendation"):
        api_updates["round2_feedback"] = json.dumps({"recommendation": rest["round2Recommendation"]})
    if not api_updates.get("client_feedback") and rest.get("clientRecommendation"):
        api_updates["client_feedback"] = json.dumps({"recommendation": rest["clientRecommendation"]})

    if rest.get("status"):
        api_updates["application_status"] = rest["status"]
    if rest.get("interviewStatus"):
        api_updates["interview_status"] = rest["interviewStatus"]

    try:
        await gapi.update_application(candidate_id, api_updates)
        api_cache.clear(CACHE_KEY)
        return {"success": True, **body}
    except Exception as api_exc:
        print(f"API update failed, falling back to local DB: {api_exc}")
        db = await read_db()
        candidates = db.get("candidates", [])
        idx = next((i for i, c in enumerate(candidates) if c.get("id") == candidate_id), -1)

        if idx == -1:
            new_candidate = {
                "id": candidate_id,
                **rest,
                "name": rest.get("fullName") or rest.get("name") or "Unknown",
                "email": rest.get("email") or "",
                "status": rest.get("status") or "applied",
                "appliedAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
            }
            candidates.append(new_candidate)
            db["candidates"] = candidates
            await write_db(db)
            api_cache.clear(CACHE_KEY)
            return JSONResponse(content=new_candidate)

        db["candidates"][idx] = {**candidates[idx], **rest}
        await write_db(db)
        api_cache.clear(CACHE_KEY)
        return JSONResponse(content=db["candidates"][idx])
