import numpy as np
from fastembed import TextEmbedding
from src.config import MODEL_NAME

# Load the lightweight ONNX-powered embedding model (no PyTorch, only ~50MB)
print(f"[EmbeddingEngine] Initializing fastembed ONNX model: {MODEL_NAME}...")
model = TextEmbedding(model_name=MODEL_NAME)
print("[EmbeddingEngine] Lightweight ONNX model ready.")

# User profile field weights (sums to 1.0)
USER_WEIGHTS = {
    "skills": 0.45,      # Highest priority
    "college": 0.25,     # Second priority
    "interests": 0.20,   # Third priority
    "bio": 0.10          # Fourth priority
}

# Board posting field weights (sums to 1.0)
BOARD_WEIGHTS = {
    "skills_roles": 0.55,
    "title_desc": 0.45
}

def compute_weighted_user_embedding(user_data: dict) -> list[float]:
    """
    Computes a 384-dimensional dense vector representation of a user profile
    with prioritized weights: Skills (45%), College (25%), Interests (20%), Bio (10%).
    """
    skills_list = user_data.get("skills") or []
    if isinstance(skills_list, list):
        skills_str = ", ".join([str(s) for s in skills_list if s])
    else:
        skills_str = str(skills_list)
    skills_text = f"Technical skills and competencies: {skills_str or 'None'}"

    college_name = user_data.get("college_name") or "General College"
    college_text = f"Institution and college campus: {college_name}"

    interests_list = user_data.get("interests") or []
    if isinstance(interests_list, list):
        interests_str = ", ".join([str(i) for i in interests_list if i])
    else:
        interests_str = str(interests_list)
    interests_text = f"Academic and personal interests: {interests_str or 'None'}"

    bio = user_data.get("bio") or ""
    looking_for = user_data.get("looking_for") or ""
    branch = user_data.get("branch") or ""
    year = user_data.get("year_of_study") or ""
    bio_text = f"Biography: {bio}. Academic details: {branch} Year {year}. Intent: {looking_for}."

    # Batch encode all 4 sections in a single fast ONNX pass
    vectors = list(model.embed([skills_text, college_text, interests_text, bio_text]))
    v_skills, v_college, v_interests, v_bio = vectors

    # Weighted linear combination
    combined = (
        USER_WEIGHTS["skills"] * v_skills +
        USER_WEIGHTS["college"] * v_college +
        USER_WEIGHTS["interests"] * v_interests +
        USER_WEIGHTS["bio"] * v_bio
    )

    # L2-normalize to unit length for exact Cosine Distance
    norm = np.linalg.norm(combined)
    final_vec = (combined / norm) if norm > 0 else combined

    return final_vec.tolist()


def compute_board_embedding(board_data: dict) -> list[float]:
    """
    Computes a 384-dimensional dense vector representation of a board posting
    with prioritized weights: Required Skills & Roles (55%), Title & Description (45%).
    """
    roles = board_data.get("roles_needed") or []
    if isinstance(roles, list):
        roles_str = ", ".join([str(r) for r in roles if r])
    else:
        roles_str = str(roles)

    # Hydrated skills/interests
    req_skills = board_data.get("required_skills") or board_data.get("required_skill_names") or []
    if isinstance(req_skills, list):
        skills_str = ", ".join([str(s.get("name") if isinstance(s, dict) else s) for s in req_skills if s])
    else:
        skills_str = str(req_skills)

    skills_roles_text = f"Required skills: {skills_str}. Roles needed: {roles_str}."

    title = board_data.get("title") or ""
    description = board_data.get("description") or ""
    group_name = board_data.get("group_name") or ""
    title_desc_text = f"Project title: {title}. Group: {group_name}. Details: {description}."

    # Batch encode sections with ONNX
    vectors = list(model.embed([skills_roles_text, title_desc_text]))
    v_skills_roles, v_title_desc = vectors

    # Weighted combination
    combined = (
        BOARD_WEIGHTS["skills_roles"] * v_skills_roles +
        BOARD_WEIGHTS["title_desc"] * v_title_desc
    )

    norm = np.linalg.norm(combined)
    final_vec = (combined / norm) if norm > 0 else combined

    return final_vec.tolist()
