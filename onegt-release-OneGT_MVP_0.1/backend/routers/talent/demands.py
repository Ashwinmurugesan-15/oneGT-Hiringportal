"""
routes/demands.py
GET   /api/demands
POST  /api/demands
PATCH /api/demands
DELETE /api/demands/{id}
PATCH /api/demands/update  (alias)
"""
import time
import logging
import json
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import List

from utils.talent_db import read_db, write_db
from utils.talent_cache import api_cache
import utils.recruitment_api as gapi
from utils.logging_utils import trace_exceptions_async
from middleware.auth_middleware import get_current_user, TokenData

logger = logging.getLogger("chrms.talent.demands")

router = APIRouter()

CACHE_KEY = "demands_list"


@router.get("/demands")
@trace_exceptions_async
async def get_demands(current_user: TokenData = Depends(get_current_user)):
    cached = api_cache.get(CACHE_KEY)
    if cached is not None:
        return JSONResponse(content=cached)
    try:
        demands = await gapi.get_job_openings()
        api_cache.set(CACHE_KEY, demands)
        return JSONResponse(content=demands)
    except Exception as exc:
        status = getattr(exc, "response", None)
        print(f"⚠️ API issue, falling back to local DB for demands: {exc}")
        db = await read_db()
        local_demands = db.get("demands", [])
        api_cache.set(CACHE_KEY, local_demands)
        return JSONResponse(content=local_demands)


@router.post("/demands", status_code=201)
@trace_exceptions_async
async def add_demand(demand: dict, current_user: TokenData = Depends(get_current_user)):
    try:
        response = await gapi.create_demand(demand)
        if response.get("success"):
            return JSONResponse(content={"id": response.get("id"), **demand}, status_code=201)

        # Fallback to local DB on 404
        if response.get("status") == 404:
            db = await read_db()
            demand_id = str(int(time.time() * 1000))
            new_demand = {"id": demand_id, **demand, "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())}
            db.setdefault("demands", []).append(new_demand)
            await write_db(db)
            api_cache.clear(CACHE_KEY)
            return JSONResponse(content=new_demand, status_code=201)

        raise HTTPException(400, response.get("message") or response.get("error") or "Failed to create demand")
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error creating demand: {exc}")
        raise HTTPException(500, "Failed to add demand")


@router.patch("/demands")
@trace_exceptions_async
async def update_demand(body: dict, current_user: TokenData = Depends(get_current_user)):
    demand_id = body.get("id")
    if not demand_id:
        raise HTTPException(400, "Demand ID is required")
    rest = {k: v for k, v in body.items() if k != "id"}

    try:
        response = await gapi.update_demand(demand_id, rest)
        if response.get("success"):
            return {"id": demand_id, **(response.get("updated") or {})}

        if response.get("status") == 404:
            db = await read_db()
            demands = db.get("demands", [])
            idx = next((i for i, d in enumerate(demands) if d.get("id") == demand_id), -1)
            if idx != -1:
                db["demands"][idx] = {**demands[idx], **rest}
                await write_db(db)
                return JSONResponse(content=db["demands"][idx])
            raise HTTPException(404, "Demand not found locally")

        raise HTTPException(400, response.get("message") or response.get("error") or "Failed to update demand")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Failed to update demand: {exc}")


@router.patch("/demands/update")
@trace_exceptions_async
async def update_demand_alias(body: dict, current_user: TokenData = Depends(get_current_user)):
    return await update_demand(body, current_user)


@router.delete("/demands/{demand_id}")
@trace_exceptions_async
async def delete_demand_route(demand_id: str, current_user: TokenData = Depends(get_current_user)):
    try:
        response = await gapi.delete_demand(demand_id)
        if response.get("success"):
            return {"success": True, "message": "Demand deleted successfully"}

        print(f"⚠️ API deleteDemand failed, deleting from local DB")
        db = await read_db()
        original_len = len(db.get("demands", []))
        db["demands"] = [d for d in db.get("demands", []) if d.get("id") != demand_id]
        if len(db["demands"]) < original_len:
            await write_db(db)
            return {"success": True, "message": "Demand deleted from local DB"}
        raise HTTPException(404, "Demand not found")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Failed to delete demand: {exc}")
