import os
import re
import openpyxl
import hashlib
from server.database import get_db, init_db

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TABMIN_FILE = os.path.join(BASE_DIR, "KELOMPOK TABMIN KI23 .xlsx")
PROFESI_FILE = os.path.join(BASE_DIR, "PENGUMUMAN TAHAP 1 KI23.xlsx")
PANITIA_FILE = os.path.join(BASE_DIR, "Pakai Daftar Ini Ya.xlsx")
if not os.path.exists(PANITIA_FILE):
    PANITIA_FILE = os.path.join(BASE_DIR, "Daftar Panitia.xlsx")
JURUSAN_FILE = os.path.join(BASE_DIR, "Jurusan pendaftar KI.xlsx")

def hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def norm_str(s: str) -> str:
    return re.sub(r'[^a-zA-Z0-9]', '', str(s).lower())

def seed_database(seed_sample_scores=True):
    init_db()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Check if participants already seeded
        cursor.execute("SELECT COUNT(*) as cnt FROM participants")
        row = cursor.fetchone()
        if row and row['cnt'] > 0:
            print(f"Participants already seeded ({row['cnt']} records). Checking passwords and jurusan...")
            sync_participant_passwords(conn)
            sync_participant_jurusan(conn)
        else:
            print("Parsing Excel files to seed participants...")
            parse_and_insert_excel(conn)
            sync_participant_jurusan(conn)
            
        # Seed panitia from Pakai Daftar Ini Ya.xlsx
        seed_panitia_from_excel(conn)
            
        # Seed sample scores for demonstration if table is empty
        if seed_sample_scores:
            cursor.execute("SELECT COUNT(*) as cnt FROM tabmin_member_evaluations")
            cnt_tab = cursor.fetchone()['cnt']
            if cnt_tab == 0:
                print("Seeding realistic sample evaluations for demonstration...")
                seed_sample_evaluations(conn)
                
    print("Database seeding completed.")


def sync_participant_passwords(conn):
    if not os.path.exists(PROFESI_FILE):
        return
    cursor = conn.cursor()
    wb_prof = openpyxl.load_workbook(PROFESI_FILE, data_only=True)['Sheet1']
    prof_by_norm = {}
    for c in range(1, 10, 2):
        pname = str(wb_prof.cell(2, c).value or 'Umum').strip()
        for r in range(4, wb_prof.max_row + 1):
            val = wb_prof.cell(r, c).value
            pwd_val = wb_prof.cell(r, c + 1).value
            if val and str(val).strip():
                clean_name = str(val).strip()
                clean_pwd = str(pwd_val or '').strip()
                prof_by_norm[norm_str(clean_name)] = (clean_name, pname, clean_pwd)

    aliases = {
        norm_str('Fahrizal Aziz'): norm_str('Fahrizal Azis'),
        norm_str('Nayla Azzahra Haya'): norm_str('Nayla Azzahra Haya Maulana'),
    }

    cursor.execute("SELECT id, name, normalized_name FROM participants")
    parts = cursor.fetchall()
    updated = 0
    for p in parts:
        nm = p['normalized_name']
        if nm in aliases:
            nm = aliases[nm]
        if nm in prof_by_norm:
            cname, prof, pwd = prof_by_norm[nm]
            if pwd:
                cursor.execute("""
                    UPDATE participants 
                    SET password = ?, password_hash = ?
                    WHERE id = ?
                """, (pwd, hash_pw(pwd), p['id']))
                updated += 1
    print(f"Synced passwords for {updated} participants from {os.path.basename(PROFESI_FILE)}.")


def sync_participant_jurusan(conn):
    """Syncs the 'jurusan' column from Jurusan pendaftar KI.xlsx if available."""
    if not os.path.exists(JURUSAN_FILE):
        print(f"[SKIP] Jurusan file not found: {JURUSAN_FILE}")
        return
    try:
        cursor = conn.cursor()
        wb = openpyxl.load_workbook(JURUSAN_FILE, data_only=True)
        sheet = wb.active
        jurusan_map = {}  # normalized_name -> jurusan
        for r in range(2, sheet.max_row + 1):
            name_val = sheet.cell(r, 1).value
            jurusan_val = sheet.cell(r, 3).value
            if name_val and str(name_val).strip():
                key = norm_str(str(name_val).strip())
                jurusan_map[key] = str(jurusan_val or '').strip()

        name_aliases = {
            norm_str("Ahmad Alfatir Ghienaya"): norm_str("Ahmad Alfathir Ghienaya"),
            norm_str("Kayyisah Sasikirana Ayu"): norm_str("Kayyisah Sasikirana Witjaksono"),
            norm_str("Muhammad Raffi Kainil"): norm_str("Muhammad Raffi Kainillah"),
            norm_str("Nailah Aieloa Nabihah"): norm_str("Nailah Aieola Nabihah"),
            norm_str("Naufal Shiqid Al Fachri"): norm_str("Naufal Shidiq Al Fachri"),
            norm_str("Nursia Azzahra"): norm_str("Nurisa Azzahra"),
        }
        cursor.execute("SELECT id, normalized_name FROM participants")
        parts = cursor.fetchall()
        updated = 0
        for p in parts:
            nm = name_aliases.get(p['normalized_name'], p['normalized_name'])
            if nm in jurusan_map and jurusan_map[nm]:
                cursor.execute("UPDATE participants SET jurusan = ? WHERE id = ?", (jurusan_map[nm], p['id']))
                updated += 1
        print(f"Synced jurusan for {updated} participants from {os.path.basename(JURUSAN_FILE)}.")
    except Exception as e:
        print(f"[WARN] Could not sync jurusan: {e}")


def parse_and_insert_excel(conn):
    cursor = conn.cursor()
    
    # 1. Parse Tabmin
    wb_tab = openpyxl.load_workbook(TABMIN_FILE, data_only=True)['Sheet1']
    groups_data = {}
    pjk_map = {}
    wa_group_map = {}

    for c in range(1, 7):
        gname = str(wb_tab.cell(2, c).value or f'Kelompok {c}').strip()
        pjk_val = wb_tab.cell(22, c).value
        pjk_name = str(pjk_val).replace('PJK:', '').strip() if pjk_val else f'PJK Kelompok {c}'
        pjk_map[gname] = pjk_name
        wa_group_map[gname] = str(wb_tab.cell(23, c).value or '').strip()
        
        members = []
        for r in range(3, 22):
            val = wb_tab.cell(r, c).value
            if val and str(val).strip():
                raw_name = str(val).strip()
                # Split dual name if present in Kelompok 6
                if 'Ramya Syazwina Husna Zakiya' in raw_name:
                    members.append('Ramya Syazwina')
                    members.append('Husna Zakiya')
                else:
                    members.append(raw_name)
        groups_data[gname] = members

    # 2. Parse Profesi & Passwords
    wb_prof = openpyxl.load_workbook(PROFESI_FILE, data_only=True)['Sheet1']
    prof_by_norm = {}

    for c in range(1, 10, 2):
        pname = str(wb_prof.cell(2, c).value or 'Umum').strip()
        for r in range(4, wb_prof.max_row + 1):
            val = wb_prof.cell(r, c).value
            pwd_val = wb_prof.cell(r, c + 1).value
            if val and str(val).strip():
                clean_name = str(val).strip()
                clean_pwd = str(pwd_val or '').strip()
                prof_by_norm[norm_str(clean_name)] = (clean_name, pname, clean_pwd)

    # Aliases
    aliases = {
        norm_str('Fahrizal Aziz'): norm_str('Fahrizal Azis'),
        norm_str('Nayla Azzahra Haya'): norm_str('Nayla Azzahra Haya Maulana'),
    }

    inserted_count = 0
    seen_keys = set()

    for gname, mems in groups_data.items():
        for m in mems:
            nm = norm_str(m)
            if nm in aliases:
                nm = aliases[nm]
            
            canonical_name = m
            prof = 'Umum'
            pwd = ''
            if nm in prof_by_norm:
                canonical_name, prof, pwd = prof_by_norm[nm]
                
            key = (norm_str(canonical_name), gname)
            if key in seen_keys:
                continue
            seen_keys.add(key)
            
            pjk = pjk_map.get(gname, '')
            wa_link = wa_group_map.get(gname, '')
            cursor.execute("""
                INSERT OR IGNORE INTO participants (name, normalized_name, profession, tabmin_group, pjk_name, whatsapp_group, password, password_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (canonical_name, norm_str(canonical_name), prof, gname, pjk, wa_link, pwd, hash_pw(pwd) if pwd else None))
            inserted_count += 1

    print(f"Inserted {inserted_count} participants into database.")

def seed_panitia_from_excel(conn) -> int:
    if not os.path.exists(PANITIA_FILE):
        print(f"{os.path.basename(PANITIA_FILE)} not found, falling back to default seed_users.")
        seed_users(conn)
        return 0

    cursor = conn.cursor()
    wb = openpyxl.load_workbook(PANITIA_FILE, data_only=True)
    sheet = wb.active
    pjk_real_names = {}
    synced = 0

    for r in range(2, sheet.max_row + 1):
        name = str(sheet.cell(r, 1).value or "").strip()
        pos = str(sheet.cell(r, 2).value or "").strip()
        pw = str(sheet.cell(r, 3).value or "password123").strip()
        if not name or not pos:
            continue

        role = "hrd_kelompok"
        assigned_group = None
        assigned_prof = None
        pos_lower = pos.lower()

        if "teknisi" in pos_lower:
            role = "teknisi"
        elif "kepala sekolah" in pos_lower:
            role = "kepala_sekolah"
        elif "wakil" in pos_lower:
            role = "wakil_kepala"
        elif "kepala hrd" in pos_lower:
            role = "hrd_kepala"
        elif "profesi" in pos_lower and "kelompok" in pos_lower and "ketua" not in pos_lower:
            role = "hrd_all"
        elif "hrd profesi" in pos_lower:
            role = "hrd_profesi"
        elif "ketua" in pos_lower and "kelompok" in pos_lower:
            role = "hrd_kelompok_ketua"
        elif "hrd kelompok" in pos_lower or pos_lower == "hrd":
            role = "hrd_kelompok"
        elif "wali kelas" in pos_lower:
            role = "wali_kelas"
        elif "pjk" in pos_lower:
            role = "pjk"

        # Extract assigned group if present
        m = re.search(r'kelompok\s*(\d)', pos_lower)
        if m:
            assigned_group = f"Kelompok {m.group(1)}"
            if role == "pjk":
                pjk_real_names[assigned_group] = name

        # Extract assigned profession if present
        if "reporter" in pos_lower:
            assigned_prof = "Reporter"
        elif "marcom" in pos_lower:
            assigned_prof = "Marcomm"
        elif "illustrator" in pos_lower or "ilustrator" in pos_lower:
            assigned_prof = "Ilustrator"
        elif "fotografer" in pos_lower:
            assigned_prof = "Fotografer"
        elif "layouter" in pos_lower:
            assigned_prof = "Layouter"
        elif role == "wali_kelas":
            assigned_prof = "ALL"

        clean_user = re.sub(r'[^a-zA-Z0-9]', '', name.lower())[:20]

        cursor.execute("SELECT id FROM users WHERE LOWER(full_name) = ?", (name.lower(),))
        existing = cursor.fetchone()
        if existing:
            existing_id = existing["id"] if hasattr(existing, "keys") else existing[0]
            cursor.execute("""
                UPDATE users 
                SET role = ?, assigned_group = ?, assigned_profession = ?, password = ?, password_hash = ? 
                WHERE id = ?
            """, (role, assigned_group, assigned_prof, pw, hash_pw(pw), existing_id))
        else:
            uname = clean_user
            c = 1
            while True:
                cursor.execute("SELECT id FROM users WHERE LOWER(username) = ?", (uname,))
                if not cursor.fetchone():
                    break
                uname = f"{clean_user}_{c}"
                c += 1
            cursor.execute("""
                INSERT INTO users (username, password, password_hash, full_name, role, assigned_group, assigned_profession)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (uname, pw, hash_pw(pw), name, role, assigned_group, assigned_prof))
        synced += 1

    # Update PJK names in participants table
    for grp, pjk_name in pjk_real_names.items():
        cursor.execute("UPDATE participants SET pjk_name = ? WHERE tabmin_group = ?", (pjk_name, grp))

    print(f"Seeded/synced {synced} panitia from {os.path.basename(PANITIA_FILE)} into database.")
    return synced

def seed_users(conn):
    cursor = conn.cursor()
    users_data = [
        # Teknisi (Super Admin)
        ("teknisi", "password123", "Teknisi Sistem KI23 (Admin)", "teknisi", None, None),
        
        # Supervisor
        ("kepala_sekolah", "password123", "Kepala Sekolah (Supervisor)", "supervisor", None, None),

        ("wakil_kepala", "password123", "Wakil Kepala Sekolah", "supervisor", None, None),
        
        # HRD
        ("hrd_kepala", "password123", "Kepala HRD KI23", "hrd_kepala", None, None),
        ("hrd_profesi", "password123", "HRD Profesi (Teknis & Umum)", "hrd_profesi", None, None),
        ("hrd_kelompok", "password123", "HRD Kelompok (Tabmin)", "hrd_kelompok", None, None),
        ("hrd_gabungan", "password123", "HRD Profesi & Kelompok", "hrd_all", None, None),
        
        # Wali Kelas (General and Specific per profession)
        ("wali_kelas", "password123", "Wali Kelas KI23 (Semua Profesi)", "wali_kelas", None, "ALL"),
        ("wali_reporter", "password123", "Wali Kelas Reporter", "wali_kelas", None, "Reporter"),
        ("wali_fotografer", "password123", "Wali Kelas Fotografer", "wali_kelas", None, "Fotografer"),
        ("wali_ilustrator", "password123", "Wali Kelas Ilustrator", "wali_kelas", None, "Ilustrator"),
        ("wali_layouter", "password123", "Wali Kelas Layouter", "wali_kelas", None, "Layouter"),
        ("wali_marcomm", "password123", "Wali Kelas Marcomm", "wali_kelas", None, "Marcomm"),
        
        # PJK (Kelompok 1 - 6)
        ("pjk_aya", "password123", "PJK Aya (Kelompok 1)", "pjk", "Kelompok 1", None),
        ("pjk_novita", "password123", "PJK Novita (Kelompok 2)", "pjk", "Kelompok 2", None),
        ("pjk_aldi", "password123", "PJK Aldi (Kelompok 3)", "pjk", "Kelompok 3", None),
        ("pjk_nadin", "password123", "PJK Nadin (Kelompok 4)", "pjk", "Kelompok 4", None),
        ("pjk_sarah", "password123", "PJK Sarah (Kelompok 5)", "pjk", "Kelompok 5", None),
        ("pjk_ayu", "password123", "PJK Ayu (Kelompok 6)", "pjk", "Kelompok 6", None),
    ]

    for username, pw, full_name, role, group, prof in users_data:
        cursor.execute("""
            INSERT OR IGNORE INTO users (username, password_hash, full_name, role, assigned_group, assigned_profession)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (username, hash_pw(pw), full_name, role, group, prof))

    print(f"Inserted {len(users_data)} system user accounts.")

def seed_sample_evaluations(conn):
    """Seed sample realistic evaluations so the recap dashboard displays meaningful graphs and tables immediately."""
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, tabmin_group, profession, pjk_name FROM participants")
    participants = cursor.fetchall()
    
    # 1. Seed Tabmin Member Evaluations for first 25 participants + some from each group
    sample_targets = participants[:35]
    for p in sample_targets:
        pid = p['id']
        grp = p['tabmin_group']
        pjk = p['pjk_name'] or 'PJK'
        
        # HRD score
        cursor.execute("""
            INSERT OR IGNORE INTO tabmin_member_evaluations
            (participant_id, evaluator_role, evaluator_name, tabmin_group, score_kehadiran, score_partisipasi, score_sikap, notes)
            VALUES (?, 'hrd', 'HRD Kelompok', ?, 5, 4, 5, 'Sangat aktif dan disiplin saat forum tabmin.')
        """, (pid, grp))
        
        # PJK score
        cursor.execute("""
            INSERT OR IGNORE INTO tabmin_member_evaluations
            (participant_id, evaluator_role, evaluator_name, tabmin_group, score_kehadiran, score_partisipasi, score_sikap, notes)
            VALUES (?, 'pjk', ?, ?, 4, 4, 5, 'Kordinasi dalam kelompok sangat baik.')
        """, (pid, pjk, grp))
        
        # Peer reviews (2-3 peers)
        peers_in_group = [x for x in participants if x['tabmin_group'] == grp and x['id'] != pid]
        for peer in peers_in_group[:3]:
            cursor.execute("""
                INSERT OR IGNORE INTO tabmin_member_evaluations
                (participant_id, evaluator_role, evaluator_name, tabmin_group, score_kehadiran, score_partisipasi, score_sikap, notes)
                VALUES (?, 'peer', ?, ?, 4, 5, 5, 'Rekan yang kooperatif dan solid.')
            """, (pid, peer['name'], grp))

    # 2. Seed Tabmin Product Evaluations for all 6 groups
    for g_num in range(1, 7):
        grp_name = f"Kelompok {g_num}"
        cursor.execute("""
            INSERT OR IGNORE INTO tabmin_product_evaluations
            (tabmin_group, evaluator_name, score_reporter, score_fotografer, score_ilustrator, score_layouter, score_marcomm, notes)
            VALUES (?, 'HRD Kelompok', 4, 5, 4, 5, 4, 'Output karya kelompok terintegrasi dengan baik.')
        """, (grp_name,))

    # 3. Seed Kelas Profesi General & Tasks for sample participants
    for p in sample_targets:
        pid = p['id']
        prof = p['profession']
        
        # Keprof 1
        cursor.execute("""
            INSERT OR IGNORE INTO profesi_attendance
            (participant_id, keprof_session, is_absen, evaluator_name)
            VALUES (?, 1, 0, 'HRD Profesi')
        """, (pid,))
        cursor.execute("""
            INSERT OR IGNORE INTO profesi_general_evaluations
            (participant_id, keprof_session, evaluator_name, score_kehadiran, score_partisipasi, score_sikap, is_absen, notes)
            VALUES (?, 1, 'HRD Profesi', 5, 4, 5, 0, 'Hadir tepat waktu di Keprof 1.')
        """, (pid,))
        cursor.execute("""
            INSERT OR IGNORE INTO profesi_task_evaluations
            (participant_id, keprof_session, is_replacement, score_teknis, hrd_evaluator_name, score_isi, wali_evaluator_name, task_notes)
            VALUES (?, 1, 0, 5, 'HRD Profesi', 4, 'Wali Kelas ' || ?, 'Kepatuhan format dan substansi tugas memuaskan.')
        """, (pid, prof))
        
        # Keprof 2
        cursor.execute("""
            INSERT OR IGNORE INTO profesi_attendance
            (participant_id, keprof_session, is_absen, evaluator_name)
            VALUES (?, 2, 0, 'HRD Profesi')
        """, (pid,))
        cursor.execute("""
            INSERT OR IGNORE INTO profesi_general_evaluations
            (participant_id, keprof_session, evaluator_name, score_kehadiran, score_partisipasi, score_sikap, is_absen, notes)
            VALUES (?, 2, 'HRD Profesi', 4, 4, 4, 0, 'Partisipasi baik.')
        """, (pid,))
        cursor.execute("""
            INSERT OR IGNORE INTO profesi_task_evaluations
            (participant_id, keprof_session, is_replacement, score_teknis, hrd_evaluator_name, score_isi, wali_evaluator_name, task_notes)
            VALUES (?, 2, 0, 4, 'HRD Profesi', 5, 'Wali Kelas ' || ?, 'Analisis mendalam dan visual rapi.')
        """, (pid, prof))
        
        # Keprof 3
        cursor.execute("""
            INSERT OR IGNORE INTO profesi_attendance
            (participant_id, keprof_session, is_absen, evaluator_name)
            VALUES (?, 3, 0, 'HRD Profesi')
        """, (pid,))
        cursor.execute("""
            INSERT OR IGNORE INTO profesi_general_evaluations
            (participant_id, keprof_session, evaluator_name, score_kehadiran, score_partisipasi, score_sikap, is_absen, notes)
            VALUES (?, 3, 'HRD Profesi', 5, 5, 5, 0, 'Diskusi akhir sangat hidup.')
        """, (pid,))

    print("Sample evaluations seeded.")

if __name__ == "__main__":
    seed_database(seed_sample_scores=True)
