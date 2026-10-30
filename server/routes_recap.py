from fastapi import APIRouter, HTTPException, Depends, Query, Response
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict
from server.database import get_db
from server.auth import apply_user_scope, get_current_user, require_roles
from server.excel_export import generate_excel_report

router = APIRouter(prefix="/api/recap", tags=["Recap & Dashboard"])

RECAP_ROLES = [
    "teknisi", "supervisor", "kepala_sekolah", "wakil_kepala",
    "hrd_kepala", "hrd_profesi", "hrd_kelompok", "hrd_kelompok_ketua", "hrd_all"
]

def get_full_recap_data(
    group: Optional[str] = None,
    profession: Optional[str] = None,
    search: Optional[str] = None,
    group_or_profession: bool = False,
):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Fetch participants
        p_query = "SELECT id, name, profession, tabmin_group, pjk_name FROM participants WHERE 1=1"
        p_params = []
        if group_or_profession and group and group != "ALL" and profession and profession != "ALL":
            p_query += " AND (tabmin_group = ? OR profession = ?)"
            p_params.extend([group, profession])
        else:
            if group and group != "ALL":
                p_query += " AND tabmin_group = ?"
                p_params.append(group)
            if profession and profession != "ALL":
                p_query += " AND profession = ?"
                p_params.append(profession)
        if search:
            p_query += " AND (name LIKE ? OR tabmin_group LIKE ? OR profession LIKE ?)"
            s = f"%{search}%"
            p_params.extend([s, s, s])
            
        p_query += " ORDER BY tabmin_group, profession, name"
        cursor.execute(p_query, p_params)
        participants = cursor.fetchall()
        
        # 2. Fetch all Tabmin Member Evals
        cursor.execute("SELECT * FROM tabmin_member_evaluations")
        all_tabmin_evals = cursor.fetchall()
        tab_by_pid = {}
        for ev in all_tabmin_evals:
            pid = ev["participant_id"]
            if pid not in tab_by_pid:
                tab_by_pid[pid] = {"hrd": [], "pjk": [], "peer": []}
            tab_by_pid[pid][ev["evaluator_role"]].append(ev)

        # 3. Fetch Tabmin Product Evals
        cursor.execute("SELECT * FROM tabmin_product_evaluations")
        prod_evals = cursor.fetchall()
        prod_by_grp = {}
        for p in prod_evals:
            tot = (p["score_reporter"] + p["score_fotografer"] + p["score_ilustrator"] + p["score_layouter"] + p["score_marcomm"]) / 5.0
            prod_by_grp[p["tabmin_group"]] = round(tot, 2)

        # 4. Fetch Profesi General Evals
        cursor.execute("SELECT * FROM profesi_general_evaluations")
        all_prof_gen = cursor.fetchall()
        prof_gen_by_pid = {}
        for g in all_prof_gen:
            pid = g["participant_id"]
            sess = g["keprof_session"]
            if pid not in prof_gen_by_pid:
                prof_gen_by_pid[pid] = {}
            prof_gen_by_pid[pid][sess] = g

        cursor.execute("SELECT * FROM profesi_attendance")
        all_attendance = cursor.fetchall()
        attendance_by_pid = {}
        for attendance in all_attendance:
            attendance_by_pid.setdefault(attendance["participant_id"], {})[
                attendance["keprof_session"]
            ] = attendance

        # 5. Fetch Profesi Task Evals
        cursor.execute("SELECT * FROM profesi_task_evaluations")
        all_prof_tasks = cursor.fetchall()
        prof_task_by_pid = {}
        for t in all_prof_tasks:
            pid = t["participant_id"]
            sess = t["keprof_session"]
            is_rep = t["is_replacement"]
            if pid not in prof_task_by_pid:
                prof_task_by_pid[pid] = {}
            prof_task_by_pid[pid][(sess, is_rep)] = t

        # Build Master Data & Detail Arrays
        master_rows = []
        detail_tabmin_rows = []
        detail_profesi_rows = []

        for p in participants:
            pid = p["id"]
            pname = p["name"]
            grp = p["tabmin_group"]
            prof = p["profession"]
            pjk = p["pjk_name"] or ""

            # --- A. TABMIN CALCULATION ---
            t_evals = tab_by_pid.get(pid, {"hrd": [], "pjk": [], "peer": []})
            
            # HRD score
            skor_hrd = None
            if t_evals["hrd"]:
                h = t_evals["hrd"][0]
                skor_hrd = round((h["score_kehadiran"] + h["score_partisipasi"] + h["score_sikap"]) / 3.0, 2)
                
            # PJK score
            skor_pjk = None
            if t_evals["pjk"]:
                pj = t_evals["pjk"][0]
                skor_pjk = round((pj["score_kehadiran"] + pj["score_partisipasi"] + pj["score_sikap"]) / 3.0, 2)

            # Peer score
            skor_peer = None
            peer_count = len(t_evals["peer"])
            if peer_count > 0:
                peer_avgs = [(pr["score_kehadiran"] + pr["score_partisipasi"] + pr["score_sikap"]) / 3.0 for pr in t_evals["peer"]]
                skor_peer = round(sum(peer_avgs) / peer_count, 2)

            # Formula: Nilai Akhir Anggota = Rata-Rata(Skor HRD + Skor PJK + Rata-Rata Skor Peer)
            tabmin_components = []
            if skor_hrd is not None:
                tabmin_components.append(skor_hrd)
            if skor_pjk is not None:
                tabmin_components.append(skor_pjk)
            if skor_peer is not None:
                tabmin_components.append(skor_peer)
                
            nilai_tabmin_anggota = round(sum(tabmin_components) / len(tabmin_components), 2) if tabmin_components else None
            
            # Status penilai string
            status_parts = []
            if skor_hrd is not None: status_parts.append("HRD ✓")
            if skor_pjk is not None: status_parts.append("PJK ✓")
            if peer_count > 0: status_parts.append(f"Peer ({peer_count})")
            status_penilai = " | ".join(status_parts) if status_parts else "Belum Dinilai"

            nilai_produk_kelompok = None if profession and not group else prod_by_grp.get(grp, None)

            # --- B. KELAS PROFESI CALCULATION ---
            gen_map = prof_gen_by_pid.get(pid, {})
            attendance_map = attendance_by_pid.get(pid, {})
            task_map = prof_task_by_pid.get(pid, {})

            def get_sess_score(sess):
                g = gen_map.get(sess)
                attendance = attendance_map.get(sess)
                is_absen = bool(attendance.get("is_absen", 0)) if attendance else False

                tugas_reg_score = None
                tugas_rep_score = None
                if sess in (1, 2):
                    # 1. Regular task (is_replacement = 0)
                    t_reg = task_map.get((sess, 0))
                    if t_reg:
                        t_comps = []
                        if t_reg.get("score_teknis") is not None: t_comps.append(t_reg["score_teknis"])
                        if t_reg.get("score_isi") is not None: t_comps.append(t_reg["score_isi"])
                        if t_comps: tugas_reg_score = round(sum(t_comps) / len(t_comps), 2)

                    # 2. Replacement task (is_replacement = 1)
                    t_rep = task_map.get((sess, 1))
                    if t_rep:
                        t_comps = []
                        if t_rep.get("score_teknis") is not None: t_comps.append(t_rep["score_teknis"])
                        if t_rep.get("score_isi") is not None: t_comps.append(t_rep["score_isi"])
                        if t_comps: tugas_rep_score = round(sum(t_comps) / len(t_comps), 2)

                # Formula sesuai aturan user:
                # Keprof 1 & 2:
                # 1. Hadir = penilaian umum + tugas (reguler)
                # 2. Tidak hadir = tugas pengganti + tugas (reguler)
                # (Nilai dari penilaian umum diganti dengan nilai dari tugas pengganti)
                #
                # Keprof 3: hanya ada penilaian umum saja. Jika tidak hadir, tidak mendapatkan nilai (0.0).
                if sess in (1, 2):
                    if not is_absen:
                        umum_score = None
                        if g and g.get("score_kehadiran") is not None:
                            umum_score = round((g["score_kehadiran"] + g["score_partisipasi"] + g["score_sikap"]) / 3.0, 2)
                        comps = []
                        if umum_score is not None: comps.append(umum_score)
                        if tugas_reg_score is not None: comps.append(tugas_reg_score)
                        sess_total = round(sum(comps) / len(comps), 2) if comps else None
                        return umum_score, tugas_reg_score, sess_total, False
                    else:
                        # Nilai penilaian umum digantikan oleh nilai tugas pengganti
                        comps = []
                        if tugas_rep_score is not None: comps.append(tugas_rep_score)
                        if tugas_reg_score is not None: comps.append(tugas_reg_score)
                        sess_total = round(sum(comps) / len(comps), 2) if comps else None
                        # Return tugas_rep_score in the first position to display as replacement for umum
                        return tugas_rep_score, tugas_reg_score, sess_total, True
                else: # sess == 3
                    if is_absen:
                        # Jika tidak hadir keprof 3, tidak mendapatkan nilai (0.0)
                        return 0.0, None, 0.0, True
                    else:
                        umum_score = None
                        if g and g.get("score_kehadiran") is not None:
                            umum_score = round((g["score_kehadiran"] + g["score_partisipasi"] + g["score_sikap"]) / 3.0, 2)
                        return umum_score, None, umum_score, False

            k1_u, k1_t, k1_tot, k1_abs = get_sess_score(1)
            k2_u, k2_t, k2_tot, k2_abs = get_sess_score(2)
            k3_u, k3_t, k3_tot, k3_abs = get_sess_score(3)

            # Rata-rata dari nilai mereka dalam tiga kelas profesi
            prof_comps = [c for c in [k1_tot, k2_tot, k3_tot] if c is not None]
            nilai_profesi_total = round(sum(prof_comps) / len(prof_comps), 2) if prof_comps else None

            # Absen status string
            absen_parts = []
            if k1_abs: absen_parts.append("Absen Keprof 1")
            if k2_abs: absen_parts.append("Absen Keprof 2")
            if k3_abs: absen_parts.append("Absen Keprof 3")
            status_absen = ", ".join(absen_parts) if absen_parts else "Hadir Lengkap"

            # --- C. FINAL SCORE COMBINED ---
            final_comps = []
            if nilai_profesi_total is not None: final_comps.append(nilai_profesi_total)
            if nilai_tabmin_anggota is not None: final_comps.append(nilai_tabmin_anggota)

            nilai_akhir_skala_5 = round(sum(final_comps) / len(final_comps), 2) if final_comps else None
            nilai_akhir_skala_100 = round(nilai_akhir_skala_5 * 20.0, 1) if nilai_akhir_skala_5 is not None else None

            # Predikat
            if nilai_akhir_skala_5 is not None:
                if nilai_akhir_skala_5 >= 4.5:
                    predikat = "Sangat Memuaskan"
                elif nilai_akhir_skala_5 >= 3.8:
                    predikat = "Memuaskan"
                elif nilai_akhir_skala_5 >= 3.0:
                    predikat = "Cukup"
                else:
                    predikat = "Perlu Bimbingan"
            else:
                predikat = "Belum Lengkap"

            # Master record
            master_rows.append({
                "participant_id": pid,
                "name": pname,
                "profession": prof,
                "tabmin_group": grp,
                "pjk_name": pjk,
                "nilai_profesi": nilai_profesi_total,
                "nilai_tabmin_anggota": nilai_tabmin_anggota,
                "nilai_produk_kelompok": nilai_produk_kelompok,
                "nilai_akhir_skala_5": nilai_akhir_skala_5,
                "nilai_akhir_skala_100": nilai_akhir_skala_100,
                "predikat": predikat,
                "status_penilai": status_penilai
            })

            # Detail Tabmin Record
            detail_tabmin_rows.append({
                "participant_id": pid,
                "name": pname,
                "profession": prof,
                "tabmin_group": grp,
                "pjk_name": pjk,
                "skor_hrd": skor_hrd,
                "skor_pjk": skor_pjk,
                "skor_peer": skor_peer,
                "peer_count": peer_count,
                "nilai_tabmin_anggota": nilai_tabmin_anggota,
                "status_penilai": status_penilai
            })

            # Detail Profesi Record
            detail_profesi_rows.append({
                "participant_id": pid,
                "name": pname,
                "profession": prof,
                "tabmin_group": grp,
                "keprof1_umum": k1_u,
                "keprof1_tugas": k1_t,
                "keprof2_umum": k2_u,
                "keprof2_tugas": k2_t,
                "keprof3_umum": k3_u,
                "nilai_profesi_total": nilai_profesi_total,
                "status_absen": status_absen
            })

        # Fetch product rows
        cursor.execute("SELECT * FROM tabmin_product_evaluations ORDER BY tabmin_group")
        raw_prods = cursor.fetchall()
        product_rows = []
        for rp in raw_prods:
            if profession and profession != "ALL" and not group:
                continue
            if group and group != "ALL" and rp["tabmin_group"] != group:
                continue
            tot = (rp["score_reporter"] + rp["score_fotografer"] + rp["score_ilustrator"] + rp["score_layouter"] + rp["score_marcomm"]) / 5.0
            product_rows.append({
                "tabmin_group": rp["tabmin_group"],
                "score_reporter": rp["score_reporter"],
                "score_fotografer": rp["score_fotografer"],
                "score_ilustrator": rp["score_ilustrator"],
                "score_layouter": rp["score_layouter"],
                "score_marcomm": rp["score_marcomm"],
                "score_total": round(tot, 2),
                "notes": rp.get("notes", "")
            })

        return master_rows, detail_tabmin_rows, product_rows, detail_profesi_rows

@router.get("/master")
def get_master_recap(
    group: Optional[str] = None,
    profession: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(require_roles(RECAP_ROLES))
):
    group, profession = apply_user_scope(user, group, profession)

    master_rows, detail_tabmin, detail_prod, detail_prof = get_full_recap_data(
        group, profession, search, group_or_profession=user.get("role") == "hrd_all"
    )
    return {
        "user_role": user["role"],
        "user_name": user["full_name"],
        "total_count": len(master_rows),
        "data": master_rows
    }

@router.get("/tabmin-detail")
def get_tabmin_detail(
    group: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(require_roles(RECAP_ROLES))
):
    group, profession = apply_user_scope(user, group)

    _, detail_tabmin, detail_prod, _ = get_full_recap_data(
        group=group,
        profession=profession,
        search=search,
        group_or_profession=user.get("role") == "hrd_all",
    )
    return {
        "members": detail_tabmin,
        "products": detail_prod
    }

@router.get("/profesi-detail")
def get_profesi_detail(
    profession: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(require_roles(RECAP_ROLES))
):
    group, profession = apply_user_scope(user, profession=profession)

    _, _, _, detail_prof = get_full_recap_data(
        group=group,
        profession=profession,
        search=search,
        group_or_profession=user.get("role") == "hrd_all",
    )
    return {
        "participants": detail_prof
    }

@router.get("/summary-kpi")
def get_summary_kpi(user: dict = Depends(require_roles(RECAP_ROLES))):
    filter_group, filter_prof = apply_user_scope(user)

    with get_db() as conn:
        cursor = conn.cursor()
        group_or_profession = user.get("role") == "hrd_all"
        master_rows, _, _, _ = get_full_recap_data(
            group=filter_group,
            profession=filter_prof,
            group_or_profession=group_or_profession,
        )
        total_p = len(master_rows)
        total_g = len({row["tabmin_group"] for row in master_rows})
        scope_sql = []
        scope_params = []
        if group_or_profession and filter_group and filter_prof:
            scope_sql.append("(p.tabmin_group = ? OR p.profession = ?)")
            scope_params.extend([filter_group, filter_prof])
        elif filter_group:
            scope_sql.append("p.tabmin_group = ?")
            scope_params.append(filter_group)
        if not group_or_profession and filter_prof:
            scope_sql.append("p.profession = ?")
            scope_params.append(filter_prof)
        scope_where = (" WHERE " + " AND ".join(scope_sql)) if scope_sql else ""

        cursor.execute(f"""
            SELECT COUNT(*) AS cnt FROM tabmin_member_evaluations e
            JOIN participants p ON p.id = e.participant_id{scope_where}
        """, scope_params)
        cnt_tab_eval = cursor.fetchone()["cnt"]
        cursor.execute(f"""
            SELECT COUNT(*) AS cnt FROM profesi_general_evaluations e
            JOIN participants p ON p.id = e.participant_id{scope_where}
        """, scope_params)
        cnt_prof_gen = cursor.fetchone()["cnt"]
        cursor.execute(f"""
            SELECT COUNT(*) AS cnt FROM profesi_task_evaluations e
            JOIN participants p ON p.id = e.participant_id{scope_where}
        """, scope_params)
        cnt_prof_task = cursor.fetchone()["cnt"]

        scores = [r["nilai_akhir_skala_5"] for r in master_rows if r["nilai_akhir_skala_5"] is not None]
        avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0

        evaluated_p = len(scores)
        completion_pct = round((evaluated_p / total_p) * 100, 1) if total_p > 0 else 0

        # Top 5 participants
        sorted_m = sorted([r for r in master_rows if r["nilai_akhir_skala_5"] is not None], key=lambda x: x["nilai_akhir_skala_5"], reverse=True)
        top_5 = sorted_m[:5]

        # Profession average
        prof_groups = {}
        for r in master_rows:
            p = r["profession"]
            if p not in prof_groups: prof_groups[p] = []
            if r["nilai_profesi"] is not None: prof_groups[p].append(r["nilai_profesi"])

        prof_stats = {k: round(sum(v)/len(v), 2) if v else 0.0 for k, v in prof_groups.items()}

        return {
            "total_participants": total_p,
            "total_groups": total_g,
            "total_tabmin_evals": cnt_tab_eval,
            "total_prof_evals": cnt_prof_gen + cnt_prof_task,
            "evaluated_participants": evaluated_p,
            "completion_percentage": completion_pct,
            "average_overall_score": avg_score,
            "top_performers": top_5,
            "profession_averages": prof_stats
        }

@router.get("/export-excel")
def export_excel_report(
    group: Optional[str] = None,
    profession: Optional[str] = None,
    user: dict = Depends(require_roles(RECAP_ROLES))
):
    group, profession = apply_user_scope(user, group, profession)

    master_rows, detail_tabmin, detail_prod, detail_prof = get_full_recap_data(
        group, profession, group_or_profession=user.get("role") == "hrd_all"
    )
    excel_stream = generate_excel_report(master_rows, detail_tabmin, detail_prod, detail_prof)
    
    filename = "Rekapitulasi_Nilai_KI23.xlsx"
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
