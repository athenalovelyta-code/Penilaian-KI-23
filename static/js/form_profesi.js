// Form Profesi Module for HRD Profesi
// Evaluates General Keprof 1, 2, 3 & Technical compliance for Tasks

const FormProfesi = {
  selectedSession: 1,
  selectedProf: 'ALL',
  selectedParticipantId: null,
  attendanceSet: false,
  evaluationLoading: false,
  evaluationRequestId: 0,
  participants: [],
  searchQuery: '',

  // Form State
  scores: {
    kehadiran: 5,
    partisipasi: 5,
    sikap: 5,
    is_absen: 0,
    teknis_reguler: 5,
    teknis_pengganti: 5,
    notes_umum: '',
    notes_reguler: '',
    notes_pengganti: ''
  },

  async init() {
    const user = App.currentUser || {};
    this.selectedProf = ['hrd_profesi', 'hrd_all'].includes(user.role) && user.assigned_profession && user.assigned_profession !== 'ALL'
      ? user.assigned_profession
      : 'ALL';
    await this.loadParticipants();
    if (this.selectedParticipantId) {
      await this.loadParticipantEvaluation();
    }
    this.render();
  },

  async loadParticipants() {
    try {
      const res = await API.get(`/api/eval/participants?profession=${this.selectedProf !== 'ALL' ? encodeURIComponent(this.selectedProf) : ''}`);
      this.participants = (res.participants || []).sort((a, b) =>
        a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })
      );
      if (!this.participants.some(p => p.id === this.selectedParticipantId)) {
        this.selectedParticipantId = this.participants[0]?.id || null;
      }
      if (!this.selectedParticipantId) {
        this.attendanceSet = false;
        this.scores.is_absen = 0;
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat peserta: ' + err.message, 'error');
    }
  },

  async loadParticipantEvaluation() {
    const participantId = this.selectedParticipantId;
    const session = this.selectedSession;
    const requestId = ++this.evaluationRequestId;
    if (!participantId) {
      this.evaluationLoading = false;
      return;
    }

    this.evaluationLoading = true;
    this.attendanceSet = false;
    try {
      const res = await API.get(`/api/eval/profesi-general/${participantId}`);
      if (requestId !== this.evaluationRequestId || participantId !== this.selectedParticipantId) return;
      const evals = res.evaluations || [];
      const tasks = res.tasks || [];

      // 1. General Evaluation
      const attendance = (res.attendance || []).find(e => e.keprof_session === session);
      this.attendanceSet = Boolean(attendance);
      this.scores.is_absen = attendance ? attendance.is_absen : 0;
      const ev = evals.find(e => e.keprof_session === session);
      if (ev) {
        this.scores.kehadiran = (ev.score_kehadiran !== null && ev.score_kehadiran !== undefined) ? ev.score_kehadiran : 5;
        this.scores.partisipasi = (ev.score_partisipasi !== null && ev.score_partisipasi !== undefined) ? ev.score_partisipasi : 5;
        this.scores.sikap = (ev.score_sikap !== null && ev.score_sikap !== undefined) ? ev.score_sikap : 5;
        this.scores.notes_umum = ev.notes || '';
      } else {
        this.scores.kehadiran = 5;
        this.scores.partisipasi = 5;
        this.scores.sikap = 5;
        this.scores.notes_umum = '';
      }

      // 2. Regular Task
      const tReg = tasks.find(t => t.keprof_session === session && t.is_replacement === 0);
      if (tReg && tReg.score_teknis !== null && tReg.score_teknis !== undefined) {
        this.scores.teknis_reguler = tReg.score_teknis;
        this.scores.notes_reguler = tReg.task_notes || '';
      } else {
        this.scores.teknis_reguler = 5;
        this.scores.notes_reguler = '';
      }

      // 3. Replacement Task
      const tRep = tasks.find(t => t.keprof_session === session && t.is_replacement === 1);
      if (tRep && tRep.score_teknis !== null && tRep.score_teknis !== undefined) {
        this.scores.teknis_pengganti = tRep.score_teknis;
        this.scores.notes_pengganti = tRep.task_notes || '';
      } else {
        this.scores.teknis_pengganti = 5;
        this.scores.notes_pengganti = '';
      }
    } catch (err) {
      console.error('Error loading participant evaluation:', err);
    } finally {
      if (requestId === this.evaluationRequestId) {
        this.evaluationLoading = false;
      }
    }
  },

  render() {
    const container = document.getElementById('view-content');
    if (!container) return;

    const filtered = this.participants.filter(p => {
      const matchesSearch = !this.searchQuery || p.name.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesProf = this.selectedProf === 'ALL' || p.profession === this.selectedProf;
      return matchesSearch && matchesProf;
    });

    const activeParticipant = this.participants.find(p => p.id === this.selectedParticipantId) || filtered[0];
    if (activeParticipant && activeParticipant.id !== this.selectedParticipantId) {
      this.selectedParticipantId = activeParticipant.id;
    }

    container.innerHTML = `
      <div class="glass-card" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <div>
            <h2 style="font-size: 1.4rem; color: white;"><i class="fas fa-graduation-cap" style="color: var(--primary);"></i> Form Penilaian HRD Profesi</h2>
            <p style="color: var(--text-muted); font-size: 0.85rem;">Input Penilaian Umum (Keprof 1, 2, 3) dan Kepatuhan Teknis Tugas untuk 5 Profesi.</p>
          </div>
          <!-- Session Selector -->
          <div style="display: flex; gap: 8px;">
            <button class="btn ${this.selectedSession === 1 ? 'btn-primary' : 'btn-secondary'}" onclick="FormProfesi.setSession(1)">Keprof 1</button>
            <button class="btn ${this.selectedSession === 2 ? 'btn-primary' : 'btn-secondary'}" onclick="FormProfesi.setSession(2)">Keprof 2</button>
            <button class="btn ${this.selectedSession === 3 ? 'btn-primary' : 'btn-secondary'}" onclick="FormProfesi.setSession(3)">Keprof 3</button>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 320px 1fr; gap: 24px;">
        <!-- Left Panel: Participant Picker -->
        <div class="glass-card" style="height: fit-content;">
          <div style="margin-bottom: 14px;">
            ${(['hrd_profesi', 'hrd_all'].includes(App.currentUser?.role) && App.currentUser?.assigned_profession && App.currentUser.assigned_profession !== 'ALL') ? `
              <label style="font-size: 0.82rem; color: var(--text-muted); display: block; margin-bottom: 6px;">Divisi Profesi Anda</label>
              <div style="padding: 10px 14px; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.35); border-radius: var(--radius-sm); font-weight: 700; color: #a5b4fc; font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-lock" style="font-size: 0.8rem;"></i> ${App.currentUser.assigned_profession} (Isolasi Aktif)
              </div>
            ` : `
              <label style="font-size: 0.82rem; color: var(--text-muted); display: block; margin-bottom: 6px;">Filter Profesi</label>
              <select class="custom-select" style="width: 100%;" onchange="FormProfesi.setProfession(this.value)">
                <option value="ALL" ${this.selectedProf === 'ALL' ? 'selected' : ''}>Semua Profesi</option>
                <option value="Ilustrator" ${this.selectedProf === 'Ilustrator' ? 'selected' : ''}>Ilustrator</option>
                <option value="Fotografer" ${this.selectedProf === 'Fotografer' ? 'selected' : ''}>Fotografer</option>
                <option value="Layouter" ${this.selectedProf === 'Layouter' ? 'selected' : ''}>Layouter</option>
                <option value="Marcomm" ${this.selectedProf === 'Marcomm' ? 'selected' : ''}>Marcomm</option>
                <option value="Reporter" ${this.selectedProf === 'Reporter' ? 'selected' : ''}>Reporter</option>
              </select>
            `}
          </div>

          <div style="margin-bottom: 14px;">
            <input id="profesi-participant-search" type="text" class="search-input" style="width: 100%;" placeholder="Cari nama peserta..." value="${this.searchQuery}" oninput="FormProfesi.onSearch(this.value, this)">
          </div>

          <div style="max-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px;">
            ${filtered.map(p => `
              <div 
                style="padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition); border: 1px solid ${p.id === this.selectedParticipantId ? 'var(--primary)' : 'var(--border-color)'}; background: ${p.id === this.selectedParticipantId ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.02)'};"
                onclick="FormProfesi.selectParticipant(${p.id})"
              >
                <div style="font-weight: 600; font-size: 0.88rem; color: white;">${p.name}</div>
                <div style="display: flex; gap: 6px; margin-top: 4px;">
                  <span class="badge badge-profesi" style="font-size: 0.68rem;">${p.profession}</span>
                  <span class="badge badge-group" style="font-size: 0.68rem;">${p.tabmin_group}</span>
                </div>
              </div>
            `).join('') || '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Tidak ada peserta.</div>'}
          </div>
        </div>

        <!-- Right Panel: Scoring Form -->
        <div class="glass-card">
          ${activeParticipant && this.evaluationLoading ? `
            <div style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
              <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--primary); margin-bottom: 12px;"></i>
              <div>Memuat penilaian ${activeParticipant.name}...</div>
            </div>
          ` : activeParticipant ? `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 20px;">
              <div>
                <span class="badge badge-profesi">${activeParticipant.profession}</span>
                <span class="badge badge-group">${activeParticipant.tabmin_group}</span>
                <h3 style="font-size: 1.35rem; color: white; margin-top: 6px;">${activeParticipant.name}</h3>
              </div>
              <span class="badge badge-warning" style="font-size: 0.85rem; padding: 6px 14px;">
                Sesi: Keprof ${this.selectedSession}
              </span>
            </div>

            <!-- Opsi Kehadiran Kelas Profesi 1, 2, 3 -->
            <div class="attendance-toggle-card">
              <div>
                <div style="font-weight: 700; font-size: 0.9rem; color: white; display: flex; align-items: center; gap: 8px;">
                  <i class="fas fa-calendar-check" style="color: var(--secondary);"></i>
                  Status Kehadiran Kelas Profesi ${this.selectedSession}:
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 3px;">
                    ${this.attendanceSet ? (this.selectedSession <= 2 ? 
                    'Hadir = Penilaian Umum + Tugas Utama. Tidak Hadir = Tugas Pengganti + Tugas Utama (tanpa Penilaian Umum).' : 
                      'Hadir = Penilaian Umum. Tidak Hadir = Tidak mendapatkan nilai.') : 'Kehadiran belum ditetapkan.'
                  }
                </div>
              </div>

                <div class="attendance-btn-group" style="${['hrd_profesi', 'hrd_kepala', 'hrd_all', 'teknisi'].includes(App.currentUser?.role) ? '' : 'display:none;'}">
                <button 
                  type="button"
                  class="btn-attendance ${this.scores.is_absen === 0 ? 'active-hadir' : 'inactive-hadir'}"
                  onclick="FormProfesi.setAttendance(0)"
                >
                  <i class="fas fa-check"></i> Datang (Hadir)
                </button>
                <button 
                  type="button"
                  class="btn-attendance ${this.scores.is_absen === 1 ? 'active-absen' : 'inactive-absen'}"
                  onclick="FormProfesi.setAttendance(1)"
                >
                  <i class="fas fa-times"></i> Tidak Datang (Absen)
                </button>
              </div>
            </div>

            <!-- KONTEN FORM SESUAI SESI DAN STATUS KEHADIRAN -->
            ${this.renderFormContent(activeParticipant)}
          ` : '<div style="color: var(--text-dim); text-align: center; padding: 40px;">Pilih peserta di panel kiri.</div>'}
        </div>
      </div>
    `;
  },

  renderFormContent(activeParticipant) {
    if (!this.attendanceSet) {
      return `
        <div class="glass-card" style="text-align: center; padding: 28px; color: var(--text-muted);">
          Tetapkan kehadiran peserta sebelum mengisi penilaian.
        </div>
      `;
    }

    // ----------------------------------------------------
    // KASUS 1: KEPROF 3
    // ----------------------------------------------------
    if (this.selectedSession === 3) {
      if (this.scores.is_absen === 1) {
        return `
          <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: var(--radius-md); padding: 18px 20px; margin-top: 20px; display: flex; align-items: center; gap: 14px;">
            <i class="fas fa-times-circle" style="color: #f87171; font-size: 1.8rem; flex-shrink: 0;"></i>
            <div>
              <div style="font-weight: 700; font-size: 1rem; color: #fca5a5;">Peserta Tidak Hadir di Keprof 3</div>
              <div style="font-size: 0.85rem; color: #cbd5e1; margin-top: 4px; line-height: 1.5;">
                Sesuai aturan sistem, Keprof 3 hanya memiliki penilaian umum dan tidak ada tugas pengganti. Karena tidak hadir, peserta <strong>tidak mendapatkan nilai (Skor 0.0)</strong> pada sesi Keprof 3.
              </div>
            </div>
          </div>
        `;
      } else {
        return `
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 22px; display: flex; align-items: center; gap: 12px;">
            <i class="fas fa-check-circle" style="color: #6ee7b7; font-size: 1.2rem;"></i>
            <div>
              <div style="font-weight: 700; font-size: 0.88rem; color: #a7f3d0;">Peserta Hadir di Keprof 3</div>
              <div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 2px;">
                Keprof 3 hanya memiliki Penilaian Umum (tanpa penugasan). Silakan evaluasi 3 aspek berikut.
              </div>
            </div>
          </div>

          <div class="form-section-title">
            <i class="fas fa-clipboard-check" style="color: var(--secondary);"></i> Penilaian Umum Keprof 3
          </div>
          ${this.renderGeneralLikertFields()}

          <div style="margin-bottom: 24px;">
            <label style="font-weight: 600; font-size: 0.9rem; color: white; display: block; margin-bottom: 6px;">Catatan Penilaian Umum Keprof 3</label>
            <textarea class="search-input" style="width: 100%; height: 80px; resize: vertical;" placeholder="Tuliskan catatan atau umpan balik..." oninput="FormProfesi.scores.notes_umum = this.value">${this.scores.notes_umum}</textarea>
          </div>

          <button class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 1rem;" onclick="FormProfesi.submit()">
            <i class="fas fa-save"></i> Simpan Penilaian Keprof 3
          </button>
        `;
      }
    }

    // ----------------------------------------------------
    // KASUS 2: KEPROF 1 ATAU 2 - PESERTA HADIR
    // ----------------------------------------------------
    if (this.scores.is_absen === 0) {
      return `
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 22px; display: flex; align-items: center; gap: 12px;">
          <i class="fas fa-check-circle" style="color: #6ee7b7; font-size: 1.2rem;"></i>
          <div>
            <div style="font-weight: 700; font-size: 0.88rem; color: #a7f3d0;">Peserta Hadir di Kelas Profesi ${this.selectedSession}</div>
            <div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 2px;">
              Peserta dinilai pada: <strong>1. Penilaian Umum</strong> + <strong>2. Tugas Utama (Reguler)</strong>.
            </div>
          </div>
        </div>

        <!-- 1. Penilaian Umum -->
        <div class="form-section-title">
          <i class="fas fa-clipboard-check" style="color: var(--secondary);"></i> 1. Penilaian Umum Keprof ${this.selectedSession}
        </div>
        ${this.renderGeneralLikertFields()}

        <div style="margin-bottom: 24px;">
          <label style="font-weight: 600; font-size: 0.9rem; color: white; display: block; margin-bottom: 6px;">Catatan Penilaian Umum</label>
          <textarea class="search-input" style="width: 100%; height: 75px; resize: vertical;" placeholder="Tuliskan catatan umum..." oninput="FormProfesi.scores.notes_umum = this.value">${this.scores.notes_umum}</textarea>
        </div>

        <!-- 2. Kepatuhan Teknis Tugas Reguler / Utama -->
        <div class="form-section-title" style="margin-top: 28px;">
          <i class="fas fa-file-contract" style="color: var(--accent);"></i> 2. Kepatuhan Teknis — Tugas Utama / Reguler Keprof ${this.selectedSession}
        </div>
        <div class="likert-group">
          <div class="likert-label">Kepatuhan Teknis Tugas Utama (Format, Template, Hashtag & Ketepatan Waktu)</div>
          <div class="likert-desc">Evaluasi teknis pengumpulan tugas utama: ketepatan waktu deadline dan kepatuhan format/hashtag/durasi.</div>
          <div class="likert-options">
            ${this.renderLikertBtn('teknis_reguler', 1, 'Sangat tidak patuh')}
            ${this.renderLikertBtn('teknis_reguler', 2, 'Banyak pelanggaran')}
            ${this.renderLikertBtn('teknis_reguler', 3, 'Cukup patuh')}
            ${this.renderLikertBtn('teknis_reguler', 4, 'Patuh & tepat waktu')}
            ${this.renderLikertBtn('teknis_reguler', 5, 'Sempurna & teladan')}
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <label style="font-weight: 600; font-size: 0.9rem; color: white; display: block; margin-bottom: 6px;">Catatan Teknis Tugas Utama</label>
          <textarea class="search-input" style="width: 100%; height: 75px; resize: vertical;" placeholder="Catatan teknis tugas utama..." oninput="FormProfesi.scores.notes_reguler = this.value">${this.scores.notes_reguler}</textarea>
        </div>

        <button class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 1rem;" onclick="FormProfesi.submit()">
          <i class="fas fa-save"></i> Simpan Penilaian Hadir (Umum + Tugas Utama)
        </button>
      `;
    }

    // ----------------------------------------------------
    // KASUS 3: KEPROF 1 ATAU 2 - PESERTA TIDAK HADIR (ABSEN)
    // Aturan Khusus User: Tidak dapat form penilaian umum, melainkan 2 form khusus:
    // 1. Tugas Pengganti
    // 2. Tugas Utama
    // ----------------------------------------------------
    return `
      <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 22px; display: flex; align-items: center; gap: 14px;">
        <i class="fas fa-exclamation-triangle" style="color: #fde68a; font-size: 1.5rem; flex-shrink: 0;"></i>
        <div>
          <div style="font-weight: 700; font-size: 0.95rem; color: #fde68a;">Peserta Tidak Hadir (Absen) di Kelas Profesi ${this.selectedSession}</div>
          <div style="font-size: 0.82rem; color: #cbd5e1; margin-top: 3px; line-height: 1.45;">
            Sesuai aturan sistem: Peserta <strong>tidak mendapatkan form penilaian umum</strong>. Nilai penilaian umum digantikan oleh nilai <strong>Tugas Pengganti</strong>. Peserta tetap wajib dinilai pada <strong>Tugas Utama</strong>.
          </div>
        </div>
      </div>

      <!-- FORM 1: Kepatuhan Teknis Tugas Pengganti -->
      <div class="form-section-title" style="color: #fde68a; border-left: 4px solid #f59e0b; padding-left: 10px;">
        <i class="fas fa-file-signature" style="color: #fde68a;"></i> 1. Kepatuhan Teknis — Tugas Pengganti Keprof ${this.selectedSession}
      </div>
      <div class="likert-group">
        <div class="likert-label">Kepatuhan Teknis Tugas Pengganti (Format, Template & Deadline)</div>
        <div class="likert-desc">Evaluasi teknis pengumpulan tugas pengganti ketidakhadiran di kelas profesi.</div>
        <div class="likert-options">
          ${this.renderLikertBtn('teknis_pengganti', 1, 'Sangat tidak patuh')}
          ${this.renderLikertBtn('teknis_pengganti', 2, 'Banyak pelanggaran')}
          ${this.renderLikertBtn('teknis_pengganti', 3, 'Cukup patuh')}
          ${this.renderLikertBtn('teknis_pengganti', 4, 'Patuh & tepat waktu')}
          ${this.renderLikertBtn('teknis_pengganti', 5, 'Sempurna & teladan')}
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <label style="font-weight: 600; font-size: 0.9rem; color: white; display: block; margin-bottom: 6px;">Catatan Teknis Tugas Pengganti</label>
        <textarea class="search-input" style="width: 100%; height: 75px; resize: vertical;" placeholder="Tuliskan catatan teknis tugas pengganti..." oninput="FormProfesi.scores.notes_pengganti = this.value">${this.scores.notes_pengganti}</textarea>
      </div>

      <!-- FORM 2: Kepatuhan Teknis Tugas Utama (Reguler) -->
      <div class="form-section-title" style="color: #60a5fa; border-left: 4px solid #3b82f6; padding-left: 10px; margin-top: 30px;">
        <i class="fas fa-file-contract" style="color: #60a5fa;"></i> 2. Kepatuhan Teknis — Tugas Utama (Reguler) Keprof ${this.selectedSession}
      </div>
      <div class="likert-group">
        <div class="likert-label">Kepatuhan Teknis Tugas Utama (Format, Template, Hashtag & Ketepatan Waktu)</div>
        <div class="likert-desc">Meskipun tidak hadir, peserta tetap mengerjakan dan mengumpulkan tugas utama reguler.</div>
        <div class="likert-options">
          ${this.renderLikertBtn('teknis_reguler', 1, 'Sangat tidak patuh')}
          ${this.renderLikertBtn('teknis_reguler', 2, 'Banyak pelanggaran')}
          ${this.renderLikertBtn('teknis_reguler', 3, 'Cukup patuh')}
          ${this.renderLikertBtn('teknis_reguler', 4, 'Patuh & tepat waktu')}
          ${this.renderLikertBtn('teknis_reguler', 5, 'Sempurna & teladan')}
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <label style="font-weight: 600; font-size: 0.9rem; color: white; display: block; margin-bottom: 6px;">Catatan Teknis Tugas Utama</label>
        <textarea class="search-input" style="width: 100%; height: 75px; resize: vertical;" placeholder="Tuliskan catatan teknis tugas utama..." oninput="FormProfesi.scores.notes_reguler = this.value">${this.scores.notes_reguler}</textarea>
      </div>

      <button class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 1rem; background: linear-gradient(135deg, #d97706, #4f46e5);" onclick="FormProfesi.submit()">
        <i class="fas fa-save"></i> Simpan Penilaian Absen (Tugas Pengganti + Tugas Utama)
      </button>
    `;
  },

  renderGeneralLikertFields() {
    return `
      <!-- Kehadiran -->
      <div class="likert-group">
        <div class="likert-label">Kehadiran & Ketepatan Waktu</div>
        <div class="likert-desc">Evaluasi kedisiplinan waktu kehadiran di sesi Keprof ${this.selectedSession}.</div>
        <div class="likert-options">
          ${this.renderLikertBtn('kehadiran', 1, 'Terlambat >15m')}
          ${this.renderLikertBtn('kehadiran', 2, 'Terlambat 10-15m')}
          ${this.renderLikertBtn('kehadiran', 3, 'Terlambat 5-10m')}
          ${this.renderLikertBtn('kehadiran', 4, 'Tepat waktu')}
          ${this.renderLikertBtn('kehadiran', 5, 'Tepat waktu & siap')}
        </div>
      </div>

      <!-- Partisipasi -->
      <div class="likert-group">
        <div class="likert-label">Partisipasi & Keaktifan Diskusi</div>
        <div class="likert-desc">Keterlibatan aktif dalam tanya jawab dan diskusi materi kelas profesi.</div>
        <div class="likert-options">
          ${this.renderLikertBtn('partisipasi', 1, 'Pasif total')}
          ${this.renderLikertBtn('partisipasi', 2, 'Kurang aktif')}
          ${this.renderLikertBtn('partisipasi', 3, 'Cukup aktif')}
          ${this.renderLikertBtn('partisipasi', 4, 'Aktif & responsif')}
          ${this.renderLikertBtn('partisipasi', 5, 'Sangat aktif & kritis')}
        </div>
      </div>

      <!-- Sikap & Kedisiplinan -->
      <div class="likert-group">
        <div class="likert-label">Sikap & Kedisiplinan</div>
        <div class="likert-desc">Etika, kesopanan, kamera on/fokus, dan kepatuhan norma forum kelas.</div>
        <div class="likert-options">
          ${this.renderLikertBtn('sikap', 1, 'Tidak tertib')}
          ${this.renderLikertBtn('sikap', 2, 'Kurang disiplin')}
          ${this.renderLikertBtn('sikap', 3, 'Cukup tertib')}
          ${this.renderLikertBtn('sikap', 4, 'Disiplin & sopan')}
          ${this.renderLikertBtn('sikap', 5, 'Sangat profesional')}
        </div>
      </div>
    `;
  },

  renderLikertBtn(category, val, label) {
    const isSelected = this.scores[category] === val;
    return `
      <div class="likert-btn ${isSelected ? 'selected' : ''}" onclick="FormProfesi.setScore('${category}', ${val})">
        <span class="likert-num">${val}</span>
        <span class="likert-text">${label}</span>
      </div>
    `;
  },

  setScore(category, val) {
    this.scores[category] = val;
    this.render();
  },

  async setAttendance(isAbsen) {
    if (!this.selectedParticipantId) return;
    try {
      const res = await API.post('/api/eval/profesi-attendance', {
        participant_id: this.selectedParticipantId,
        keprof_session: this.selectedSession,
        is_absen: isAbsen
      });
      this.scores.is_absen = isAbsen;
      this.attendanceSet = true;
      showToast(res.message, 'info');
      await this.loadParticipantEvaluation();
    } catch (e) {
      console.error(e);
      showToast(e.message, 'error');
    }
    this.render();
  },

  toggleAbsen(checked) {
    this.setAttendance(checked ? 1 : 0);
  },

  async setSession(s) {
    this.selectedSession = s;
    await this.loadParticipantEvaluation();
    this.render();
  },

  setProfession(p) {
    this.selectedProf = p;
    this.loadParticipants().then(async () => {
      await this.loadParticipantEvaluation();
      this.render();
    });
  },

  onSearch(val, input) {
    this.searchQuery = val;
    this.render();
    const updatedInput = document.getElementById('profesi-participant-search');
    if (updatedInput) {
      updatedInput.focus();
      updatedInput.setSelectionRange(input.selectionStart, input.selectionEnd);
    }
  },

  async selectParticipant(id) {
    this.selectedParticipantId = id;
    const evaluationRequest = this.loadParticipantEvaluation();
    this.render();
    await evaluationRequest;
    this.render();
  },

  async submit() {
    if (!this.selectedParticipantId) return;
    if (!this.attendanceSet) {
      showToast('Tetapkan kehadiran peserta sebelum menyimpan penilaian.', 'warning');
      return;
    }
    try {
      if (this.selectedSession === 3) {
        if (this.scores.is_absen === 0) {
          await API.post('/api/eval/profesi-general', {
            participant_id: this.selectedParticipantId,
            keprof_session: 3,
            score_kehadiran: this.scores.kehadiran,
            score_partisipasi: this.scores.partisipasi,
            score_sikap: this.scores.sikap,
            is_absen: 0,
            notes: this.scores.notes_umum
          });
          showToast('Penilaian Umum Keprof 3 berhasil disimpan!', 'success');
        } else {
          showToast('Peserta tercatat tidak hadir pada Keprof 3 (Skor 0).', 'info');
        }
      } else {
        // Keprof 1 atau 2
        if (this.scores.is_absen === 0) {
          // Hadir: Penilaian Umum + Tugas Utama
          await API.post('/api/eval/profesi-general', {
            participant_id: this.selectedParticipantId,
            keprof_session: this.selectedSession,
            score_kehadiran: this.scores.kehadiran,
            score_partisipasi: this.scores.partisipasi,
            score_sikap: this.scores.sikap,
            is_absen: 0,
            notes: this.scores.notes_umum
          });

          await API.post('/api/eval/profesi-task', {
            participant_id: this.selectedParticipantId,
            keprof_session: this.selectedSession,
            is_replacement: 0,
            score_teknis: this.scores.teknis_reguler,
            task_notes: this.scores.notes_reguler
          });

          showToast(`Penilaian Keprof ${this.selectedSession} (Umum & Tugas Utama) berhasil disimpan!`, 'success');
        } else {
          // Tidak Hadir: Tugas Pengganti + Tugas Utama (tanpa Penilaian Umum)
          await API.post('/api/eval/profesi-task', {
            participant_id: this.selectedParticipantId,
            keprof_session: this.selectedSession,
            is_replacement: 1,
            score_teknis: this.scores.teknis_pengganti,
            task_notes: this.scores.notes_pengganti
          });

          await API.post('/api/eval/profesi-task', {
            participant_id: this.selectedParticipantId,
            keprof_session: this.selectedSession,
            is_replacement: 0,
            score_teknis: this.scores.teknis_reguler,
            task_notes: this.scores.notes_reguler
          });

          showToast(`Penilaian Keprof ${this.selectedSession} (Tugas Pengganti & Tugas Utama) berhasil disimpan!`, 'success');
        }
      }

      await this.loadParticipantEvaluation();
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
