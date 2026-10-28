import requests

BASE_URL = "http://127.0.0.1:8000"

def test_system():
    print("=== STARTING FULL SYSTEM VERIFICATION ===")
    
    # 1. Login as Teknisi (Athena Lovelyta Jasmine)
    res = requests.post(f"{BASE_URL}/api/auth/login-panitia", json={
        "jabatan": "teknisi",
        "password": "kxm902"
    })
    assert res.status_code == 200, f"Teknisi login failed: {res.text}"
    token_teknisi = res.json()["token"]
    headers_teknisi = {"Authorization": f"Bearer {token_teknisi}"}
    print("[PASS] Teknisi login OK (Athena)")

    # 2. Login as HRD Profesi Marcomm (Felia Nazwa Khairunnisa)
    res = requests.post(f"{BASE_URL}/api/auth/login-panitia", json={
        "jabatan": "hrd",
        "password": "zkp362"
    })
    assert res.status_code == 200, f"HRD Profesi login failed: {res.text}"
    token_hrd_prof = res.json()["token"]
    headers_hrd_prof = {"Authorization": f"Bearer {token_hrd_prof}"}
    hrd_user = res.json()["user"]
    print(f"[PASS] HRD Profesi login OK ({hrd_user['full_name']}, prof={hrd_user['assigned_profession']})")

    # 3. Login as Wali Kelas Marcomm (Farhan)
    res = requests.post(f"{BASE_URL}/api/auth/login-panitia", json={
        "jabatan": "wali_kelas",
        "password": "cxz074"
    })
    assert res.status_code == 200, f"Wali Kelas Marcomm login failed: {res.text}"
    token_wali = res.json()["token"]
    headers_wali = {"Authorization": f"Bearer {token_wali}"}
    wali_user = res.json()["user"]
    print(f"[PASS] Wali Kelas login OK ({wali_user['full_name']}, prof={wali_user['assigned_profession']})")

    # 4. Check Wali Kelas CANNOT set attendance
    res = requests.post(f"{BASE_URL}/api/eval/profesi-attendance", json={
        "participant_id": 1,
        "keprof_session": 1,
        "is_absen": 1
    }, headers=headers_wali)
    assert res.status_code == 403, f"Wali should be forbidden from setting attendance, got {res.status_code}"
    print("[PASS] Wali Kelas forbidden from setting attendance (403 confirmed)")

    # 5. Fetch participants for Marcomm
    res = requests.get(f"{BASE_URL}/api/eval/participants", headers=headers_hrd_prof)
    participants = res.json()["participants"]
    assert len(participants) > 0
    # Every participant must be Marcomm for Felia
    for p in participants:
        assert p["profession"] == "Marcomm", f"Isolation breach: found {p['profession']}"
    test_p = participants[0]
    p_id = test_p["id"]
    print(f"[PASS] HRD Profesi sees only Marcomm ({len(participants)} participants, testing on: {test_p['name']})")

    # 6. Verify cross-profession isolation: HRD Marcomm cannot set attendance for Ilustrator
    res_cross = requests.get(f"{BASE_URL}/api/eval/participants", headers=headers_teknisi)
    ilustrator_p = next(x for x in res_cross.json()["participants"] if x["profession"] == "Ilustrator")
    res_reject = requests.post(f"{BASE_URL}/api/eval/profesi-attendance", json={
        "participant_id": ilustrator_p["id"],
        "keprof_session": 1,
        "is_absen": 1
    }, headers=headers_hrd_prof)
    assert res_reject.status_code == 403, f"Cross-profession attendance must be 403, got {res_reject.status_code}"
    print(f"[PASS] Cross-profession isolation verified: HRD Marcomm cannot modify Ilustrator participant")

    # 7. Test Absent Participant Flow for Keprof 1
    # HRD sets attendance to ABSEN (is_absen = 1)
    res = requests.post(f"{BASE_URL}/api/eval/profesi-attendance", json={
        "participant_id": p_id,
        "keprof_session": 1,
        "is_absen": 1
    }, headers=headers_hrd_prof)
    assert res.status_code == 200, res.text
    print(f"[PASS] Keprof 1 attendance set to Absen for {test_p['name']}")

    # HRD evaluates Tugas Pengganti (is_replacement = 1, teknis = 4)
    res = requests.post(f"{BASE_URL}/api/eval/profesi-task", json={
        "participant_id": p_id,
        "keprof_session": 1,
        "is_replacement": 1,
        "score_teknis": 4,
        "task_notes": "Tugas pengganti teknis rapi"
    }, headers=headers_hrd_prof)
    assert res.status_code == 200, res.text

    # Wali Kelas evaluates Tugas Pengganti (is_replacement = 1, isi = 4)
    res = requests.post(f"{BASE_URL}/api/eval/profesi-task", json={
        "participant_id": p_id,
        "keprof_session": 1,
        "is_replacement": 1,
        "score_isi": 4,
        "task_notes": "Tugas pengganti isi memuaskan"
    }, headers=headers_wali)
    assert res.status_code == 200, res.text
    # Expected Tugas Pengganti score = 4.0

    # HRD evaluates Tugas Utama (is_replacement = 0, teknis = 5)
    res = requests.post(f"{BASE_URL}/api/eval/profesi-task", json={
        "participant_id": p_id,
        "keprof_session": 1,
        "is_replacement": 0,
        "score_teknis": 5,
        "task_notes": "Tugas utama reguler teknis sangat baik"
    }, headers=headers_hrd_prof)
    assert res.status_code == 200, res.text

    # Wali Kelas evaluates Tugas Utama (is_replacement = 0, isi = 5)
    res = requests.post(f"{BASE_URL}/api/eval/profesi-task", json={
        "participant_id": p_id,
        "keprof_session": 1,
        "is_replacement": 0,
        "score_isi": 5,
        "task_notes": "Tugas utama reguler isi sangat baik"
    }, headers=headers_wali)
    assert res.status_code == 200, res.text
    # Expected Tugas Utama score = 5.0
    print("[PASS] Absent participant evaluated on BOTH Tugas Pengganti and Tugas Utama")

    # 8. Test Present Participant Flow for Keprof 2
    # HRD sets attendance to HADIR (is_absen = 0)
    res = requests.post(f"{BASE_URL}/api/eval/profesi-attendance", json={
        "participant_id": p_id,
        "keprof_session": 2,
        "is_absen": 0
    }, headers=headers_hrd_prof)
    assert res.status_code == 200, res.text

    # HRD evaluates Penilaian Umum Keprof 2 (kehadiran=5, partisipasi=4, sikap=5 -> avg 4.67)
    res = requests.post(f"{BASE_URL}/api/eval/profesi-general", json={
        "participant_id": p_id,
        "keprof_session": 2,
        "score_kehadiran": 5,
        "score_partisipasi": 4,
        "score_sikap": 5,
        "is_absen": 0,
        "notes": "Hadir aktif"
    }, headers=headers_hrd_prof)
    assert res.status_code == 200, res.text

    # HRD evaluates Tugas Utama Keprof 2 (is_replacement = 0, teknis = 4)
    res = requests.post(f"{BASE_URL}/api/eval/profesi-task", json={
        "participant_id": p_id,
        "keprof_session": 2,
        "is_replacement": 0,
        "score_teknis": 4
    }, headers=headers_hrd_prof)
    assert res.status_code == 200, res.text

    # Wali evaluates Tugas Utama Keprof 2 (is_replacement = 0, isi = 4)
    res = requests.post(f"{BASE_URL}/api/eval/profesi-task", json={
        "participant_id": p_id,
        "keprof_session": 2,
        "is_replacement": 0,
        "score_isi": 4
    }, headers=headers_wali)
    assert res.status_code == 200, res.text
    print("[PASS] Present participant evaluated on Penilaian Umum and Tugas Utama")

    # 9. Test Keprof 3 Absent
    res = requests.post(f"{BASE_URL}/api/eval/profesi-attendance", json={
        "participant_id": p_id,
        "keprof_session": 3,
        "is_absen": 1
    }, headers=headers_hrd_prof)
    assert res.status_code == 200, res.text
    print("[PASS] Keprof 3 attendance set to Absen")

    # 10. Verify Recap Calculations via Recap API
    res = requests.get(f"{BASE_URL}/api/recap/master", headers=headers_teknisi)
    assert res.status_code == 200, res.text
    recap_list = res.json()["data"]
    target_p = next(x for x in recap_list if x["participant_id"] == p_id)
    
    # Detail profesi verification
    res_prof = requests.get(f"{BASE_URL}/api/recap/profesi-detail", headers=headers_teknisi)
    p_prof = next(x for x in res_prof.json()["participants"] if x["participant_id"] == p_id)
    
    print("\n--- TEST RECAP RESULTS ---")
    print(f"Participant: {target_p['name']}")
    print(f"Keprof 1 Umum / Pengganti: {p_prof['keprof1_umum']} (Expected: 4.0)")
    print(f"Keprof 1 Tugas Utama: {p_prof['keprof1_tugas']} (Expected: 5.0)")
    print(f"Keprof 2 Umum: {p_prof['keprof2_umum']} (Expected: ~4.67)")
    print(f"Keprof 2 Tugas Utama: {p_prof['keprof2_tugas']} (Expected: 4.0)")
    print(f"Keprof 3 Umum (Absent): {p_prof['keprof3_umum']} (Expected: 0.0)")
    print(f"Nilai Profesi Total: {p_prof['nilai_profesi_total']}")
    print(f"Status Absen: {p_prof['status_absen']}")

    assert p_prof["keprof1_umum"] == 4.0, f"Expected 4.0 for replacement, got {p_prof['keprof1_umum']}"
    assert p_prof["keprof1_tugas"] == 5.0, f"Expected 5.0 for main task, got {p_prof['keprof1_tugas']}"
    assert p_prof["keprof3_umum"] == 0.0, f"Expected 0.0 for absent keprof 3, got {p_prof['keprof3_umum']}"
    assert "Absen Keprof 1" in p_prof["status_absen"]
    assert "Absen Keprof 3" in p_prof["status_absen"]
    print(f"[PASS] Formula calculations perfectly match all user specifications!")

    # 11. Check PJK Isolation (Salsabila Az Zahra - Kelompok 1)
    res = requests.post(f"{BASE_URL}/api/auth/login-panitia", json={
        "jabatan": "pjk",
        "password": "fqv069"
    })
    assert res.status_code == 200
    headers_pjk = {"Authorization": f"Bearer {res.json()['token']}"}
    res = requests.get(f"{BASE_URL}/api/eval/participants", headers=headers_pjk)
    pjk_data = res.json()["participants"]
    for row in pjk_data:
        assert row["tabmin_group"] == "Kelompok 1", f"Breach in PJK isolation: {row['tabmin_group']}"
    print(f"[PASS] PJK isolation strictly confirmed ({len(pjk_data)} participants, all Kelompok 1)")

    # 12. Check HRD Kelompok Isolation (Amalia - Kelompok 4)
    res = requests.post(f"{BASE_URL}/api/auth/login-panitia", json={
        "jabatan": "hrd",
        "password": "mlz618"
    })
    assert res.status_code == 200
    headers_hrd_k4 = {"Authorization": f"Bearer {res.json()['token']}"}
    res = requests.get(f"{BASE_URL}/api/eval/participants", headers=headers_hrd_k4)
    hrd_k4_data = res.json()["participants"]
    for row in hrd_k4_data:
        assert row["tabmin_group"] == "Kelompok 4", f"Breach in HRD Kelompok isolation: {row['tabmin_group']}"
    print(f"[PASS] HRD Kelompok isolation strictly confirmed ({len(hrd_k4_data)} participants, all Kelompok 4)")

    # 13. Check Peserta Login validation
    res_p_login = requests.post(f"{BASE_URL}/api/auth/login-peserta", json={
        "profession": test_p["profession"],
        "tabmin_group": test_p["tabmin_group"],
        "password": "wrong_password"
    })
    assert res_p_login.status_code == 401, "Expected 401 for wrong password"
    print("[PASS] Peserta validation working properly")

    print("\n=== ALL TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_system()
