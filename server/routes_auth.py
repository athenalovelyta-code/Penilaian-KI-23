from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel
from typing import Optional
from server.database import get_db
from server.auth import hash_pw, create_session, delete_session, get_current_user, require_roles

router = APIRouter(prefix="/api/auth", tags=["Auth"])

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginPanitiaRequest(BaseModel):
    jabatan: str  # 'teknisi', 'kepala_sekolah', 'hrd', 'wali_kelas', 'pjk'
    password: str

class LoginPesertaRequest(BaseModel):
    profession: str     # 'Ilustrator', 'Fotografer', 'Layouter', 'Marcomm', 'Reporter'
    tabmin_group: str   # 'Kelompok 1' to 'Kelompok 6'
    password: str

@router.post("/login-panitia")
def login_panitia(req: LoginPanitiaRequest, response: Response):
    jabatan = req.jabatan.strip().lower()
    pw = req.password.strip()
    if not pw:
        raise HTTPException(status_code=400, detail="Password panitia tidak boleh kosong.")

    jabatan_roles = {
        "teknisi": ["teknisi"],
        "kepala_sekolah": ["kepala_sekolah", "wakil_kepala", "supervisor"],
        "hrd": ["hrd_kepala", "hrd_profesi", "hrd_kelompok", "hrd_kelompok_ketua", "hrd_all"],
        "wali_kelas": ["wali_kelas"],
        "pjk": ["pjk"]
    }

    if jabatan not in jabatan_roles:
        raise HTTPException(status_code=400, detail="Jabatan tidak valid. Pilih dari 5 jabatan: teknisi, kepala atau wakil kepala sekolah, HRD, wali kelas, atau PJK.")

    allowed_roles = jabatan_roles[jabatan]

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) AS total FROM users WHERE role != 'peserta'")
        if cursor.fetchone()["total"] == 0:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Database belum berisi akun panitia. Migrasikan data dari "
                    "ki23_eval.db lokal ke database Turso, lalu coba lagi."
                ),
            )
        cursor.execute("SELECT * FROM users WHERE role != 'peserta'")
        panitia_users = cursor.fetchall()
        
        matching_user = None
        other_jabatan_user = None

        for u in panitia_users:
            u_pw = (u.get("password") or "").strip()
            u_hash = u.get("password_hash")
            
            is_match = False
            if u_pw and u_pw.lower() == pw.lower():
                is_match = True
            elif u_hash and u_hash == hash_pw(pw):
                is_match = True

            if is_match:
                if u["role"] in allowed_roles:
                    matching_user = u
                    break
                else:
                    other_jabatan_user = u

        if not matching_user:
            if other_jabatan_user:
                role_label_map = {
                    "teknisi": "Teknisi",
                    "kepala_sekolah": "Kepala Sekolah",
                    "wakil_kepala": "Wakil Kepala Sekolah",
                    "supervisor": "Kepala / Wakil Kepala Sekolah",
                    "hrd_kepala": "HRD (Kepala HRD)",
                    "hrd_profesi": "HRD (HRD Profesi)",
                    "hrd_kelompok": "HRD (HRD Kelompok)",
                    "hrd_kelompok_ketua": "HRD (Ketua Kelompok)",
                    "hrd_all": "HRD",
                    "wali_kelas": f"Wali Kelas ({other_jabatan_user.get('assigned_profession') or 'Semua'})",
                    "pjk": f"PJK ({other_jabatan_user.get('assigned_group') or 'Kelompok'})"
                }
                correct_label = role_label_map.get(other_jabatan_user["role"], other_jabatan_user["role"])
                raise HTTPException(
                    status_code=401,
                    detail=f"Password ini terdaftar atas nama {other_jabatan_user['full_name']} untuk jabatan '{correct_label}'. Silakan ganti pilihan jabatan Anda."
                )
            raise HTTPException(status_code=401, detail="Password panitia salah. Silakan periksa kembali berkas Daftar Panitia.")

        role_display = {
            "teknisi": "Teknisi (Super Admin)",
            "kepala_sekolah": "Kepala Sekolah",
            "wakil_kepala": "Wakil Kepala Sekolah",
            "supervisor": "Pengawas / Supervisor",
            "hrd_kepala": "Kepala HRD",
            "hrd_profesi": "HRD Profesi",
            "hrd_kelompok": "HRD Kelompok",
            "hrd_kelompok_ketua": "HRD Kelompok (Ketua)",
            "hrd_all": "HRD Profesi & Kelompok",
            "wali_kelas": f"Wali Kelas ({matching_user.get('assigned_profession') or 'Semua'})",
            "pjk": f"PJK ({matching_user.get('assigned_group') or 'Kelompok'})"
        }.get(matching_user["role"], matching_user["role"])

        user_data = {
            "id": matching_user["id"],
            "username": matching_user["username"],
            "full_name": matching_user["full_name"],
            "role": matching_user["role"],
            "assigned_group": matching_user["assigned_group"],
            "assigned_profession": matching_user["assigned_profession"],
            "is_panitia": True,
            "role_display": role_display
        }
        token = create_session(user_data)
        response.set_cookie(key="session_token", value=token, httponly=False, samesite="lax")
        return {
            "success": True,
            "token": token,
            "user": user_data,
            "message": f"Selamat datang, {matching_user['full_name']}! Masuk sebagai {role_display}."
        }

@router.post("/login-peserta")
def login_peserta(req: LoginPesertaRequest, response: Response):
    prof = req.profession.strip()
    grp = req.tabmin_group.strip()
    pw = req.password.strip()

    if not prof or not grp or not pw:
        raise HTTPException(status_code=400, detail="Profesi, Kelompok Tabmin, dan Password wajib diisi.")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) AS total FROM participants")
        if cursor.fetchone()["total"] == 0:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Database belum berisi data peserta. Migrasikan data dari "
                    "ki23_eval.db lokal ke database Turso, lalu coba lagi."
                ),
            )
        cursor.execute("SELECT * FROM participants WHERE LOWER(TRIM(profession)) = LOWER(?) AND LOWER(TRIM(tabmin_group)) = LOWER(?)", (prof, grp))
        group_participants = cursor.fetchall()

        matched_p = None
        for p in group_participants:
            p_pw = (p.get("password") or "").strip()
            p_hash = p.get("password_hash")
            if (p_pw and p_pw.lower() == pw.lower()) or (p_hash and p_hash == hash_pw(pw)):
                matched_p = p
                break

        if not matched_p:
            # Check if password matches a participant in another group/profession to give a clear hint
            cursor.execute("SELECT * FROM participants WHERE LOWER(TRIM(password)) = LOWER(?)", (pw,))
            other_p = cursor.fetchone()
            if other_p:
                raise HTTPException(
                    status_code=401,
                    detail=f"Password ini cocok untuk peserta atas nama '{other_p['name']}', namun terdaftar pada Divisi {other_p['profession']} dan {other_p['tabmin_group']}. Pastikan pilihan profesi dan kelompok Anda sesuai."
                )
            raise HTTPException(
                status_code=401,
                detail=f"Password tidak cocok untuk divisi {prof} di {grp}. Silakan periksa kembali berkas Pengumuman Tahap 1 KI."
            )

        user_data = {
            "id": f"p_{matched_p['id']}",
            "participant_id": matched_p["id"],
            "username": f"peserta_{matched_p['id']}",
            "full_name": matched_p["name"],
            "role": "peserta",
            "assigned_group": matched_p["tabmin_group"],
            "assigned_profession": matched_p["profession"],
            "is_panitia": False
        }
        token = create_session(user_data)
        response.set_cookie(key="session_token", value=token, httponly=False, samesite="lax")
        return {
            "success": True,
            "token": token,
            "user": user_data,
            "participant": matched_p,
            "message": f"Selamat datang, {matched_p['name']}! Masuk sebagai Peserta {matched_p['tabmin_group']} - Divisi {matched_p['profession']}."
        }

@router.post("/login")
def login(req: LoginRequest, response: Response):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (req.username.strip(),))
        user = cursor.fetchone()
        
        if not user or user["password_hash"] != hash_pw(req.password.strip()):
            raise HTTPException(status_code=401, detail="Username atau password salah.")
            
        user_data = {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
            "assigned_group": user["assigned_group"],
            "assigned_profession": user["assigned_profession"],
        }
        token = create_session(user_data)
        response.set_cookie(key="session_token", value=token, httponly=False, samesite="lax")
        return {"success": True, "token": token, "user": user_data}

@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return {"user": user}

@router.post("/logout")
def logout(request: Request, response: Response, _: dict = Depends(get_current_user)):
    # Delete cookies and remove session
    authorization = request.headers.get("authorization", "")
    if authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    else:
        token = request.cookies.get("session_token") or request.query_params.get("token")
    if token:
        delete_session(token)
    response.delete_cookie("session_token")
    return {"success": True, "message": "Berhasil logout"}

@router.get("/search-names")
def search_names(q: Optional[str] = "", _: dict = Depends(require_roles(["teknisi"]))):
    query_str = (q or "").strip().lower()
    if not query_str or len(query_str) < 2:
        return {"results": []}

    results = []
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Search panitia/users
        cursor.execute("""
            SELECT id, full_name, role, assigned_group, assigned_profession
            FROM users
            WHERE LOWER(full_name) LIKE ? OR LOWER(username) LIKE ?
            LIMIT 6
        """, (f"%{query_str}%", f"%{query_str}%"))
        users = cursor.fetchall()
        for u in users:
            role_labels = {
                "teknisi": "Teknisi (Super Admin)",
                "kepala_sekolah": "Kepala Sekolah",
                "wakil_kepala": "Wakil Kepala Sekolah",
                "supervisor": "Pengawas / Supervisor",
                "hrd_kepala": "Kepala HRD",
                "hrd_kelompok_ketua": "HRD Kelompok (Ketua)",
                "hrd_profesi": "HRD Profesi",
                "hrd_kelompok": "HRD Kelompok",
                "hrd_all": "HRD Kelompok & Profesi",
                "wali_kelas": f"Wali Kelas ({u['assigned_profession'] or 'Semua'})",
                "pjk": f"PJK ({u['assigned_group'] or 'Kelompok'})"
            }
            results.append({
                "name": u["full_name"],
                "type": "panitia",
                "role": u["role"],
                "label": role_labels.get(u["role"], u["role"]),
                "details": f"Panitia KI23 • {role_labels.get(u['role'], u['role'])}"
            })

        # 2. Search participants
        cursor.execute("""
            SELECT id, name, profession, tabmin_group, jurusan
            FROM participants
            WHERE LOWER(name) LIKE ?
            LIMIT 8
        """, (f"%{query_str}%",))
        parts = cursor.fetchall()
        for p in parts:
            results.append({
                "name": p["name"],
                "type": "peserta",
                "role": "peserta",
                "id": p["id"],
                "group": p["tabmin_group"],
                "profession": p["profession"],
                "label": f"{p['tabmin_group']} • {p['profession']}",
                "details": f"Peserta • {p['tabmin_group']} • Divisi {p['profession']}"
            })

    return {"results": results}

@router.get("/panitia-list")
def get_panitia_list(_: dict = Depends(require_roles(["teknisi"]))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, full_name, role, assigned_group, assigned_profession, username
            FROM users
            WHERE role != 'peserta'
            ORDER BY 
                CASE role
                    WHEN 'teknisi' THEN 0
                    WHEN 'kepala_sekolah' THEN 1
                    WHEN 'wakil_kepala' THEN 2
                    WHEN 'supervisor' THEN 3
                    WHEN 'hrd_kepala' THEN 4
                    WHEN 'hrd_kelompok_ketua' THEN 5
                    WHEN 'hrd_profesi' THEN 6
                    WHEN 'hrd_kelompok' THEN 7
                    WHEN 'hrd_all' THEN 8
                    WHEN 'wali_kelas' THEN 9
                    WHEN 'pjk' THEN 10
                    ELSE 11
                END, full_name
        """)
        users = cursor.fetchall()
        return {"panitia": users}
