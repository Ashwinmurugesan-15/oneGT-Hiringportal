"""
routes/demands.py
GET   /api/demands
POST  /api/demands
PATCH /api/demands
DELETE /api/demands/{id}
PATCH /api/demands/update  (alias)
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from db import read_db, write_db
from cache import api_cache
import guhatek_api as gapi
import time

router = APIRouter()

CACHE_KEY = "demands_list"


@router.get("/demands")
async def get_demands():
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
async def create_demand(body: dict):
    try:
        response = await gapi.create_demand(body)
        if response.get("success"):
            return JSONResponse(content={"id": response.get("id"), **body}, status_code=201)

        # Fallback to local DB on 404
        if response.get("status") == 404:
            db = await read_db()
            demand_id = str(int(time.time() * 1000))
            new_demand = {"id": demand_id, **body, "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())}
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
async def update_demand_patch(body: dict):
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
async def update_demand_alias(body: dict):
    return await update_demand_patch(body)


@router.delete("/demands/{demand_id}")
async def delete_demand(demand_id: str):
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
