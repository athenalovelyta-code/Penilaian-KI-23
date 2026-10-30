from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from server.database import get_db
from server.auth import apply_user_scope, ensure_participant_scope, get_current_user, require_roles

router = APIRouter(prefix="/api/eval", tags=["Evaluation"])

# Models
class TabminMemberEvalInput(BaseModel):
    participant_id: int
    score_kehadiran: int = Field(..., ge=1, le=5)
    score_partisipasi: int = Field(..., ge=1, le=5)
    score_sikap: int = Field(..., ge=1, le=5)
    notes: Optional[str] = None

class TabminProductEvalInput(BaseModel):
    tabmin_group: str
    score_reporter: int = Field(..., ge=1, le=5)
    score_fotografer: int = Field(..., ge=1, le=5)
    score_ilustrator: int = Field(..., ge=1, le=5)
    score_layouter: int = Field(..., ge=1, le=5)
    score_marcomm: int = Field(..., ge=1, le=5)
    notes: Optional[str] = None

class ProfesiGeneralEvalInput(BaseModel):
    participant_id: int
    keprof_session: int = Field(..., ge=1, le=3)
    score_kehadiran: int = Field(..., ge=1, le=5)
    score_partisipasi: int = Field(..., ge=1, le=5)
    score_sikap: int = Field(..., ge=1, le=5)
    notes: Optional[str] = None

class ProfesiTaskEvalInput(BaseModel):
    participant_id: int
    keprof_session: int = Field(..., ge=1, le=2)
    is_replacement: int = Field(0, ge=0, le=1) # 0 = tugas utama, 1 = tugas pengganti
    score_teknis: Optional[int] = Field(None, ge=1, le=5) # HRD Profesi
    score_isi: Optional[int] = Field(None, ge=1, le=5)    # Wali Kelas
    task_notes: Optional[str] = None

class ProfesiAttendanceInput(BaseModel):
    participant_id: int
    keprof_session: int = Field(..., ge=1, le=3)
    is_absen: int = Field(..., ge=0, le=1)

# --- Helpers ---
@router.get("/participants")
def get_participants(
    group: Optional[str] = None,
    profession: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    role = user.get("role")
    
    # Isolation rules for listing participants
    # Peserta can peer-review every member of their Tabmin group, regardless of profession.
    current_pid = None
    if role == "peserta":
        group = user.get("assigned_group")
        current_pid = user.get("participant_id")
        if not group or group == "ALL":
            raise HTTPException(status_code=403, detail="Akun peserta tidak memiliki kelompok Tabmin.")
        profession = None
    else:
        # Wali Kelas: if assigned specific profession, filter by it
        if role == "wali_kelas" and user.get("assigned_profession") and user.get("assigned_profession") != "ALL":
            profession = user.get("assigned_profession")
        if role == "hrd_all":
            group, profession = apply_user_scope(user)
        else:
            group, profession = apply_user_scope(user, group, profession)

    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT id, name, profession, tabmin_group, pjk_name, whatsapp_group, jurusan FROM participants WHERE 1=1"
        params = []
        if role == "hrd_all":
            query += " AND (tabmin_group = ? OR profession = ?)"
            params.extend((group, profession))
        elif group:
            query += " AND tabmin_group = ?"
            params.append(group)
        if role != "hrd_all" and profession:
            query += " AND profession = ?"
            params.append(profession)
        if current_pid:
            query += " AND id != ?"
            params.append(current_pid)
            
        query += " ORDER BY tabmin_group, profession, name"
        cursor.execute(query, params)
        participants = cursor.fetchall()
        return {"participants": participants}

@router.get("/professions-summary")
def get_professions_summary():
    """Public helper for Gateway page showing counts and descriptions."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT profession, COUNT(id) as total_members
            FROM participants
            GROUP BY profession
            ORDER BY profession
        """)
        rows = cursor.fetchall()
        meta = {
            "Ilustrator": {"icon": "fas fa-palette", "color": "#ec4899", "desc": "Visual artist, ilustrasi digital, sketsa editorial & estetika karya."},
            "Fotografer": {"icon": "fas fa-camera", "color": "#06b6d4", "desc": "Fotografi jurnalistik, dokumentasi acara & visual storytelling."},
            "Layouter": {"icon": "fas fa-layer-group", "color": "#8b5cf6", "desc": "Desain grafis editorial, tata letak media, tipografi & komposisi majalah."},
            "Marcomm": {"icon": "fas fa-bullhorn", "color": "#f59e0b", "desc": "Marketing communication, publikasi promosi medsos & branding acara."},
            "Reporter": {"icon": "fas fa-newspaper", "color": "#10b981", "desc": "Jurnalisme investigatif, wawancara narasumber & penulisan naskah berita."}
        }
        res = []
        for r in rows:
            p = r["profession"]
            m = meta.get(p, {"icon": "fas fa-briefcase", "color": "#6366f1", "desc": "Divisi profesi KI23"})
            res.append({
                "profession": p,
                "total_members": r["total_members"],
                "icon": m["icon"],
                "color": m["color"],
                "desc": m["desc"]
            })
        return {"professions": res}

@router.get("/groups")
def get_groups():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT tabmin_group, pjk_name, whatsapp_group,
                   COUNT(id) as total_members
            FROM participants
            GROUP BY tabmin_group
            ORDER BY tabmin_group
        """)
        groups = cursor.fetchall()
        return {"groups": groups}

@router.get("/professions")
def get_professions():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT profession, COUNT(id) as total_members
            FROM participants
            GROUP BY profession
            ORDER BY profession
        """)
        profs = cursor.fetchall()
        return {"professions": profs}

# --- 1. Tabmin Member Evaluation ---
@router.post("/tabmin-member")
def save_tabmin_member_eval(
    data: TabminMemberEvalInput,
    user: dict = Depends(get_current_user)
):
    role = user.get("role")
    evaluator_name = user.get("full_name") or user.get("username")
    evaluator_id = user.get("id") if isinstance(user.get("id"), int) else None
    
    # Access checks
    if role in ["hrd_kelompok", "hrd_kelompok_ketua", "hrd_kepala", "hrd_all", "teknisi"]:
        evaluator_role = "hrd"
    elif role == "pjk":
        evaluator_role = "pjk"
    elif role == "peserta":
        evaluator_role = "peer"
        # Peer cannot evaluate self
        if user.get("participant_id") == data.participant_id:
            raise HTTPException(status_code=400, detail="Peserta tidak dapat menilai diri sendiri.")
    else:
        raise HTTPException(status_code=403, detail=f"Role '{role}' tidak diizinkan menginput penilaian anggota Tabmin.")


    with get_db() as conn:
        cursor = conn.cursor()
        # Verify target participant
        cursor.execute("SELECT id, name, profession, tabmin_group FROM participants WHERE id = ?", (data.participant_id,))
        p = cursor.fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="Peserta tidak ditemukan.")
            
        ensure_participant_scope(user, p)

        # Upsert evaluation
        cursor.execute("""
            INSERT INTO tabmin_member_evaluations
            (participant_id, evaluator_role, evaluator_id, evaluator_name, tabmin_group,
             score_kehadiran, score_partisipasi, score_sikap, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(participant_id, evaluator_role, evaluator_name) DO UPDATE SET
                score_kehadiran = excluded.score_kehadiran,
                score_partisipasi = excluded.score_partisipasi,
                score_sikap = excluded.score_sikap,
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP
        """, (data.participant_id, evaluator_role, evaluator_id, evaluator_name, p["tabmin_group"],
              data.score_kehadiran, data.score_partisipasi, data.score_sikap, data.notes))

        return {"success": True, "message": f"Penilaian untuk {p['name']} berhasil disimpan."}

@router.get("/tabmin-member/my-evaluations")
def get_my_tabmin_evaluations(user: dict = Depends(get_current_user)):
    """Allows current evaluator (PJK, HRD, or Peer) to see only their submitted ratings."""
    evaluator_name = user.get("full_name") or user.get("username")
    if user.get("role") == "peserta":
        group = user.get("assigned_group")
        if not group or group == "ALL":
            raise HTTPException(status_code=403, detail="Akun peserta tidak memiliki kelompok Tabmin.")
        profession = None
    else:
        group, profession = apply_user_scope(user)
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT e.*, p.name as participant_name, p.tabmin_group, p.profession
            FROM tabmin_member_evaluations e
            JOIN participants p ON e.participant_id = p.id
            WHERE e.evaluator_name = ?
            ORDER BY p.name
        """, (evaluator_name,))
        rows = cursor.fetchall()
        if user.get("role") == "hrd_all":
            rows = [
                row for row in rows
                if row["tabmin_group"] == group or row["profession"] == profession
            ]
        else:
            if group:
                rows = [row for row in rows if row["tabmin_group"] == group]
            if profession:
                rows = [row for row in rows if row["profession"] == profession]
        return {"evaluations": rows}

# --- 2. Tabmin Product Evaluation ---
@router.post("/tabmin-product")
def save_tabmin_product_eval(
    data: TabminProductEvalInput,
    user: dict = Depends(require_roles(["hrd_kelompok", "hrd_kelompok_ketua", "hrd_kepala", "hrd_all", "teknisi"]))
):
    role = user.get("role")
    evaluator_name = user.get("full_name") or user.get("username")
    evaluator_id = user.get("id") if isinstance(user.get("id"), int) else None

    # HRD Kelompok isolation: can only rate their assigned group's product
    allowed_group, _ = apply_user_scope(user, data.tabmin_group)
    if allowed_group and allowed_group != data.tabmin_group:
        raise HTTPException(status_code=403, detail=f"HRD Kelompok hanya dapat menilai produk {user.get('assigned_group')} yang ditugaskan untuk Anda.")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO tabmin_product_evaluations
            (tabmin_group, evaluator_id, evaluator_name, score_reporter, score_fotografer, score_ilustrator, score_layouter, score_marcomm, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(tabmin_group, evaluator_name) DO UPDATE SET
                score_reporter = excluded.score_reporter,
                score_fotografer = excluded.score_fotografer,
                score_ilustrator = excluded.score_ilustrator,
                score_layouter = excluded.score_layouter,
                score_marcomm = excluded.score_marcomm,
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP
        """, (data.tabmin_group, evaluator_id, evaluator_name,
              data.score_reporter, data.score_fotografer, data.score_ilustrator, data.score_layouter, data.score_marcomm,
              data.notes))

        return {"success": True, "message": f"Penilaian Produk {data.tabmin_group} berhasil disimpan."}

@router.get("/tabmin-product")
def get_tabmin_product_evals(user: dict = Depends(get_current_user)):
    role = user.get("role")
    if role not in ["teknisi", "supervisor", "kepala_sekolah", "wakil_kepala", "hrd_kepala", "hrd_kelompok", "hrd_kelompok_ketua", "hrd_all"]:
        raise HTTPException(status_code=403, detail="Akses ditolak untuk produk Tabmin.")
    group, _ = apply_user_scope(user)
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM tabmin_product_evaluations
            WHERE (? IS NULL OR tabmin_group = ?)
            ORDER BY tabmin_group
        """, (group, group))
        rows = cursor.fetchall()
        # Compute product average
        for r in rows:
            tot = (r["score_reporter"] + r["score_fotografer"] + r["score_ilustrator"] + r["score_layouter"] + r["score_marcomm"]) / 5.0
            r["score_total"] = round(tot, 2)
        return {"products": rows}

# --- 3. Kelas Profesi General Evaluation (HRD Profesi) ---
@router.post("/profesi-general")
def save_profesi_general_eval(
    data: ProfesiGeneralEvalInput,
    user: dict = Depends(require_roles(["hrd_profesi", "hrd_kepala", "hrd_all", "teknisi"]))
):
    role = user.get("role")
    evaluator_name = user.get("full_name") or user.get("username")
    evaluator_id = user.get("id") if isinstance(user.get("id"), int) else None

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, profession, tabmin_group FROM participants WHERE id = ?", (data.participant_id,))
        p = cursor.fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="Peserta tidak ditemukan.")

        ensure_participant_scope(user, p)
        cursor.execute("""
            SELECT is_absen FROM profesi_attendance
            WHERE participant_id = ? AND keprof_session = ?
        """, (data.participant_id, data.keprof_session))
        attendance = cursor.fetchone()
        if not attendance:
            raise HTTPException(status_code=400, detail="Atur kehadiran peserta sebelum mengisi penilaian umum.")
        if attendance["is_absen"]:
            raise HTTPException(status_code=400, detail="Peserta tidak hadir; penilaian umum tidak tersedia untuk peserta absen.")

        cursor.execute("""
            INSERT INTO profesi_general_evaluations
            (participant_id, keprof_session, evaluator_id, evaluator_name, score_kehadiran, score_partisipasi, score_sikap, is_absen, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(participant_id, keprof_session) DO UPDATE SET
                score_kehadiran = excluded.score_kehadiran,
                score_partisipasi = excluded.score_partisipasi,
                score_sikap = excluded.score_sikap,
                notes = excluded.notes,
                evaluator_name = excluded.evaluator_name,
                updated_at = CURRENT_TIMESTAMP
        """, (data.participant_id, data.keprof_session, evaluator_id, evaluator_name,
              data.score_kehadiran, data.score_partisipasi, data.score_sikap, data.notes))

        return {"success": True, "message": f"Penilaian Umum Keprof {data.keprof_session} untuk {p['name']} berhasil disimpan."}

@router.get("/profesi-general/{participant_id}")
def get_profesi_general_for_participant(
    participant_id: int,
    user: dict = Depends(get_current_user)
):
    role = user.get("role")
    if role not in ["teknisi", "supervisor", "kepala_sekolah", "wakil_kepala", "hrd_kepala", "hrd_profesi", "hrd_kelompok", "hrd_kelompok_ketua", "hrd_all"]:
        raise HTTPException(status_code=403, detail="Akses ditolak.")
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            WITH target AS (
                SELECT id, profession, tabmin_group
                FROM participants
                WHERE id = ?
            )
            SELECT
                id AS participant_id, profession, tabmin_group, 'participant' AS record_type,
                NULL AS id, NULL AS keprof_session, NULL AS score_kehadiran,
                NULL AS score_partisipasi, NULL AS score_sikap, NULL AS notes,
                NULL AS evaluator_id, NULL AS evaluator_name, NULL AS is_replacement,
                NULL AS score_teknis, NULL AS score_isi, NULL AS hrd_evaluator_name,
                NULL AS wali_evaluator_name, NULL AS task_notes, NULL AS is_absen,
                NULL AS updated_at
            FROM target
            UNION ALL
            SELECT
                e.participant_id, target.profession, target.tabmin_group, 'evaluation',
                e.id, e.keprof_session, e.score_kehadiran, e.score_partisipasi,
                e.score_sikap, e.notes, e.evaluator_id, e.evaluator_name,
                NULL, NULL, NULL, NULL, NULL, NULL, e.is_absen, e.updated_at
            FROM profesi_general_evaluations e
            JOIN target ON target.id = e.participant_id
            UNION ALL
            SELECT
                t.participant_id, target.profession, target.tabmin_group, 'task',
                t.id, t.keprof_session, NULL, NULL, NULL, NULL, NULL, NULL,
                t.is_replacement, t.score_teknis, t.score_isi, t.hrd_evaluator_name,
                t.wali_evaluator_name, t.task_notes, NULL, t.updated_at
            FROM profesi_task_evaluations t
            JOIN target ON target.id = t.participant_id
            UNION ALL
            SELECT
                a.participant_id, target.profession, target.tabmin_group, 'attendance',
                a.id, a.keprof_session, NULL, NULL, NULL, NULL, a.evaluator_id,
                a.evaluator_name, NULL, NULL, NULL, NULL, NULL, NULL,
                a.is_absen, a.updated_at
            FROM profesi_attendance a
            JOIN target ON target.id = a.participant_id
        """, (participant_id,))
        rows = cursor.fetchall()
        participant_row = next(
            (row for row in rows if row["record_type"] == "participant"),
            None
        )
        participant = (
            {
                "id": participant_row["participant_id"],
                "profession": participant_row["profession"],
                "tabmin_group": participant_row["tabmin_group"],
            }
            if participant_row else None
        )
        if not participant:
            raise HTTPException(status_code=404, detail="Peserta tidak ditemukan.")
        ensure_participant_scope(user, participant)

        evaluations = [row for row in rows if row["record_type"] == "evaluation"]
        task_rows = [row for row in rows if row["record_type"] == "task"]
        attendance_rows = [
            {
                "keprof_session": row["keprof_session"],
                "is_absen": row["is_absen"],
                "evaluator_name": row["evaluator_name"],
                "updated_at": row["updated_at"],
            }
            for row in rows if row["record_type"] == "attendance"
        ]
        absent_sessions = {row["keprof_session"] for row in attendance_rows if row["is_absen"]}
        evaluations = [
            row for row in evaluations
            if row["keprof_session"] not in absent_sessions
        ]
        return {
            "evaluations": evaluations,
            "tasks": task_rows,
            "attendance": attendance_rows,
        }

# --- 4. Kelas Profesi Task Evaluation (HRD Profesi & Wali Kelas) ---
@router.post("/profesi-task")
def save_profesi_task_eval(
    data: ProfesiTaskEvalInput,
    user: dict = Depends(get_current_user)
):
    role = user.get("role")
    evaluator_name = user.get("full_name") or user.get("username")
    
    # Check role
    is_hrd = role in ["hrd_profesi", "hrd_kepala", "hrd_all", "teknisi"]
    is_wali = role in ["wali_kelas", "hrd_kepala", "teknisi"]
    
    if not is_hrd and not is_wali:
        raise HTTPException(status_code=403, detail="Role tidak diizinkan menginput penilaian tugas.")
        
    if is_wali and not is_hrd and data.score_teknis is not None:
        raise HTTPException(status_code=403, detail="Wali Kelas hanya berhak mengisi Penilaian Isi.")
        
    if is_hrd and not is_wali and data.score_isi is not None:
        raise HTTPException(status_code=403, detail="HRD Profesi hanya berhak mengisi Kepatuhan Teknis.")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, profession, tabmin_group FROM participants WHERE id = ?", (data.participant_id,))
        p = cursor.fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="Peserta tidak ditemukan.")
        ensure_participant_scope(user, p)

        # Wali Kelas check profession
        if role == "wali_kelas" and user.get("assigned_profession") and user.get("assigned_profession") != "ALL":
            if user.get("assigned_profession") != p["profession"]:
                raise HTTPException(status_code=403, detail=f"Anda hanya berhak menilai peserta profesi {user.get('assigned_profession')}.")

        cursor.execute("""
            SELECT is_absen FROM profesi_attendance
            WHERE participant_id = ? AND keprof_session = ?
        """, (data.participant_id, data.keprof_session))
        attendance = cursor.fetchone()
        if not attendance:
            raise HTTPException(status_code=400, detail="Atur kehadiran peserta sebelum menilai tugas.")
        if data.is_replacement and not attendance["is_absen"]:
            raise HTTPException(
                status_code=400,
                detail=f"Peserta '{p['name']}' tercatat hadir di Kelas Profesi {data.keprof_session}. Form penilaian tugas pengganti tidak tersedia karena peserta mengerjakan tugas reguler."
            )

        # Check existing row
        cursor.execute("""
            SELECT * FROM profesi_task_evaluations
            WHERE participant_id = ? AND keprof_session = ? AND is_replacement = ?
        """, (data.participant_id, data.keprof_session, data.is_replacement))
        existing = cursor.fetchone()

        if existing:
            # Update specific column
            if is_hrd and data.score_teknis is not None:
                cursor.execute("""
                    UPDATE profesi_task_evaluations
                    SET score_teknis = ?, hrd_evaluator_name = ?, task_notes = COALESCE(?, task_notes), updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (data.score_teknis, evaluator_name, data.task_notes, existing["id"]))
            if is_wali and data.score_isi is not None:
                cursor.execute("""
                    UPDATE profesi_task_evaluations
                    SET score_isi = ?, wali_evaluator_name = ?, task_notes = COALESCE(?, task_notes), updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (data.score_isi, evaluator_name, data.task_notes, existing["id"]))
        else:
            # Insert new row
            cursor.execute("""
                INSERT INTO profesi_task_evaluations
                (participant_id, keprof_session, is_replacement, score_teknis, hrd_evaluator_name, score_isi, wali_evaluator_name, task_notes, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                data.participant_id, data.keprof_session, data.is_replacement,
                data.score_teknis if is_hrd else None,
                evaluator_name if (is_hrd and data.score_teknis is not None) else None,
                data.score_isi if is_wali else None,
                evaluator_name if (is_wali and data.score_isi is not None) else None,
                data.task_notes
            ))

        task_type_str = "Tugas Pengganti" if data.is_replacement else "Tugas Utama"
        return {"success": True, "message": f"Penilaian {task_type_str} Keprof {data.keprof_session} untuk {p['name']} berhasil disimpan."}

@router.post("/profesi-attendance")
def set_profesi_attendance(
    data: ProfesiAttendanceInput,
    user: dict = Depends(get_current_user)
):
    """Sets attendance (Datang vs Tidak Datang) for Keprof 1, 2, or 3. Only HRD Profesi, Kepala HRD, and Teknisi."""
    role = user.get("role")
    if role not in ["hrd_profesi", "hrd_kepala", "hrd_all", "teknisi"]:
        raise HTTPException(status_code=403, detail="Hanya HRD Profesi, Kepala HRD, dan Teknisi yang dapat mengatur kehadiran Kelas Profesi.")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, profession, tabmin_group FROM participants WHERE id = ?", (data.participant_id,))
        p = cursor.fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="Peserta tidak ditemukan.")

        ensure_participant_scope(user, p)

        evaluator_name = user.get("full_name") or user.get("username")
        evaluator_id = user.get("id") if isinstance(user.get("id"), int) else None

        cursor.execute("""
            INSERT INTO profesi_attendance
                (participant_id, keprof_session, is_absen, evaluator_id, evaluator_name, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(participant_id, keprof_session) DO UPDATE SET
                is_absen = excluded.is_absen,
                evaluator_id = excluded.evaluator_id,
                evaluator_name = excluded.evaluator_name,
                updated_at = CURRENT_TIMESTAMP
        """, (data.participant_id, data.keprof_session, data.is_absen, evaluator_id, evaluator_name))

        if data.is_absen:
            cursor.execute("""
                DELETE FROM profesi_general_evaluations
                WHERE participant_id = ? AND keprof_session = ?
            """, (data.participant_id, data.keprof_session))

        if data.keprof_session == 3:
            status_str = "Hadir / Datang (Mendapatkan Penilaian Umum)" if data.is_absen == 0 else "Tidak Hadir / Absen (Tidak Mendapatkan Nilai)"
        else:
            status_str = "Hadir / Datang (Mengerjakan Tugas Utama dan Penilaian Umum)" if data.is_absen == 0 else "Tidak Hadir / Absen (Mengerjakan Tugas Pengganti dan Tugas Utama, tanpa Penilaian Umum)"

        return {
            "success": True,
            "participant_id": data.participant_id,
            "keprof_session": data.keprof_session,
            "is_absen": data.is_absen,
            "message": f"Kehadiran {p['name']} Keprof {data.keprof_session}: {status_str}"
        }

@router.get("/profesi-task/my-view")
def get_wali_profesi_tasks(
    session: Optional[int] = 1,
    is_replacement: Optional[int] = 0,
    user: dict = Depends(get_current_user)
):
    """Specific endpoint for Wali Kelas to view their input list for Keprof 1 or 2."""
    role = user.get("role")
    if role not in ["wali_kelas", "hrd_profesi", "hrd_kepala", "hrd_all", "teknisi"]:
        raise HTTPException(status_code=403, detail="Akses ditolak.")

    group_filter, prof_filter = apply_user_scope(user)
    if role == "wali_kelas" and user.get("assigned_profession") and user.get("assigned_profession") != "ALL":
        prof_filter = user.get("assigned_profession")

    with get_db() as conn:
        cursor = conn.cursor()
        query = """
            SELECT p.id as participant_id, p.name, p.profession, p.tabmin_group,
                   t.id as task_id, t.score_teknis, t.score_isi, t.hrd_evaluator_name, t.wali_evaluator_name, t.task_notes,
                   COALESCE(g.is_absen, 0) as is_absen,
                   t_reg.score_isi as score_isi_reg,
                   t_reg.task_notes as notes_reg,
                   t_rep.score_isi as score_isi_rep,
                   t_rep.task_notes as notes_rep
            FROM participants p
            LEFT JOIN profesi_attendance g ON p.id = g.participant_id AND g.keprof_session = ?
            LEFT JOIN profesi_task_evaluations t ON p.id = t.participant_id AND t.keprof_session = ? AND t.is_replacement = ?
            LEFT JOIN profesi_task_evaluations t_reg ON p.id = t_reg.participant_id AND t_reg.keprof_session = ? AND t_reg.is_replacement = 0
            LEFT JOIN profesi_task_evaluations t_rep ON p.id = t_rep.participant_id AND t_rep.keprof_session = ? AND t_rep.is_replacement = 1
            WHERE 1=1
        """
        params = [session, session, is_replacement, session, session]
        if role == "hrd_all":
            query += " AND (p.tabmin_group = ? OR p.profession = ?)"
            params.extend([group_filter, prof_filter])
        elif group_filter:
            query += " AND p.tabmin_group = ?"
            params.append(group_filter)
        if role != "hrd_all" and prof_filter:
            query += " AND p.profession = ?"
            params.append(prof_filter)
        query += " ORDER BY p.profession, p.name"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Isolation: Wali Kelas CANNOT see evaluations made by HRD (score_teknis and hrd_evaluator_name)
        if role == "wali_kelas":
            for r in rows:
                r["score_teknis"] = None
                r["hrd_evaluator_name"] = None

        return {"tasks": rows}
