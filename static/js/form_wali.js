// Form Wali Kelas Module
// Strictly isolated: only inputs Penilaian Isi for Tasks of their assigned profession
// Attendance rule: Attendance is read-only (managed by HRD Profesi)
// If student is Hadir: only Tugas Utama (Reguler) is evaluated
// If student is Absen: BOTH Tugas Pengganti AND Tugas Utama are evaluated

const FormWali = {
  selectedSession: 1,
  selectedParticipantId: null,
  tasks: [],
  searchQuery: '',

  // Form State
  scoreIsiReg: 5,
  notesReg: '',
  scoreIsiRep: 5,
  notesRep: '',

  async init() {
    await this.loadTasks();
    this.render();
  },

  async loadTasks() {
    try {
      const res = await API.get(`/api/eval/profesi-task/my-view?session=${this.selectedSession}`);
      this.tasks = res.tasks || [];
      if (this.tasks.length && !this.selectedParticipantId) {
        this.selectedParticipantId = this.tasks[0].participant_id;
        this.syncActiveTask();
      } else if (this.selectedParticipantId) {
        this.syncActiveTask();
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat tugas: ' + err.message, 'error');
    }
  },

  syncActiveTask() {
    const active = this.tasks.find(t => t.participant_id === this.selectedParticipantId);
    if (active) {
      this.scoreIsiReg = active.score_isi_reg || 5;
      this.notesReg = active.notes_reg || '';
      this.scoreIsiRep = active.score_isi_rep || 5;
      this.notesRep = active.notes_rep || '';
    }
  },

  render() {
    const container = document.getElementById('view-content');
    if (!container) return;

    const user = App.currentUser || {};
    const assignedProf = user.assigned_profession || 'Semua';

    const filtered = this.tasks.filter(t => !this.searchQuery || t.name.toLowerCase().includes(this.searchQuery.toLowerCase()));
    const active = this.tasks.find(t => t.participant_id === this.selectedParticipantId) || filtered[0];
    if (active && active.participant_id !== this.selectedParticipantId) {
      this.selectedParticipantId = active.participant_id;
      this.syncActiveTask();
    }

    const isStudentAttended = active ? (active.is_absen === 0) : true;

    container.innerHTML = `
      <!-- Header Banner with Wali Kelas Constraint Info -->
      <div class="glass-card" style="margin-bottom: 24px; border: 1px solid rgba(245, 158, 11, 0.25);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h2 style="font-size: 1.4rem; color: white;">
                <i class="fas fa-chalkboard-teacher" style="color: var(--warning);"></i> 
                Form Penilaian Wali Kelas ${assignedProf !== 'ALL' && assignedProf !== 'Semua' ? '— Divisi ' + assignedProf : ''}
              </h2>
              <span class="badge badge-warning" style="font-size: 0.75rem;">Isolasi Divisi Aktif</span>
            </div>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">
              Wali Kelas: <strong style="color: white;">${user.full_name || 'Wali Kelas'}</strong>. 
              Sesuai ketentuan, Anda hanya dapat mengakses dan menilai peserta dari divisi <strong style="color: #fde68a;">${assignedProf}</strong>.
            </p>
          </div>
          
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <!-- Session Switcher (Keprof 1 vs 2) -->
            <div style="display: flex; gap: 6px;">
              <button class="btn ${this.selectedSession === 1 ? 'btn-primary' : 'btn-secondary'}" onclick="FormWali.setSession(1)">
                <i class="fas fa-book-open"></i> Keprof 1
              </button>
              <button class="btn ${this.selectedSession === 2 ? 'btn-primary' : 'btn-secondary'}" onclick="FormWali.setSession(2)">
                <i class="fas fa-book-open"></i> Keprof 2
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 320px 1fr; gap: 24px;">
        <!-- Left: Participant List (Strictly Isolated by Profession) -->
        <div class="glass-card" style="height: fit-content;">
          <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 0.82rem; font-weight: 700; color: white;">
              Daftar Peserta Divisi ${assignedProf}:
            </label>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${filtered.length} peserta</span>
          </div>

          <div style="margin-bottom: 14px;">
            <input 
              type="text" 
              class="search-input" 
              style="width: 100%;" 
              placeholder="Cari nama peserta..." 
              value="${this.searchQuery}" 
              oninput="FormWali.onSearch(this.value)"
            >
          </div>

          <div style="max-height: 520px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px;">
            ${filtered.map(t => {
              const attended = (t.is_absen === 0);
              const isSelected = t.participant_id === this.selectedParticipantId;
              let scoreBadge = '';
              if (attended) {
                scoreBadge = t.score_isi_reg ? `<span class="badge badge-success" style="font-size: 0.65rem;">Utama: ${t.score_isi_reg}</span>` : '<span class="badge badge-warning" style="font-size: 0.65rem;">Belum</span>';
              } else {
                const hasRep = t.score_isi_rep ? `Ganti: ${t.score_isi_rep}` : 'Ganti: -';
                const hasReg = t.score_isi_reg ? `Utama: ${t.score_isi_reg}` : 'Utama: -';
                scoreBadge = `<span class="badge badge-warning" style="font-size: 0.62rem;">${hasRep} | ${hasReg}</span>`;
              }

              return `
                <div 
                  style="padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition); border: 1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}; background: ${isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.02)'};"
                  onclick="FormWali.selectParticipant(${t.participant_id})"
                >
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600; font-size: 0.88rem; color: white;">${t.name}</span>
                    ${scoreBadge}
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <span class="badge badge-group" style="font-size: 0.68rem;">${t.tabmin_group}</span>
                    <span style="font-size: 0.68rem; color: ${attended ? '#6ee7b7' : '#fca5a5'};">
                      <i class="fas ${attended ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${attended ? 'Hadir' : 'Absen'}
                    </span>
                  </div>
                </div>
              `;
            }).join('') || `<div style="color: var(--text-dim); text-align: center; padding: 20px;">Tidak ada peserta divisi ${assignedProf}.</div>`}
          </div>
        </div>

        <!-- Right: Scoring Form with Attendance Conditionality -->
        <div class="glass-card">
          ${active ? `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 20px;">
              <div>
                <span class="badge badge-profesi">${active.profession}</span>
                <span class="badge badge-group">${active.tabmin_group}</span>
                <h3 style="font-size: 1.35rem; color: white; margin-top: 6px;">${active.name}</h3>
              </div>
              <span class="badge badge-warning" style="font-size: 0.85rem; padding: 6px 14px;">
                Keprof ${this.selectedSession}
              </span>
            </div>

            <!-- Status Kehadiran (Read-Only untuk Wali Kelas) -->
            <div class="attendance-toggle-card" style="border: 1px solid rgba(${isStudentAttended ? '16, 185, 129' : '245, 158, 11'}, 0.35); margin-bottom: 20px;">
              <div>
                <div style="font-weight: 700; font-size: 0.9rem; color: white; display: flex; align-items: center; gap: 8px;">
                  <i class="fas fa-calendar-check" style="color: ${isStudentAttended ? '#6ee7b7' : '#fde68a'};"></i>
                  Status Kehadiran Kelas Profesi ${this.selectedSession}:
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 3px;">
                  Status kehadiran ditentukan oleh HRD Profesi (Read-Only bagi Wali Kelas).
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                <span style="padding: 6px 14px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; background: ${isStudentAttended ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; color: ${isStudentAttended ? '#6ee7b7' : '#fde68a'}; border: 1px solid ${isStudentAttended ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}; display: flex; align-items: center; gap: 6px;">
                  <i class="fas ${isStudentAttended ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                  ${isStudentAttended ? 'Datang (Hadir)' : 'Tidak Datang (Absen)'}
                </span>
              </div>
            </div>

            <!-- KONDISIONAL FORM PENILAIAN ISI -->
            ${isStudentAttended ? `
              <!-- Status: HADIR -> Form Tugas Utama / Reguler Saja -->
              <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 22px; display: flex; align-items: center; gap: 12px;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(16, 185, 129, 0.25); display: flex; align-items: center; justify-content: center; color: #6ee7b7; flex-shrink: 0;">
                  <i class="fas fa-check-double"></i>
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 0.88rem; color: #a7f3d0;">
                    Peserta Hadir di Kelas Profesi ${this.selectedSession}
                  </div>
                  <div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 2px;">
                    Peserta mengerjakan <strong>Tugas Reguler / Utama</strong>. Form tugas pengganti <strong>tidak tersedia</strong> karena peserta hadir.
                  </div>
                </div>
              </div>

              <div class="form-section-title">
                <i class="fas fa-feather-alt" style="color: var(--primary);"></i> Form Penilaian Isi — Tugas Utama Keprof ${this.selectedSession}
              </div>

              <!-- Likert Group: Penilaian Isi Tugas Reguler -->
              <div class="likert-group">
                <div class="likert-label">
                  Penilaian Isi & Substansi Materi Tugas Utama (Skala 1 - 5)
                </div>
                <div class="likert-desc">
                  Evaluasi kedalaman materi, orisinalitas, relevansi materi kelas, dan pemahaman konsep tugas utama.
                </div>
                <div class="likert-options">
                  ${this.renderLikertBtn('reg', 1, 'Sangat kurang')}
                  ${this.renderLikertBtn('reg', 2, 'Kurang mendalam')}
                  ${this.renderLikertBtn('reg', 3, 'Cukup baik')}
                  ${this.renderLikertBtn('reg', 4, 'Mendalam & terstruktur')}
                  ${this.renderLikertBtn('reg', 5, 'Sangat kreatif & teladan')}
                </div>
              </div>

              <!-- Catatan Kualitatif Tugas Utama -->
              <div style="margin-bottom: 24px;">
                <label style="font-weight: 600; font-size: 0.9rem; color: white; display: block; margin-bottom: 6px;">
                  Catatan & Masukan Wali Kelas (Tugas Utama)
                </label>
                <textarea 
                  class="search-input" 
                  style="width: 100%; height: 85px; resize: vertical;" 
                  placeholder="Tuliskan catatan kualitatif untuk tugas utama..." 
                  oninput="FormWali.notesReg = this.value"
                >${this.notesReg}</textarea>
              </div>

              <button class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 1rem; font-weight: 700;" onclick="FormWali.submit()">
                <i class="fas fa-save"></i> Simpan Penilaian Isi Tugas Utama (${active.name})
              </button>
            ` : `
              <!-- Status: TIDAK HADIR (ABSEN) -> Ada 2 Form: Tugas Pengganti + Tugas Utama -->
              <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 22px; display: flex; align-items: center; gap: 14px;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(245, 158, 11, 0.25); display: flex; align-items: center; justify-content: center; color: #fde68a; flex-shrink: 0;">
                  <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 0.92rem; color: #fde68a;">
                    Peserta Tidak Datang (Absen) di Kelas Profesi ${this.selectedSession}
                  </div>
                  <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 3px; line-height: 1.45;">
                    Sesuai aturan sistem, peserta absen mengerjakan <strong>Tugas Pengganti</strong> DAN tetap mengerjakan <strong>Tugas Utama</strong>. Silakan isi penilaian isi untuk kedua penugasan di bawah ini.
                  </div>
                </div>
              </div>

              <!-- SECTION 1: Form Penilaian Isi Tugas Pengganti -->
              <div class="form-section-title" style="color: #fde68a; border-left: 4px solid #f59e0b; padding-left: 10px;">
                <i class="fas fa-file-alt" style="color: #fde68a;"></i> 1. Penilaian Isi — Tugas Pengganti Keprof ${this.selectedSession}
              </div>

              <div class="likert-group">
                <div class="likert-label">
                  Penilaian Isi & Substansi Materi Tugas Pengganti (Skala 1 - 5)
                </div>
                <div class="likert-desc">
                  Evaluasi substansi isi materi tugas pengganti yang dikumpulkan atas ketidakhadiran di sesi kelas profesi.
                </div>
                <div class="likert-options">
                  ${this.renderLikertBtn('rep', 1, 'Sangat kurang')}
                  ${this.renderLikertBtn('rep', 2, 'Kurang mendalam')}
                  ${this.renderLikertBtn('rep', 3, 'Cukup baik')}
                  ${this.renderLikertBtn('rep', 4, 'Mendalam & terstruktur')}
                  ${this.renderLikertBtn('rep', 5, 'Sangat kreatif & teladan')}
                </div>
              </div>

              <div style="margin-bottom: 24px;">
                <label style="font-weight: 600; font-size: 0.9rem; color: white; display: block; margin-bottom: 6px;">
                  Catatan Penilaian Isi Tugas Pengganti
                </label>
                <textarea 
                  class="search-input" 
                  style="width: 100%; height: 75px; resize: vertical;" 
                  placeholder="Catatan untuk tugas pengganti..." 
                  oninput="FormWali.notesRep = this.value"
                >${this.notesRep}</textarea>
              </div>

              <!-- SECTION 2: Form Penilaian Isi Tugas Utama (Reguler) -->
              <div class="form-section-title" style="color: #60a5fa; border-left: 4px solid #3b82f6; padding-left: 10px; margin-top: 28px;">
                <i class="fas fa-feather-alt" style="color: #60a5fa;"></i> 2. Penilaian Isi — Tugas Utama (Reguler) Keprof ${this.selectedSession}
              </div>

              <div class="likert-group">
                <div class="likert-label">
                  Penilaian Isi & Substansi Materi Tugas Utama (Skala 1 - 5)
                </div>
                <div class="likert-desc">
                  Meskipun tidak hadir, peserta tetap mengerjakan tugas utama kelas profesi. Evaluasi kualitas materinya.
                </div>
                <div class="likert-options">
                  ${this.renderLikertBtn('reg', 1, 'Sangat kurang')}
                  ${this.renderLikertBtn('reg', 2, 'Kurang mendalam')}
                  ${this.renderLikertBtn('reg', 3, 'Cukup baik')}
                  ${this.renderLikertBtn('reg', 4, 'Mendalam & terstruktur')}
                  ${this.renderLikertBtn('reg', 5, 'Sangat kreatif & teladan')}
                </div>
              </div>

              <div style="margin-bottom: 24px;">
                <label style="font-weight: 600; font-size: 0.9rem; color: white; display: block; margin-bottom: 6px;">
                  Catatan Penilaian Isi Tugas Utama
                </label>
                <textarea 
                  class="search-input" 
                  style="width: 100%; height: 75px; resize: vertical;" 
                  placeholder="Catatan untuk tugas utama..." 
                  oninput="FormWali.notesReg = this.value"
                >${this.notesReg}</textarea>
              </div>

              <button class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 1rem; font-weight: 700; background: linear-gradient(135deg, #d97706, #4f46e5);" onclick="FormWali.submit()">
                <i class="fas fa-save"></i> Simpan Penilaian Isi (Tugas Pengganti & Tugas Utama)
              </button>
            `}
          ` : '<div style="color: var(--text-dim); text-align: center; padding: 40px;">Pilih peserta di panel kiri.</div>'}
        </div>
      </div>
    `;
  },

  renderLikertBtn(targetType, val, label) {
    const currentVal = targetType === 'rep' ? this.scoreIsiRep : this.scoreIsiReg;
    const isSelected = currentVal === val;
    return `
      <div class="likert-btn ${isSelected ? 'selected' : ''}" onclick="FormWali.setScore('${targetType}', ${val})">
        <span class="likert-num">${val}</span>
        <span class="likert-text">${label}</span>
      </div>
    `;
  },

  setScore(targetType, val) {
    if (targetType === 'rep') {
      this.scoreIsiRep = val;
    } else {
      this.scoreIsiReg = val;
    }
    this.render();
  },

  setSession(s) {
    this.selectedSession = s;
    this.loadTasks().then(() => this.render());
  },

  onSearch(val) {
    this.searchQuery = val;
    this.render();
  },

  selectParticipant(id) {
    this.selectedParticipantId = id;
    this.syncActiveTask();
    this.render();
  },

  async submit() {
    if (!this.selectedParticipantId) return;
    const active = this.tasks.find(t => t.participant_id === this.selectedParticipantId);
    if (!active) return;

    try {
      if (active.is_absen === 0) {
        // Hadir: Simpan penilaian isi tugas reguler saja
        await API.post('/api/eval/profesi-task', {
          participant_id: this.selectedParticipantId,
          keprof_session: this.selectedSession,
          is_replacement: 0,
          score_isi: this.scoreIsiReg,
          task_notes: this.notesReg
        });
        showToast(`Penilaian Isi Tugas Utama untuk ${active.name} berhasil disimpan!`, 'success');
      } else {
        // Absen: Simpan penilaian isi tugas pengganti DAN tugas reguler
        await API.post('/api/eval/profesi-task', {
          participant_id: this.selectedParticipantId,
          keprof_session: this.selectedSession,
          is_replacement: 1,
          score_isi: this.scoreIsiRep,
          task_notes: this.notesRep
        });

        await API.post('/api/eval/profesi-task', {
          participant_id: this.selectedParticipantId,
          keprof_session: this.selectedSession,
          is_replacement: 0,
          score_isi: this.scoreIsiReg,
          task_notes: this.notesReg
        });

        showToast(`Penilaian Isi (Tugas Pengganti & Tugas Utama) untuk ${active.name} berhasil disimpan!`, 'success');
      }

      await this.loadTasks();
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
