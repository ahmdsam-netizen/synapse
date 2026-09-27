import json
import time
import psycopg2
from psycopg2.extras import Json
from pgvector.psycopg2 import register_vector
from src.config import VECTOR_DATABASE_URL

print(f"[VectorDB] Connecting to independent pgvector instance...")

_extension_initialized = False

def get_connection():
    """Establishes and returns a connection to the dedicated pgvector PostgreSQL instance."""
    global _extension_initialized
    for attempt in range(10):
        try:
            conn = psycopg2.connect(VECTOR_DATABASE_URL)
            conn.autocommit = True
            
            # Bootstrap the vector extension if not yet created before registering vector types
            if not _extension_initialized:
                with conn.cursor() as cur:
                    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                _extension_initialized = True
                
            register_vector(conn)
            conn.autocommit = False
            return conn
        except Exception as e:
            _extension_initialized = False
            print(f"[VectorDB] Connection attempt {attempt + 1} failed: {e}")
            time.sleep(2)
    raise RuntimeError("Could not connect to independent pgvector database after 10 attempts.")

def init_vector_database():
    """Creates the vector extension, tables, and HNSW indexes on the dedicated vector database."""
    print("[VectorDB] Initializing pgvector extension and HNSW indexes...")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            
            # User profile embeddings table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS user_embeddings (
                    user_id UUID PRIMARY KEY,
                    embedding vector(384) NOT NULL,
                    metadata JSONB DEFAULT '{}',
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """)

            # HNSW index for sub-millisecond cosine distance search on users
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_embeddings_hnsw 
                ON user_embeddings USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64);
            """)

            # Board postings embeddings table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS board_posting_embeddings (
                    posting_id UUID PRIMARY KEY,
                    creator_id UUID,
                    embedding vector(384) NOT NULL,
                    metadata JSONB DEFAULT '{}',
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """)

            # HNSW index for board opportunities
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_board_embeddings_hnsw 
                ON board_posting_embeddings USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64);
            """)

            conn.commit()
            print("[VectorDB] Dedicated pgvector database initialized with HNSW indexes.")
    finally:
        conn.close()

def get_counts() -> dict:
    """Returns vector counts from the independent vector database."""
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM user_embeddings;")
            user_cnt = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM board_posting_embeddings;")
            board_cnt = cur.fetchone()[0]
            return {"users": user_cnt, "boards": board_cnt}
    except Exception as e:
        print(f"[VectorDB] Error fetching counts: {e}")
        return {"users": 0, "boards": 0}
    finally:
        if 'conn' in locals() and conn:
            conn.close()

def upsert_user(user_id: str, vector: list[float], metadata: dict):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO user_embeddings (user_id, embedding, metadata, updated_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW();
            """, (user_id, vector, Json(metadata)))
            conn.commit()
    finally:
        conn.close()

def upsert_board(posting_id: str, vector: list[float], metadata: dict):
    conn = get_connection()
    try:
        creator_id = metadata.get("creator_id")
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO board_posting_embeddings (posting_id, creator_id, embedding, metadata, updated_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (posting_id) DO UPDATE SET
                    creator_id = EXCLUDED.creator_id,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW();
            """, (posting_id, creator_id, vector, Json(metadata)))
            conn.commit()
    finally:
        conn.close()

def purge_stale_records(active_user_ids: list[str] = None, active_board_ids: list[str] = None):
    """Deletes vectors that no longer exist in the primary PostgreSQL database."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if active_user_ids:
                cur.execute("DELETE FROM user_embeddings WHERE NOT (user_id = ANY(%s::uuid[]));", (active_user_ids,))
            if active_board_ids:
                cur.execute("DELETE FROM board_posting_embeddings WHERE NOT (posting_id = ANY(%s::uuid[]));", (active_board_ids,))
            conn.commit()
    except Exception as e:
        print(f"[VectorDB] Error purging stale records: {e}")
    finally:
        conn.close()

def has_user_vector(user_id: str) -> bool:
    """Checks whether an embedding already exists for the given user."""
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM user_embeddings WHERE user_id = %s::uuid;", (user_id,))
            return cur.fetchone() is not None
    except Exception as e:
        print(f"[VectorDB] Error checking user vector: {e}")
        return False
    finally:
        if 'conn' in locals() and conn:
            conn.close()

def search_peers(user_id: str, exclude_ids: list[str], limit: int = 30, offset: int = 0) -> list[dict]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Check target user vector exists
            cur.execute("SELECT 1 FROM user_embeddings WHERE user_id = %s::uuid;", (user_id,))
            if not cur.fetchone():
                return []

            # Prepare exclusions array with only valid UUID strings
            valid_excludes = [str(x).strip() for x in (exclude_ids or []) if x and len(str(x).strip()) == 36]

            if valid_excludes:
                sql = """
                    SELECT 
                        ue.user_id,
                        ue.metadata,
                        1 - (ue.embedding <=> target.embedding) AS similarity_score
                    FROM user_embeddings ue
                    CROSS JOIN (
                        SELECT embedding FROM user_embeddings WHERE user_id = %s::uuid
                    ) target
                    WHERE ue.user_id != %s::uuid
                      AND NOT (ue.user_id = ANY(%s::uuid[]))
                    ORDER BY ue.embedding <=> target.embedding ASC
                    LIMIT %s OFFSET %s;
                """
                cur.execute(sql, (user_id, user_id, valid_excludes, limit, offset))
            else:
                sql = """
                    SELECT 
                        ue.user_id,
                        ue.metadata,
                        1 - (ue.embedding <=> target.embedding) AS similarity_score
                    FROM user_embeddings ue
                    CROSS JOIN (
                        SELECT embedding FROM user_embeddings WHERE user_id = %s::uuid
                    ) target
                    WHERE ue.user_id != %s::uuid
                    ORDER BY ue.embedding <=> target.embedding ASC
                    LIMIT %s OFFSET %s;
                """
                cur.execute(sql, (user_id, user_id, limit, offset))

            rows = cur.fetchall()

            matches = []
            for row in rows:
                uid, meta, score = row
                if not meta:
                    meta = {}
                score_flt = max(0.0, min(1.0, float(score)))
                match_pct = round(score_flt * 100)
                matches.append({
                    "id": str(uid),
                    "name": meta.get("name"),
                    "collegeName": meta.get("college_name") or "Campus Member",
                    "college_name": meta.get("college_name") or "Campus Member",
                    "bio": meta.get("bio") or "",
                    "avatarUrl": meta.get("avatar_url"),
                    "avatar_url": meta.get("avatar_url"),
                    "year": meta.get("year_of_study") or 1,
                    "yearOfStudy": meta.get("year_of_study") or 1,
                    "year_of_study": meta.get("year_of_study") or 1,
                    "branch": meta.get("branch") or "",
                    "skills": meta.get("skills", []),
                    "allSkills": meta.get("skills", []),
                    "interests": meta.get("interests", []),
                    "allInterests": meta.get("interests", []),
                    "lookingFor": meta.get("looking_for"),
                    "looking_for": meta.get("looking_for"),
                    "similarity_score": round(score_flt, 4),
                    "similarityScore": round(score_flt, 4),
                    "matchScore": round(score_flt, 4),
                    "matchPercentage": match_pct,
                    "match_percentage": match_pct,
                    "match_reasons": [
                        f"Skills match ({match_pct}% compatibility)",
                        f"Institution: {meta.get('college_name') or 'Student'}"
                    ]
                })

            return matches
    except Exception as e:
        print(f"[VectorDB] Error in search_peers: {e}")
        return []
    finally:
        conn.close()

def rank_second_degree_candidates(user_id: str, candidates: list[dict], limit: int = 30) -> list[dict]:
    """
    Ranks 2nd-degree network candidates (friends of friends) using mutual connections count
    combined with vector cosine similarity from pgvector user_embeddings.
    """
    if not candidates:
        return []

    candidate_map = {str(c["candidate_id"]): c for c in candidates if c.get("candidate_id")}
    candidate_ids = list(candidate_map.keys())
    if not candidate_ids:
        return []

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM user_embeddings WHERE user_id = %s::uuid;", (user_id,))
            has_target = cur.fetchone() is not None

            if has_target:
                sql = """
                    SELECT 
                        ue.user_id,
                        ue.metadata,
                        1 - (ue.embedding <=> target.embedding) AS similarity_score
                    FROM user_embeddings ue
                    CROSS JOIN (
                        SELECT embedding FROM user_embeddings WHERE user_id = %s::uuid
                    ) target
                    WHERE ue.user_id = ANY(%s::uuid[]);
                """
                cur.execute(sql, (user_id, candidate_ids))
            else:
                sql = """
                    SELECT 
                        ue.user_id,
                        ue.metadata,
                        0.5 AS similarity_score
                    FROM user_embeddings ue
                    WHERE ue.user_id = ANY(%s::uuid[]);
                """
                cur.execute(sql, (candidate_ids,))

            rows = cur.fetchall()

            matches = []
            for row in rows:
                uid_str = str(row[0])
                meta = row[1] or {}
                sim_score = max(0.0, min(1.0, float(row[2])))
                match_pct = round(sim_score * 100)
                cand_info = candidate_map.get(uid_str, {})
                mutual_count = int(cand_info.get("mutual_count") or 1)
                via_id = cand_info.get("via_connection_id")
                via_name = cand_info.get("via_connection_name") or "A mutual connection"

                hybrid_score = (mutual_count * 100.0) + (sim_score * 50.0)

                matches.append({
                    "id": uid_str,
                    "name": meta.get("name"),
                    "collegeName": meta.get("college_name") or "Campus Member",
                    "college_name": meta.get("college_name") or "Campus Member",
                    "bio": meta.get("bio") or "",
                    "avatarUrl": meta.get("avatar_url"),
                    "avatar_url": meta.get("avatar_url"),
                    "year": meta.get("year_of_study") or 1,
                    "yearOfStudy": meta.get("year_of_study") or 1,
                    "year_of_study": meta.get("year_of_study") or 1,
                    "branch": meta.get("branch") or "",
                    "skills": meta.get("skills", []),
                    "allSkills": meta.get("skills", []),
                    "interests": meta.get("interests", []),
                    "allInterests": meta.get("interests", []),
                    "lookingFor": meta.get("looking_for"),
                    "looking_for": meta.get("looking_for"),
                    "score": round(hybrid_score, 2),
                    "similarity_score": round(sim_score, 4),
                    "similarityScore": round(sim_score, 4),
                    "mutualCount": mutual_count,
                    "mutual_count": mutual_count,
                    "viaConnection": {
                        "id": str(via_id) if via_id else None,
                        "name": via_name
                    },
                    "viaConnectionName": via_name,
                    "match_reasons": [
                        f"{mutual_count} mutual connection{'s' if mutual_count > 1 else ''} via {via_name}",
                        f"Institution: {meta.get('college_name') or 'Student'}"
                    ]
                })

            matches.sort(key=lambda x: x["score"], reverse=True)
            return matches[:limit]
    except Exception as e:
        print(f"[VectorDB] Error in rank_second_degree_candidates: {e}")
        return []
    finally:
        conn.close()

def search_boards(user_id: str, limit: int = 30, offset: int = 0) -> list[dict]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Check target user vector exists
            cur.execute("SELECT 1 FROM user_embeddings WHERE user_id = %s::uuid;", (user_id,))
            if not cur.fetchone():
                return []

            sql = """
                SELECT 
                    bpe.posting_id,
                    bpe.metadata,
                    1 - (bpe.embedding <=> target.embedding) AS match_score
                FROM board_posting_embeddings bpe
                CROSS JOIN (
                    SELECT embedding FROM user_embeddings WHERE user_id = %s::uuid
                ) target
                WHERE (bpe.creator_id IS NULL OR bpe.creator_id != %s::uuid)
                ORDER BY bpe.embedding <=> target.embedding ASC
                LIMIT %s OFFSET %s;
            """
            cur.execute(sql, (user_id, user_id, limit, offset))
            rows = cur.fetchall()

            matches = []
            for row in rows:
                pid, meta, score = row
                if not meta:
                    meta = {}
                score_flt = max(0.0, min(1.0, float(score)))
                match_pct = round(score_flt * 100)
                matches.append({
                    "id": str(pid),
                    "title": meta.get("title"),
                    "description": meta.get("description"),
                    "groupId": meta.get("group_id"),
                    "group_id": meta.get("group_id"),
                    "groupName": meta.get("group_name") or "Collaborative Group",
                    "group_name": meta.get("group_name") or "Collaborative Group",
                    "rolesNeeded": meta.get("roles_needed", []),
                    "roles_needed": meta.get("roles_needed", []),
                    "requiredSkills": meta.get("required_skills", []),
                    "required_skills": meta.get("required_skills", []),
                    "requiredInterests": meta.get("required_interests", []),
                    "required_interests": meta.get("required_interests", []),
                    "slotsTotal": meta.get("slots_total", 1),
                    "slots_total": meta.get("slots_total", 1),
                    "slotsFilled": meta.get("slots_filled", 0),
                    "slots_filled": meta.get("slots_filled", 0),
                    "expiresAt": meta.get("expires_at"),
                    "expires_at": meta.get("expires_at"),
                    "createdAt": meta.get("created_at"),
                    "created_at": meta.get("created_at"),
                    "semantic_match_score": round(score_flt, 4),
                    "semanticMatchScore": round(score_flt, 4),
                    "matchScore": round(score_flt, 4),
                    "matchPercentage": match_pct,
                    "match_percentage": match_pct
                })

            return matches
    except Exception as e:
        print(f"[VectorDB] Error in search_boards: {e}")
        return []
    finally:
        conn.close()
