"""
db.py – Async read/write for db.json (mirrors src/lib/db.ts)
"""
import json
import asyncio
import os
from pathlib import Path

# Path relative to project root (two levels up from utils/ inside backend/)
DB_PATH = Path(__file__).parent.parent.parent / "frontend" / "src" / "modules" / "talent" / "data" / "db.json"

_lock = asyncio.Lock()


async def read_db() -> dict:
    async with _lock:
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)


async def write_db(data: dict) -> None:
    async with _lock:
        with open(DB_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
