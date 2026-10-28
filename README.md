# Sistem Penilaian Acara KI23 (Role-Based Access Control)

Aplikasi web modern berbasis Python FastAPI untuk mengelola penilaian peserta acara **KI23 (Korpus Institute)** dengan penegakan hak akses berbasis peran (**Role-Based Access Control / RBAC**) yang ketat. Aplikasi menggunakan SQLite saat dijalankan lokal dan Turso/libSQL untuk database persisten pada Vercel.

---

## 🚀 Fitur Utama & Pembagian Peran

### 1. Portal Masuk Awal Berbasis Nama Lengkap
- Pada halaman utama website, setiap pengguna (baik Panitia maupun Peserta) langsung diminta untuk **menuliskan nama lengkap mereka**.
- **Pencarian Cerdas & Autocomplete**: Mendukung pencarian instan case-insensitive, toleran spasi dan tanda baca, serta menampilkan saran otomatis lengkap dengan label peran.
- Pengguna langsung diarahkan secara otomatis ke halaman yang sesuai dengan hak akses perannya.

---

### 2. Pembagian Hak Akses Panitia (Berdasarkan `Pakai Daftar Ini Ya.xlsx`)

| Posisi / Role | Daftar Nama Panitia | Wewenang & Hak Akses |
|---|---|---|
| 🛠️ **Teknisi** | **Athena Lovelyta Jasmine** | **Akses Penuh**: Melihat dan mengedit semua nilai (Kelas Profesi & Tabmin), Panel Manajemen Teknisi (Kelola Panitia & Pengguna, Kelola Peserta & Jurusan, Pindah Kelompok Tabmin, Sinkron Excel). |
| 🎓 **Kepala Sekolah** | **Azizah** | **Read-Only Penuh**: Hanya dapat melihat seluruh penilaian (Dashboard Rekapitulasi Master, KPI, Nilai Profesi & Tabmin, Ekspor Excel) **tanpa akses mengedit**. |
| 🎓 **Wakil Kepala Sekolah** | *(Dikosongkan di awal; Teknisi dapat menambah/menginput sendiri)* | **Read-Only Penuh**: Sama seperti Kepala Sekolah, hanya dapat melihat seluruh penilaian tanpa akses mengedit. |
| 👑 **Kepala HRD** | **Mia Nur Aisyah** | **Lihat & Edit Semua Nilai**: Melihat dan mengedit seluruh penilaian di Kelas Profesi (Keprof 1-3 & Tugas) dan Tabmin (Anggota & Produk Karya). |
| 📚 **HRD Profesi** | **Felia Nazwa Khairunnisa** | Hanya dapat mengakses peserta dari profesi yang ditugaskan; dapat mengatur kehadiran dan menilai kelas profesi. |
| 👑👥 **HRD Kelompok (Ketua)** | **Kayana Syahda P.E** | Mengelola penilaian Tabmin serta rekap sesuai lingkup kelompok. |
| 👥 **HRD Kelompok** | HRD yang ditugaskan ke Kelompok 1–6 | Hanya dapat mengakses dan mengedit penilaian Tabmin untuk kelompok yang ditugaskan. |
| 🌟 **HRD Kelompok & Profesi** | **Cut Khairunnisa**, **Manika Dwi Zakia** | Lingkup akses dibatasi sekaligus ke kelompok dan profesi yang tercantum pada penugasan panitia. |
| 🧑‍🏫 **Wali Kelas** | **Fara**, **Natasha** (Reporter)<br>**Farhan**, **Maharani** (Marcomm)<br>**Khairu** (Ilustrator)<br>**Ibrahim**, **Zaskia** (Fotografer)<br>**Rahimah**, **Audy** (Layouter) | Hanya dapat menilai isi Tugas Utama dan Tugas Pengganti Keprof 1–2 untuk profesi yang ditugaskan; status kehadiran dikelola HRD. |
| 🤝 **PJK (Penanggung Jawab Kelompok)** | **Salsabila Az Zahra** (Kelompok 1)<br>**Novita Tireina** (Kelompok 2)<br>**Aldi Arkananta** (Kelompok 3)<br>**Nadiny** (Kelompok 4)<br>**Sarah Nur Rahmah** (Kelompok 5)<br>**Ananda Ayu Pertiwi** (Kelompok 6) | Hanya dapat mengakses dan menilai anggota kelompok Tabmin yang ditugaskan kepadanya. |

### Aturan Penilaian Kelas Profesi
- **Keprof 1 dan 2:** Peserta hadir mendapat Penilaian Umum dan Tugas Utama. Peserta tidak hadir tidak mendapat form Penilaian Umum, tetapi mendapat penilaian Tugas Pengganti dan tetap mendapat penilaian Tugas Utama. Nilai Tugas Pengganti menggantikan komponen Penilaian Umum pada nilai sesi.
- **Keprof 3:** Hanya Penilaian Umum; peserta yang tidak hadir tidak mendapat nilai sesi.
- Nilai akhir kelas profesi merupakan rata-rata nilai Keprof 1, 2, dan 3.
- Pengaturan kehadiran hanya dapat dilakukan oleh HRD Profesi, Kepala HRD, dan Teknisi.

---

### 3. Akses Peserta KI23 (Anggota Kelompok Tabmin)
- Diambil dari berkas **Pengumuman Tahap I KI** (111 Peserta, 5 Divisi Profesi) dan **Kelompok Tabmin** (6 Kelompok).
- **Kerahasiaan Mutlak**: Peserta **hanya bisa melakukan penilaian (Peer Review)** untuk teman satu kelompok Tabmin mereka sendiri (tidak bisa menilai diri sendiri).
- Peserta **tidak dapat melihat hasil penilaian lain** (tidak ada akses ke nilai HRD, nilai PJK, nilai teman lain, maupun dashboard rekapitulasi).

---

### 4. Panel Khusus Teknisi: Manajemen Panitia & Pengguna
Teknisi (**Athena Lovelyta Jasmine**) memiliki tab khusus **"Kelola Panitia & User"** di Panel Teknisi:
1. **Tambah Panitia Baru**: Tombol `+ Tambah Panitia / User` untuk mendaftarkan panitia baru kapan saja (misal: menginput nama **Wakil Kepala Sekolah**, menambah Wali Kelas atau PJK baru).
2. **Edit Panitia & Posisi**: Mengubah nama, posisi/role, profesi penugasan, atau kelompok penugasan.
3. **Hapus Panitia**: Menghapus akun staf dengan perlindungan keamanan sistem.
4. **Sinkronkan Ulang dari Excel**: Tombol 1-klik untuk menyinkronkan ulang data dari `Pakai Daftar Ini Ya.xlsx`.

---

## 🛠️ Cara Menjalankan Aplikasi

Aplikasi dapat dijalankan melalui terminal atau dengan mengklik berkas `run.bat`:

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Akses antarmuka web di browser:
👉 **http://127.0.0.1:8000/**

---

## Deploy ke Vercel dengan database persisten

Vercel menggunakan runtime serverless. File SQLite lokal dan penyimpanan sesi di memori proses tidak cocok untuk produksi: file tidak persisten antar-instance, dan permintaan berikutnya dapat dilayani proses yang berbeda. Untuk deployment, aplikasi ini menggunakan database Turso/libSQL.

1. Buat database Turso dan siapkan URL database serta auth token.
2. Di **Vercel → Project → Settings → Environment Variables**, tambahkan:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   
   Isi untuk environment Vercel yang digunakan (Production, Preview, atau Development), lalu redeploy. Jangan simpan token di source code atau commit ke Git.
3. Jika ingin mempertahankan isi database SQLite lokal, jalankan migrasi dari PowerShell pada komputer yang memiliki file `ki23_eval.db`:

   ```powershell
   $env:TURSO_DATABASE_URL = "libsql://URL-DATABASE-ANDA"
   $env:TURSO_AUTH_TOKEN = "AUTH-TOKEN-ANDA"
   python -m server.migrate_to_turso
   ```

   Migrasi menyalin tabel dan data lokal ke database Turso. Jalankan pada database Turso baru/kosong untuk menghindari konflik dengan data yang sudah ada. Perintah ini mengakses database remote, jadi jangan bagikan atau commit nilai auth token.
4. Deploy ulang aplikasi ke Vercel. Startup membuat/memastikan skema tabel tersedia; data login, peserta, penilaian, dan sesi kemudian dibaca/ditulis pada database remote yang sama.

Untuk menguji deployment, buka **Vercel → Deployments → Functions → Logs**. Jika konfigurasi database belum ada, aplikasi akan mencatat pesan yang menyebutkan variabel yang perlu ditambahkan, bukan diam-diam melanjutkan dengan database lokal yang tidak tersedia.
