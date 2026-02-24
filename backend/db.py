"""
db.py – Async read/write for db.json (mirrors src/lib/db.ts)
"""
import json
import asyncio
import os
from pathlib import Path

# Path relative to project root (one level up from backend/)
DB_PATH = Path(__file__).parent.parent / "frontend" / "src" / "data" / "db.json"

_lock = asyncio.Lock()


async def read_db() -> dict:
    async with _lock:
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)


async def write_db(data: dict) -> None:
    async with _lock:
        with open(DB_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
