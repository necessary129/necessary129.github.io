#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "fastapi>=0.115,<1.0",
#   "httpx>=0.27,<1.0",
#   "uvicorn[standard]>=0.30,<1.0",
# ]
# ///

from __future__ import annotations

import hashlib
import hmac
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import List

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

DEFAULT_ORIGINS = [
    "https://shamilkm.tech",
    "https://www.shamilkm.tech",
    "https://u.shamilkm.tech",
    "http://localhost:1313",
]


def parse_origins(raw_value: str | None) -> List[str]:
    if not raw_value:
        return DEFAULT_ORIGINS

    origins = [origin.strip() for origin in raw_value.split(",") if origin.strip()]
    return origins or DEFAULT_ORIGINS


SECRET_KEY = os.getenv("VISITOR_SECRET", "change-me-in-production").encode("utf-8")
ALLOWED_ORIGINS = parse_origins(os.getenv("ALLOWED_ORIGINS"))
APP_NAME = os.getenv("APP_NAME", "whoami-api")
DB_PATH = Path(os.getenv("VISITOR_DB_PATH", str(Path(__file__).with_name("visitors.sqlite3"))))
THUMMARK_SCRIPT_URL = os.getenv(
    "THUMMARK_SCRIPT_URL",
    "https://cdn.jsdelivr.net/npm/@thumbmarkjs/thumbmarkjs/dist/thumbmark.umd.js",
)
THUMMARK_PROXY_TTL_SECONDS = int(os.getenv("THUMMARK_PROXY_TTL_SECONDS", "3600"))


@dataclass
class CachedScript:
    content: bytes
    fetched_at: datetime
    content_type: str


thumbmark_script_cache: CachedScript | None = None
thumbmark_script_lock = Lock()

CODENAME_PREFIXES = [
    "NEON",
    "VECTOR",
    "CIRCUIT",
    "RADIO",
    "SYNTH",
    "QUANTUM",
    "MIDNIGHT",
    "CRT",
    "STATIC",
    "ORBIT",
    "PLASMA",
    "SIGNAL",
]

CODENAME_SUFFIXES = [
    "FOX",
    "GHOST",
    "DRIVE",
    "BYTE",
    "WAVE",
    "NODE",
    "RANGER",
    "SHIFT",
    "SPARK",
    "PULSE",
    "VOID",
    "WALKER",
]

app = FastAPI(title=APP_NAME, version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


class VisitorResolveRequest(BaseModel):
    thumbmark: str = Field(..., min_length=8, max_length=256)
    user_agent: str | None = Field(default=None, max_length=512)
    path: str | None = Field(default=None, max_length=256)


class VisitorResolveResponse(BaseModel):
    visitor_id: str
    display_name: str
    thumbmark: str
    created: bool
    first_seen_at: str
    last_seen_at: str
    visit_count: int


class VisitorVisitSummary(BaseModel):
    visitor_id: str
    display_name: str
    thumbmark: str
    first_seen_at: str
    last_seen_at: str
    visit_count: int


class VisitorVisitRecord(BaseModel):
    visited_at: str
    path: str | None = None
    user_agent: str | None = None


class HealthResponse(BaseModel):
    ok: bool
    service: str


def _canonical_thumbmark(thumbmark: str) -> str:
    value = thumbmark.strip()
    if not value:
        raise HTTPException(status_code=400, detail="thumbmark is required")
    return value


def _build_visitor_id(thumbmark: str) -> str:
    digest = hmac.new(SECRET_KEY, thumbmark.encode("utf-8"), hashlib.sha256).hexdigest().upper()
    return f"GUEST-{digest[:4]}-{digest[4:8]}-{digest[8:12]}-{digest[12:16]}"


def _build_display_name(thumbmark: str) -> str:
    digest = hashlib.sha256(SECRET_KEY + b":" + thumbmark.encode("utf-8")).digest()
    prefix = CODENAME_PREFIXES[digest[0] % len(CODENAME_PREFIXES)]
    suffix = CODENAME_SUFFIXES[digest[1] % len(CODENAME_SUFFIXES)]
    return f"{prefix} {suffix}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def _get_thumbmark_script() -> CachedScript:
    global thumbmark_script_cache

    now = _now_utc()
    with thumbmark_script_lock:
        if thumbmark_script_cache is not None:
            age = (now - thumbmark_script_cache.fetched_at).total_seconds()
            if age < THUMMARK_PROXY_TTL_SECONDS:
                return thumbmark_script_cache

    response = httpx.get(THUMMARK_SCRIPT_URL, follow_redirects=True, timeout=15)
    response.raise_for_status()
    content_type = response.headers.get("content-type", "application/javascript")
    cached = CachedScript(
        content=response.content,
        fetched_at=now,
        content_type=content_type,
    )

    with thumbmark_script_lock:
        thumbmark_script_cache = cached

    return cached


def _init_db() -> None:
    with _connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS visitors (
                visitor_id TEXT PRIMARY KEY,
                thumbmark TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                first_seen_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                visit_count INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS visits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                visitor_id TEXT NOT NULL,
                thumbmark TEXT NOT NULL,
                visited_at TEXT NOT NULL,
                path TEXT,
                user_agent TEXT,
                FOREIGN KEY(visitor_id) REFERENCES visitors(visitor_id)
            )
            """
        )
        connection.commit()


@app.on_event("startup")
def startup() -> None:
    _init_db()


def _upsert_visitor(payload: VisitorResolveRequest) -> tuple[bool, VisitorVisitSummary]:
    thumbmark = _canonical_thumbmark(payload.thumbmark)
    visitor_id = _build_visitor_id(thumbmark)
    display_name = _build_display_name(thumbmark)
    visited_at = _now_iso()

    with _connect() as connection:
        row = connection.execute(
            "SELECT * FROM visitors WHERE visitor_id = ?",
            (visitor_id,),
        ).fetchone()

        if row is None:
            connection.execute(
                """
                INSERT INTO visitors (visitor_id, thumbmark, display_name, first_seen_at, last_seen_at, visit_count)
                VALUES (?, ?, ?, ?, ?, 1)
                """,
                (visitor_id, thumbmark, display_name, visited_at, visited_at),
            )
            created = True
            first_seen_at = visited_at
            last_seen_at = visited_at
            visit_count = 1
        else:
            connection.execute(
                """
                UPDATE visitors
                SET last_seen_at = ?, visit_count = visit_count + 1
                WHERE visitor_id = ?
                """,
                (visited_at, visitor_id),
            )
            created = False
            first_seen_at = row["first_seen_at"]
            last_seen_at = visited_at
            visit_count = int(row["visit_count"]) + 1

        connection.execute(
            """
            INSERT INTO visits (visitor_id, thumbmark, visited_at, path, user_agent)
            VALUES (?, ?, ?, ?, ?)
            """,
            (visitor_id, thumbmark, visited_at, payload.path, payload.user_agent),
        )
        connection.commit()

    return created, VisitorVisitSummary(
        visitor_id=visitor_id,
        display_name=display_name,
        thumbmark=thumbmark,
        first_seen_at=first_seen_at,
        last_seen_at=last_seen_at,
        visit_count=visit_count,
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(ok=True, service=APP_NAME)


@app.get("/assets/mineme.js")
def thumbmark_proxy() -> Response:
    cached = _get_thumbmark_script()
    return Response(
        content=cached.content,
        media_type="application/javascript",
        headers={
            "Cache-Control": f"public, max-age={THUMMARK_PROXY_TTL_SECONDS}",
            "X-Content-Type-Options": "nosniff",
            "X-Proxy-Source": THUMMARK_SCRIPT_URL,
        },
    )


@app.post("/v1/whoami", response_model=VisitorResolveResponse)
def resolve_visitor(payload: VisitorResolveRequest) -> VisitorResolveResponse:
    created, visitor = _upsert_visitor(payload)

    return VisitorResolveResponse(
        visitor_id=visitor.visitor_id,
        display_name=visitor.display_name,
        thumbmark=visitor.thumbmark,
        created=created,
        first_seen_at=visitor.first_seen_at,
        last_seen_at=visitor.last_seen_at,
        visit_count=visitor.visit_count,
    )


@app.get("/v1/visitors", response_model=list[VisitorVisitSummary])
def list_visitors() -> list[VisitorVisitSummary]:
    with _connect() as connection:
        rows = connection.execute(
            """
            SELECT visitor_id, display_name, thumbmark, first_seen_at, last_seen_at, visit_count
            FROM visitors
            ORDER BY last_seen_at DESC
            """
        ).fetchall()

    return [
        VisitorVisitSummary(
            visitor_id=row["visitor_id"],
            display_name=row["display_name"],
            thumbmark=row["thumbmark"],
            first_seen_at=row["first_seen_at"],
            last_seen_at=row["last_seen_at"],
            visit_count=int(row["visit_count"]),
        )
        for row in rows
    ]


@app.get("/v1/visitors/{visitor_id}/visits", response_model=list[VisitorVisitRecord])
def list_visitor_visits(visitor_id: str) -> list[VisitorVisitRecord]:
    with _connect() as connection:
        rows = connection.execute(
            """
            SELECT visited_at, path, user_agent
            FROM visits
            WHERE visitor_id = ?
            ORDER BY visited_at DESC, id DESC
            """,
            (visitor_id,),
        ).fetchall()

    return [
        VisitorVisitRecord(
            visited_at=row["visited_at"],
            path=row["path"],
            user_agent=row["user_agent"],
        )
        for row in rows
    ]


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": APP_NAME,
        "health": "/health",
        "whoami": "/v1/whoami",
        "visitors": "/v1/visitors",
        "visits": "/v1/visitors/{visitor_id}/visits",
    }


if __name__ == "__main__":
    # Programmatic runner for local/dev usage. Honors ENV: HOST, PORT, LOG_LEVEL, UVICORN_RELOAD
    try:
        import uvicorn

        host = os.getenv("HOST", "0.0.0.0")
        port = int(os.getenv("PORT", "7111"))
        log_level = os.getenv("LOG_LEVEL", "info")
        reload_flag = os.getenv("UVICORN_RELOAD", "false").lower() in ("1", "true", "yes")

        uvicorn.run(app, host=host, port=port, log_level=log_level, reload=reload_flag)
    except Exception as e:
        # If uvicorn isn't available or fails, surface a readable error.
        raise SystemExit(f"Failed to run server: {e}")
