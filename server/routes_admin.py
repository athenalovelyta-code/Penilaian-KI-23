import re
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from server.database import get_db
from server.auth import get_current_user, require_roles
from server.seeder import PANITIA_FILE, seed_panitia_from_excel

router = APIRouter(prefix="/api/admin", tags=["Teknisi Admin Management"])

PJK_MAPPING = {
    "Kelompok 1": "Salsabila Az Zahra",
    "Kelompok 2": "Novita Tireina",
    "Kelompok 3": "Aldi Arkananta",
    "Kelompok 4": "Nadiny",
    "Kelompok 5": "Sarah Nur Rahmah",
    "Kelompok 6": "Ananda Ayu Pertiwi"
}

VALID_PROFESSIONS = ["Ilustrator", "Fotografer", "Layouter", "Marcomm", "Reporter"]
VALID_GROUPS = ["Kelompok 1", "Kelompok 2", "Kelompok 3", "Kelompok 4", "Kelompok 5", "Kelompok 6"]

class ParticipantCreateInput(BaseModel):
    name: str
    profession: str
    tabmin_group: str
    whatsapp_group: Optional[str] = None
    jurusan: Optional[str] = None

class ParticipantUpdateInput(BaseModel):
    name: Optional[str] = None
    profession: Optional[str] = None
    tabmin_group: Optional[str] = None
    whatsapp_group: Optional[str] = None
    jurusan: Optional[str] = None

class MoveGroupInput(BaseModel):
    participant_id: int
    target_group: str

def norm_name(name: str) -> str:
    return re.sub(r'[^a-zA-Z0-9]', '', name.lower())

# --- 1. Get All Participants (Admin) ---
@router.get("/participants")
def admin_get_participants(
    profession: Optional[str] = None,
    group: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(require_roles(["teknisi"]))
):
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT id, name, profession, tabmin_group, pjk_name, whatsapp_group, password, jurusan, created_at FROM participants WHERE 1=1"
        params = []
        if profession and profession != "ALL":
            query += " AND profession = ?"
            params.append(profession)
        if group and group != "ALL":
            query += " AND tabmin_group = ?"
            params.append(group)
        if search:
            query += " AND (name LIKE ? OR jurusan LIKE ? OR profession LIKE ? OR tabmin_group LIKE ?)"
            s = f"%{search}%"
            params.extend([s, s, s, s])

        query += " ORDER BY tabmin_group, profession, name"
        cursor.execute(query, params)
        participants = cursor.fetchall()
        return {"participants": participants, "total": len(participants)}

# --- 2. Add New Participant ---
@router.post("/participants")
def admin_create_participant(
    data: ParticipantCreateInput,
    user: dict = Depends(require_roles(["teknisi"]))
):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama peserta tidak boleh kosong.")

    profession = data.profession.strip()
    if profession not in VALID_PROFESSIONS:
        raise HTTPException(status_code=400, detail=f"Profesi harus salah satu dari: {', '.join(VALID_PROFESSIONS)}")

    tabmin_group = data.tabmin_group.strip()
    if tabmin_group not in VALID_GROUPS:
        raise HTTPException(status_code=400, detail=f"Kelompok Tabmin harus salah satu dari: {', '.join(VALID_GROUPS)}")

    pjk_name = PJK_MAPPING.get(tabmin_group, "")

    with get_db() as conn:
        cursor = conn.cursor()
        # Check duplicate in same group
        cursor.execute("SELECT id FROM participants WHERE LOWER(name) = ? AND tabmin_group = ?", (name.lower(), tabmin_group))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Peserta '{name}' sudah terdaftar di {tabmin_group}.")

        cursor.execute("""
            INSERT INTO participants (name, normalized_name, profession, tabmin_group, pjk_name, whatsapp_group, jurusan)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (name, norm_name(name), profession, tabmin_group, pjk_name, data.whatsapp_group, data.jurusan))
        new_id = cursor.lastrowid

        return {
            "success": True,
            "message": f"Peserta '{name}' berhasil didaftarkan sebagai {profession} di {tabmin_group}.",
            "participant_id": new_id,
            "jurusan": data.jurusan
        }

# --- 3. Update Participant ---
@router.put("/participants/{participant_id}")
def admin_update_participant(
    participant_id: int,
    data: ParticipantUpdateInput,
    user: dict = Depends(require_roles(["teknisi"]))
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM participants WHERE id = ?", (participant_id,))
        p = cursor.fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="Peserta tidak ditemukan.")

        name = data.name.strip() if data.name is not None else p["name"]
        profession = data.profession.strip() if data.profession is not None else p["profession"]
        tabmin_group = data.tabmin_group.strip() if data.tabmin_group is not None else p["tabmin_group"]
        jurusan = data.jurusan.strip() if data.jurusan is not None else p["jurusan"]
        whatsapp_group = data.whatsapp_group if data.whatsapp_group is not None else p["whatsapp_group"]

        if profession not in VALID_PROFESSIONS:
            raise HTTPException(status_code=400, detail=f"Profesi tidak valid.")
        if tabmin_group not in VALID_GROUPS:
            raise HTTPException(status_code=400, detail=f"Kelompok Tabmin tidak valid.")

        pjk_name = PJK_MAPPING.get(tabmin_group, p["pjk_name"])

        cursor.execute("""
            UPDATE participants
            SET name = ?, normalized_name = ?, profession = ?, tabmin_group = ?, pjk_name = ?, jurusan = ?, whatsapp_group = ?
            WHERE id = ?
        """, (name, norm_name(name), profession, tabmin_group, pjk_name, jurusan, whatsapp_group, participant_id))

        return {
            "success": True,
            "message": f"Data peserta '{name}' berhasil diperbarui.",
            "updated": {
                "id": participant_id,
                "name": name,
                "profession": profession,
                "tabmin_group": tabmin_group,
                "jurusan": jurusan
            }
        }

# --- 4. Delete Participant ---
@router.delete("/participants/{participant_id}")
def admin_delete_participant(
    participant_id: int,
    user: dict = Depends(require_roles(["teknisi"]))
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM participants WHERE id = ?", (participant_id,))
        p = cursor.fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="Peserta tidak ditemukan.")

        cursor.execute("DELETE FROM participants WHERE id = ?", (participant_id,))
        return {"success": True, "message": f"Peserta '{p['name']}' berhasil dihapus dari sistem."}

# --- 5. Quick Move Group ---
@router.post("/move-tabmin-group")
def admin_move_group(
    data: MoveGroupInput,
    user: dict = Depends(require_roles(["teknisi"]))
):
    if data.target_group not in VALID_GROUPS:
        raise HTTPException(status_code=400, detail="Kelompok tujuan tidak valid.")

    pjk = PJK_MAPPING.get(data.target_group, "")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name, tabmin_group FROM participants WHERE id = ?", (data.participant_id,))
        p = cursor.fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="Peserta tidak ditemukan.")

        old_group = p["tabmin_group"]
        cursor.execute("""
            UPDATE participants
            SET tabmin_group = ?, pjk_name = ?
            WHERE id = ?
        """, (data.target_group, pjk, data.participant_id))

        return {
            "success": True,
            "message": f"Peserta '{p['name']}' berhasil dipindahkan dari {old_group} ke {data.target_group} (PJK: {pjk})."
        }

# --- 7. Tabmin Overview per Group ---
@router.get("/tabmin-overview")
def admin_tabmin_overview(user: dict = Depends(require_roles(["teknisi"]))):
    with get_db() as conn:
        cursor = conn.cursor()
        result = []
        for grp in VALID_GROUPS:
            pjk = PJK_MAPPING.get(grp, "")
            cursor.execute("""
                SELECT id, name, profession, jurusan
                FROM participants
                WHERE tabmin_group = ?
                ORDER BY profession, name
            """, (grp,))
            members = cursor.fetchall()
            result.append({
                "group_name": grp,
                "pjk_name": pjk,
                "total_members": len(members),
                "members": members
            })
        return {"groups": result}

# --- 8. Staff Management (HRD, Wali Kelas, PJK, Kepala Sekolah, Wakil Kepala Sekolah, Teknisi) ---
class StaffCreateInput(BaseModel):
    full_name: str
    role: str
    username: Optional[str] = None
    password: Optional[str] = "password123"
    assigned_group: Optional[str] = None
    assigned_profession: Optional[str] = None

class StaffUpdateInput(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    assigned_group: Optional[str] = None
    assigned_profession: Optional[str] = None

from server.auth import hash_pw

VALID_STAFF_ROLES = [
    "teknisi", "kepala_sekolah", "wakil_kepala", "supervisor",
    "hrd_kepala", "hrd_kelompok_ketua", "hrd_profesi", "hrd_kelompok", "hrd_all",
    "wali_kelas", "pjk"
]

@router.get("/staff")
def admin_get_staff(user: dict = Depends(require_roles(["teknisi"]))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, full_name, role, assigned_group, assigned_profession, created_at
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
                END, id
        """)
        staff = cursor.fetchall()
        return {"staff": staff, "total": len(staff)}

@router.post("/staff")
def admin_create_staff(
    data: StaffCreateInput,
    user: dict = Depends(require_roles(["teknisi"]))
):
    full_name = data.full_name.strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Nama lengkap wajib diisi.")

    # Auto generate username if empty
    if data.username and data.username.strip():
        username = data.username.strip().lower()
    else:
        clean_user = re.sub(r'[^a-zA-Z0-9]', '', full_name.lower())
        username = clean_user[:20] if clean_user else "user"

    password = data.password.strip() if data.password else "password123"

    if data.role not in VALID_STAFF_ROLES:
        raise HTTPException(status_code=400, detail=f"Role tidak valid. Pilihan: {', '.join(VALID_STAFF_ROLES)}")

    with get_db() as conn:
        cursor = conn.cursor()
        
        # Ensure unique username
        base_username = username
        counter = 1
        while True:
            cursor.execute("SELECT id FROM users WHERE LOWER(username) = ?", (username,))
            if not cursor.fetchone():
                break
            username = f"{base_username}_{counter}"
            counter += 1

        cursor.execute("""
            INSERT INTO users (username, password_hash, full_name, role, assigned_group, assigned_profession)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (username, hash_pw(password), full_name, data.role, data.assigned_group, data.assigned_profession))
        new_id = cursor.lastrowid

        # If PJK, sync to participants table and mapping
        if data.role == "pjk" and data.assigned_group:
            PJK_MAPPING[data.assigned_group] = full_name
            cursor.execute("UPDATE participants SET pjk_name = ? WHERE tabmin_group = ?", (full_name, data.assigned_group))

        return {
            "success": True,
            "message": f"Panitia/Staf '{full_name}' ({data.role}) berhasil didaftarkan.",
            "staff_id": new_id,
            "username": username
        }

@router.put("/staff/{staff_id}")
def admin_update_staff(
    staff_id: int,
    data: StaffUpdateInput,
    user: dict = Depends(require_roles(["teknisi"]))
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (staff_id,))
        staff = cursor.fetchone()
        if not staff:
            raise HTTPException(status_code=404, detail="Akun staf tidak ditemukan.")

        username = data.username.strip().lower() if data.username else staff["username"]
        full_name = data.full_name.strip() if data.full_name else staff["full_name"]
        role = data.role.strip() if data.role else staff["role"]
        assigned_group = data.assigned_group if data.assigned_group is not None else staff["assigned_group"]
        assigned_profession = data.assigned_profession if data.assigned_profession is not None else staff["assigned_profession"]

        if role not in VALID_STAFF_ROLES:
            raise HTTPException(status_code=400, detail=f"Role '{role}' tidak valid.")

        # Check unique username
        if username != staff["username"]:
            cursor.execute("SELECT id FROM users WHERE LOWER(username) = ? AND id != ?", (username, staff_id))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail=f"Username '{username}' sudah digunakan.")

        if data.password and data.password.strip():
            pw_hash = hash_pw(data.password.strip())
            cursor.execute("""
                UPDATE users
                SET username = ?, full_name = ?, role = ?, assigned_group = ?, assigned_profession = ?, password_hash = ?
                WHERE id = ?
            """, (username, full_name, role, assigned_group, assigned_profession, pw_hash, staff_id))
        else:
            cursor.execute("""
                UPDATE users
                SET username = ?, full_name = ?, role = ?, assigned_group = ?, assigned_profession = ?
                WHERE id = ?
            """, (username, full_name, role, assigned_group, assigned_profession, staff_id))

        # If PJK, sync group
        if role == "pjk" and assigned_group:
            PJK_MAPPING[assigned_group] = full_name
            cursor.execute("UPDATE participants SET pjk_name = ? WHERE tabmin_group = ?", (full_name, assigned_group))

        return {
            "success": True,
            "message": f"Data staf/panitia '{full_name}' berhasil diperbarui."
        }

@router.delete("/staff/{staff_id}")
def admin_delete_staff(
    staff_id: int,
    user: dict = Depends(require_roles(["teknisi"]))
):
    if user.get("id") == staff_id:
        raise HTTPException(status_code=400, detail="Anda tidak dapat menghapus akun Anda sendiri saat sedang login.")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT username, role, full_name FROM users WHERE id = ?", (staff_id,))
        staff = cursor.fetchone()
        if not staff:
            raise HTTPException(status_code=404, detail="Akun staf tidak ditemukan.")

        if staff["role"] == "teknisi":
            cursor.execute("SELECT COUNT(*) as cnt FROM users WHERE role = 'teknisi'")
            if cursor.fetchone()["cnt"] <= 1:
                raise HTTPException(status_code=400, detail="Tidak dapat menghapus teknisi terakhir dalam sistem.")

        cursor.execute("DELETE FROM users WHERE id = ?", (staff_id,))
        return {"success": True, "message": f"Akun staf '{staff['full_name']}' ({staff['username']}) berhasil dihapus."}

# --- 9. Re-sync from Pakai Daftar Ini Ya.xlsx ---
@router.post("/sync-panitia")
def admin_sync_panitia(user: dict = Depends(require_roles(["teknisi"]))):
    import os
    if not os.path.exists(PANITIA_FILE):
        raise HTTPException(status_code=404, detail="Berkas 'Pakai Daftar Ini Ya.xlsx' tidak ditemukan.")

    with get_db() as conn:
        synced_count = seed_panitia_from_excel(conn)

        return {
            "success": True,
            "message": f"Berhasil menyinkronkan {synced_count} panitia dari berkas '{os.path.basename(PANITIA_FILE)}'."
        }
