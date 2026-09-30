import os
import time
import requests
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, Query, HTTPException
from src.config import CORE_SERVICE_URL, PORT, GATEWAY_SECRET
from src.embeddings import compute_weighted_user_embedding, compute_board_embedding
from src.vectordb import (
    init_vector_database,
    get_counts,
    upsert_user,
    upsert_board,
    search_peers,
    search_boards,
    has_user_vector,
    rank_second_degree_candidates,
    purge_stale_records,
)

def _internal_headers():
    return {"x-gateway-secret": GATEWAY_SECRET} if GATEWAY_SECRET else {}

def _verify_internal_access(x_gateway_secret: str | None):
    if GATEWAY_SECRET and x_gateway_secret != GATEWAY_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: unauthorized internal request")

def _parse_safe_offset(cursor: str | None) -> int:
    if not cursor:
        return 0
    try:
        val = int(cursor)
        return val if 0 <= val <= 10000 else 0
    except (ValueError, TypeError):
        return 0

def run_startup_backfill():
    """Fetches all users and board postings from core service and computes initial embeddings."""
    print("[StartupBackfill] Checking and syncing vector backfill...")
    try:
        # 1. Sync users
        users_res = requests.get(
            f"{CORE_SERVICE_URL}/api/internal/users-data",
            headers=_internal_headers(),
            timeout=10
        )
        if users_res.status_code == 200:
            users = users_res.json().get("data", [])
            valid_user_ids = [u["id"] for u in users]
            purge_stale_records(active_user_ids=valid_user_ids)
            print(f"[StartupBackfill] Processing embeddings for {len(users)} users...")
            for u in users:
                vec = compute_weighted_user_embedding(u)
                upsert_user(u["id"], vec, {
                    "name": u.get("name"),
                    "college_name": u.get("college_name"),
                    "bio": u.get("bio"),
                    "avatar_url": u.get("avatar_url"),
                    "year_of_study": u.get("year_of_study"),
                    "branch": u.get("branch"),
                    "skills": u.get("skills", []),
                    "interests": u.get("interests", []),
                    "looking_for": u.get("looking_for")
                })
            print(f"[StartupBackfill] Successfully indexed {len(users)} users into Vector DB!")

        # 2. Sync boards
        boards_res = requests.get(
            f"{CORE_SERVICE_URL}/api/internal/boards-data",
            headers=_internal_headers(),
            timeout=10
        )
        if boards_res.status_code == 200:
            boards = boards_res.json().get("data", [])
            print(f"[StartupBackfill] Processing embeddings for {len(boards)} board postings...")
            for b in boards:
                vec = compute_board_embedding(b)
                upsert_board(b["id"], vec, {
                    "title": b.get("title"),
                    "description": b.get("description"),
                    "group_id": b.get("groupId") or b.get("group_id"),
                    "group_name": b.get("groupName") or b.get("group_name"),
                    "creator_id": b.get("creatorId") or b.get("creator_id"),
                    "roles_needed": b.get("rolesNeeded") or b.get("roles_needed", []),
                    "required_skills": b.get("requiredSkills") or b.get("required_skills", []),
                    "required_interests": b.get("requiredInterests") or b.get("required_interests", []),
                    "slots_total": b.get("slotsTotal") or b.get("slots_total", 1),
                    "slots_filled": b.get("slotsFilled") or b.get("slots_filled", 0),
                    "expires_at": b.get("expiresAt") or b.get("expires_at"),
                    "created_at": b.get("createdAt") or b.get("created_at")
                })
            print(f"[StartupBackfill] Successfully indexed {len(boards)} board postings into Vector DB!")

    except Exception as e:
        print(f"[StartupBackfill] Error during backfill: {e}")

def ensure_user_indexed(user_id: str):
    """Ensures a user has an embedding in user_embeddings. If not, fetches from core service and computes it."""
    if not has_user_vector(user_id):
        try:
            print(f"[OnDemandIndex] User {user_id} vector missing. Fetching from core-service...")
            res = requests.get(
                f"{CORE_SERVICE_URL}/api/internal/users-data/{user_id}",
                headers=_internal_headers(),
                timeout=5
            )
            if res.status_code == 200 and res.json().get("data"):
                u = res.json()["data"]
                vec = compute_weighted_user_embedding(u)
                upsert_user(u["id"], vec, {
                    "name": u.get("name"),
                    "college_name": u.get("college_name"),
                    "bio": u.get("bio"),
                    "avatar_url": u.get("avatar_url"),
                    "year_of_study": u.get("year_of_study"),
                    "branch": u.get("branch"),
                    "skills": u.get("skills", []),
                    "interests": u.get("interests", []),
                    "looking_for": u.get("looking_for")
                })
                print(f"[OnDemandIndex] Successfully generated embedding for user {user_id}")
        except Exception as e:
            print(f"[OnDemandIndex] Error indexing user: {e}")

_backfill_lock = threading.Lock()
_is_backfilling = False

def start_background_backfill():
    global _is_backfilling
    with _backfill_lock:
        if _is_backfilling:
            return
        _is_backfilling = True

    def _worker():
        global _is_backfilling
        try:
            run_startup_backfill()
        finally:
            with _backfill_lock:
                _is_backfilling = False

    t = threading.Thread(target=_worker, daemon=True)
    t.start()

def ensure_data_populated():
    """If vector database has 0 or 1 user, trigger backfill from core-service asynchronously."""
    counts = get_counts()
    if counts.get("users", 0) <= 1 or counts.get("boards", 0) == 0:
        print(f"[AutoBackfill] Vector database needs syncing (current counts: {counts}). Starting background backfill...")
        start_background_backfill()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        init_vector_database()
        start_background_backfill()
    except Exception as e:
        print(f"[AppInit] Notice during startup initialization: {e}")
    yield
    # Shutdown
    print("[AppShutdown] Recommendation service shutting down.")

app = FastAPI(title="Synapse Recommendation Service", lifespan=lifespan)

# Health endpoint: safe binary status check without leaking DB volume metrics (M-16)
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "recommendation-service",
    }

@app.get("/recommendations/similarity")
def get_similarity_recommendations(
    x_user_id: str | None = Header(None, alias="x-user-id"),
    x_gateway_secret: str | None = Header(None, alias="x-gateway-secret"),
    limit: int = Query(30, ge=1, le=100),
    cursor: str | None = Query(None)
):
    _verify_internal_access(x_gateway_secret)
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing user identity")

    active_user_id = x_user_id
    ensure_data_populated()
    ensure_user_indexed(active_user_id)

    offset = _parse_safe_offset(cursor)

    # Fetch existing connections to exclude from recommendations
    exclude_ids = []
    try:
        conn_res = requests.get(
            f"{CORE_SERVICE_URL}/api/internal/connections/{active_user_id}",
            headers=_internal_headers(),
            timeout=3
        )
        if conn_res.status_code == 200:
            exclude_ids = conn_res.json().get("data", [])
    except Exception as e:
        print(f"[Similarity] Warning: could not fetch connection exclusions: {e}")

    matches = search_peers(active_user_id, exclude_ids=exclude_ids, limit=limit, offset=offset)
    next_cursor = str(offset + len(matches)) if len(matches) == limit else None
    
    return {
        "data": matches,
        "nextCursor": next_cursor,
        "source": "similarity"
    }

@app.get("/recommendations/second-degree")
def get_second_degree_recommendations(
    x_user_id: str | None = Header(None, alias="x-user-id"),
    x_gateway_secret: str | None = Header(None, alias="x-gateway-secret"),
    limit: int = Query(30, ge=1, le=100),
    cursor: str | None = Query(None)
):
    _verify_internal_access(x_gateway_secret)
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing user identity")

    active_user_id = x_user_id
    ensure_data_populated()
    ensure_user_indexed(active_user_id)

    offset = _parse_safe_offset(cursor)

    # 1. Query true 2nd-degree network candidates (friends of friends) from core service
    candidates = []
    try:
        cand_res = requests.get(
            f"{CORE_SERVICE_URL}/api/internal/second-degree-candidates/{active_user_id}?limit={limit}&offset={offset}",
            headers=_internal_headers(),
            timeout=5
        )
        if cand_res.status_code == 200:
            candidates = cand_res.json().get("data", [])
    except Exception as e:
        print(f"[SecondDegree] Warning: error querying second degree candidates: {e}")

    # 2. If 2nd-degree candidates exist in the social graph, rank them with hybrid vector similarity
    if candidates or offset > 0:
        matches = rank_second_degree_candidates(active_user_id, candidates, limit=limit)
        next_cursor = str(offset + len(matches)) if len(matches) == limit else None
        return {
            "data": matches,
            "nextCursor": next_cursor,
            "source": "second_degree"
        }

    # 3. Fallback: If user has no 2nd-degree connections in the graph, fall back to similarity
    exclude_ids = []
    try:
        conn_res = requests.get(
            f"{CORE_SERVICE_URL}/api/internal/connections/{active_user_id}",
            headers=_internal_headers(),
            timeout=3
        )
        if conn_res.status_code == 200:
            exclude_ids = conn_res.json().get("data", [])
    except Exception:
        pass

    matches = search_peers(active_user_id, exclude_ids=exclude_ids, limit=limit, offset=offset)
    next_cursor = str(offset + len(matches)) if len(matches) == limit else None
    return {
        "data": matches,
        "nextCursor": next_cursor,
        "source": "similarity"
    }

@app.get("/recommendations/boards")
@app.get("/boards/matched")
def get_matched_boards(
    x_user_id: str | None = Header(None, alias="x-user-id"),
    x_gateway_secret: str | None = Header(None, alias="x-gateway-secret"),
    limit: int = Query(30, ge=1, le=100),
    cursor: str | None = Query(None)
):
    _verify_internal_access(x_gateway_secret)
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing user identity")

    active_user_id = x_user_id
    ensure_data_populated()
    ensure_user_indexed(active_user_id)

    offset = _parse_safe_offset(cursor)
    matches = search_boards(active_user_id, limit=limit, offset=offset)
    next_cursor = str(offset + len(matches)) if len(matches) == limit else None
    return {
        "data": matches,
        "nextCursor": next_cursor
    }

@app.post("/internal/backfill")
def trigger_backfill(x_gateway_secret: str | None = Header(None, alias="x-gateway-secret")):
    _verify_internal_access(x_gateway_secret)
    run_startup_backfill()
    return {"status": "ok"}

@app.post("/internal/reindex/user/{user_id}")
def reindex_user(user_id: str, x_gateway_secret: str | None = Header(None, alias="x-gateway-secret")):
    _verify_internal_access(x_gateway_secret)
    res = requests.get(
        f"{CORE_SERVICE_URL}/api/internal/users-data/{user_id}",
        headers=_internal_headers(),
        timeout=5
    )
    if res.status_code != 200 or not res.json().get("data"):
        raise HTTPException(status_code=404, detail="User not found in core service")
    
    u = res.json()["data"]
    vec = compute_weighted_user_embedding(u)
    upsert_user(u["id"], vec, {
        "name": u.get("name"),
        "college_name": u.get("college_name"),
        "bio": u.get("bio"),
        "avatar_url": u.get("avatar_url"),
        "year_of_study": u.get("year_of_study"),
        "branch": u.get("branch"),
        "skills": u.get("skills", []),
        "interests": u.get("interests", []),
        "looking_for": u.get("looking_for")
    })
    return {"status": "ok", "userId": user_id}

@app.post("/internal/reindex/board/{posting_id}")
def reindex_board(posting_id: str, x_gateway_secret: str | None = Header(None, alias="x-gateway-secret")):
    _verify_internal_access(x_gateway_secret)
    res = requests.get(
        f"{CORE_SERVICE_URL}/api/internal/boards-data/{posting_id}",
        headers=_internal_headers(),
        timeout=5
    )
    if res.status_code != 200 or not res.json().get("data"):
        raise HTTPException(status_code=404, detail="Board posting not found in core service")
    
    b = res.json()["data"]
    vec = compute_board_embedding(b)
    upsert_board(b["id"], vec, {
        "title": b.get("title"),
        "description": b.get("description"),
        "group_id": b.get("group_id"),
        "group_name": b.get("group_name"),
        "creator_id": b.get("creator_id"),
        "roles_needed": b.get("roles_needed", []),
        "required_skills": b.get("required_skills", []),
        "required_interests": b.get("required_interests", []),
        "slots_total": b.get("slots_total", 1),
        "slots_filled": b.get("slots_filled", 0),
        "expires_at": b.get("expires_at"),
        "created_at": b.get("created_at")
    })
    return {"status": "ok", "postingId": posting_id}
