import hashlib
import json
import uuid
from typing import Optional, List
from fastapi import Request, HTTPException, Depends, Header, Cookie
from server.database import get_db

def hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def create_session(user_data: dict) -> str:
    token = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            "INSERT INTO sessions (session_token, user_data, auth_method) VALUES (?, ?, ?)",
            (token, json.dumps(user_data), "password"),
        )
    return token

def delete_session(token: str):
    with get_db() as conn:
        conn.execute("DELETE FROM sessions WHERE session_token = ?", (token,))

def revoke_sessions_from_insecure_login_flows():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS auth_security_migrations (
                migration_id TEXT PRIMARY KEY
            )
        """)
        cursor = conn.execute(
            "INSERT OR IGNORE INTO auth_security_migrations (migration_id) VALUES (?)",
            ("revoke-insecure-login-sessions-v1",),
        )
        if cursor.rowcount:
            conn.execute("DELETE FROM sessions")

def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None)
) -> dict:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    elif session_token:
        token = session_token
    elif request.query_params.get("token"):
        token = request.query_params.get("token")
        
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Autentikasi diperlukan. Silakan login terlebih dahulu."
        )

    with get_db() as conn:
        row = conn.execute(
            "SELECT user_data FROM sessions "
            "WHERE session_token = ? AND auth_method = 'password'",
            (token,),
        ).fetchone()
    if not row:
        raise HTTPException(
            status_code=401,
            detail="Autentikasi diperlukan. Silakan login terlebih dahulu."
        )
    return json.loads(row["user_data"])

def require_roles(allowed_roles: List[str]):
    def role_checker(user: dict = Depends(get_current_user)):
        user_role = user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Akses Ditolak: Role '{user_role}' tidak memiliki izin untuk mengakses resource ini."
            )
        return user
    return role_checker

def apply_user_scope(
    user: dict,
    group: Optional[str] = None,
    profession: Optional[str] = None
):
    role = user.get("role")
    assigned_group = user.get("assigned_group")
    assigned_profession = user.get("assigned_profession")

    if role in ["pjk", "hrd_kelompok"] and (not assigned_group or assigned_group == "ALL"):
        raise HTTPException(status_code=403, detail="Akun ini tidak memiliki kelompok penugasan.")
    if role == "hrd_profesi" and not assigned_profession:
        raise HTTPException(status_code=403, detail="Akun ini tidak memiliki profesi penugasan.")
    if role == "hrd_all" and (not assigned_group or assigned_group == "ALL" or not assigned_profession):
        raise HTTPException(status_code=403, detail="Akun HRD Profesi dan Kelompok harus memiliki penugasan profesi dan kelompok.")

    if assigned_group and assigned_group != "ALL":
        group = assigned_group
    if assigned_profession and assigned_profession != "ALL":
        profession = assigned_profession
    return group, profession

def ensure_participant_scope(user: dict, participant: dict):
    if user.get("role") == "peserta":
        group = user.get("assigned_group")
        if not group:
            raise HTTPException(status_code=403, detail="Akun peserta tidak memiliki kelompok Tabmin.")
        if participant.get("tabmin_group") != group:
            raise HTTPException(status_code=403, detail=f"Peserta hanya dapat menilai rekan dari {group}.")
        return

    group, profession = apply_user_scope(user)
    if user.get("role") == "hrd_all":
        if participant.get("tabmin_group") != group and participant.get("profession") != profession:
            raise HTTPException(
                status_code=403,
                detail=f"Akses hanya untuk peserta {group} atau profesi {profession}.",
            )
        return

    if group and participant.get("tabmin_group") != group:
        raise HTTPException(status_code=403, detail=f"Akses hanya untuk peserta {group}.")
    if profession and participant.get("profession") != profession:
        raise HTTPException(status_code=403, detail=f"Akses hanya untuk peserta profesi {profession}.")

# Quick helper for role verification
def is_supervisor_or_hrd(role: str) -> bool:
    return role in [
        "teknisi", "supervisor", "kepala_sekolah", "wakil_kepala",
        "hrd_kepala", "hrd_profesi", "hrd_kelompok", "hrd_kelompok_ketua", "hrd_all"
    ]

def is_teknisi(role: str) -> bool:
    return role == "teknisi"

def is_supervisor_readonly(role: str) -> bool:
    return role in ["supervisor", "kepala_sekolah", "wakil_kepala"]
