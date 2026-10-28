// Form Peer Review Module for Peserta Korpus Institute
// Authenticated participant review with strict confidentiality

const FormPeer = {
  selectedGroup: null,
  selectedParticipantId: null,
  teammates: [],
  activeTeammateIndex: 0,

  // Current evaluation scores
  scores: {
    kehadiran: 5,
    partisipasi: 5,
    sikap: 5,
    notes: ''
  },
  submittedTeammates: new Set(),

  async init() {
    const user = App.currentUser;
    if (!user || user.role !== 'peserta' || !user.participant_id) {
      App.navigate('gateway');
      return;
    }
    this.selectedGroup = user.assigned_group;
    this.selectedParticipantId = user.participant_id;
    await this.loadTeammates();
    this.render();
  },

  async loadTeammates() {
    try {
      // Fetch members in group excluding self
      const res = await API.get(`/api/eval/participants?group=${encodeURIComponent(this.selectedGroup)}`);
      this.teammates = (res.participants || []).filter(p => p.id !== this.selectedParticipantId);
      
      // Load already submitted ratings for this peer
      const myEvals = await API.get('/api/eval/tabmin-member/my-evaluations');
      this.submittedTeammates = new Set((myEvals.evaluations || []).map(e => e.participant_id));
    } catch (err) {
      console.error(err);
    }
  },

  render() {
    const container = document.getElementById('view-content');
    if (!container) return;

    this.renderEvaluationForm(container);
  },

  renderEvaluationForm(container) {
    const user = App.currentUser;
    const currentTeammate = this.teammates[this.activeTeammateIndex];
    const isSubmitted = currentTeammate ? this.submittedTeammates.has(currentTeammate.id) : false;

    container.innerHTML = `
      <div class="glass-card" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <div>
            <span class="badge badge-group" style="font-size: 0.82rem;">${this.selectedGroup}</span>
            <h2 style="font-size: 1.35rem; color: white; margin-top: 4px;">
              Peer Review: <span style="color: #a5b4fc;">${user.full_name}</span>
            </h2>
            <p style="color: var(--text-muted); font-size: 0.82rem;">
              Berikan penilaian jujur dan membangun untuk rekan-rekan satu kelompok Tabmin Anda.
            </p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.8rem; color: var(--text-muted);">Progres Penilaian Rekan:</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #34d399;">
              ${this.submittedTeammates.size} / ${this.teammates.length}
            </div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 300px 1fr; gap: 24px;">
        <!-- Left Teammates List -->
        <div class="glass-card" style="height: fit-content;">
          <h4 style="color: #cbd5e1; font-size: 0.95rem; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
            Daftar Rekan Se-Kelompok (${this.teammates.length})
          </h4>
          <div style="max-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
            ${this.teammates.map((t, idx) => {
              const done = this.submittedTeammates.has(t.id);
              const isSelected = idx === this.activeTeammateIndex;
              return `
                <div 
                  style="padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition); border: 1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}; background: ${isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.02)'}; display: flex; justify-content: space-between; align-items: center;"
                  onclick="FormPeer.selectTeammateIndex(${idx})"
                >
                  <div>
                    <div style="font-weight: 600; font-size: 0.88rem; color: white;">${t.name}</div>
                    <span class="badge badge-profesi" style="font-size: 0.65rem; margin-top: 2px;">${t.profession}</span>
                  </div>
                  ${done ? '<i class="fas fa-check-circle" style="color: #34d399; font-size: 1rem;"></i>' : '<span style="font-size: 0.7rem; color: var(--text-dim);">Belum</span>'}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Right Evaluation Form -->
        <div class="glass-card">
          ${currentTeammate ? `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 20px;">
              <div>
                <span class="badge badge-profesi">${currentTeammate.profession}</span>
                <h3 style="font-size: 1.4rem; color: white; margin-top: 4px;">${currentTeammate.name}</h3>
              </div>
              ${isSubmitted ? `
                <span class="badge badge-success" style="padding: 6px 14px; font-size: 0.85rem;">
                  <i class="fas fa-check"></i> Sudah Dinilai
                </span>
              ` : `
                <span class="badge badge-warning" style="padding: 6px 14px; font-size: 0.85rem;">
                  Belum Dinilai
                </span>
              `}
            </div>

            <!-- Kehadiran -->
            <div class="likert-group">
              <div class="likert-label">1. Kehadiran & Ketepatan Waktu</div>
              <div class="likert-desc">Bagaimana kedisiplinan waktu kehadiran rekan Anda saat diskusi kelompok?</div>
              <div class="likert-options">
                ${this.renderLikertBtn('kehadiran', 1, 'Sering terlambat')}
                ${this.renderLikertBtn('kehadiran', 2, 'Kurang tepat waktu')}
                ${this.renderLikertBtn('kehadiran', 3, 'Cukup tertib')}
                ${this.renderLikertBtn('kehadiran', 4, 'Tepat waktu')}
                ${this.renderLikertBtn('kehadiran', 5, 'Sangat tepat & siap')}
              </div>
            </div>

            <!-- Partisipasi -->
            <div class="likert-group">
              <div class="likert-label">2. Partisipasi & Keaktifan Kerjasama</div>
              <div class="likert-desc">Seberapa aktif rekan Anda memberikan kontribusi tugas dan proaktif berdiskusi?</div>
              <div class="likert-options">
                ${this.renderLikertBtn('partisipasi', 1, 'Pasif / menghilang')}
                ${this.renderLikertBtn('partisipasi', 2, 'Kurang berkontribusi')}
                ${this.renderLikertBtn('partisipasi', 3, 'Cukup membantu')}
                ${this.renderLikertBtn('partisipasi', 4, 'Aktif & kooperatif')}
                ${this.renderLikertBtn('partisipasi', 5, 'Sangat inisiatif')}
              </div>
            </div>

            <!-- Sikap -->
            <div class="likert-group">
              <div class="likert-label">3. Sikap, Komunikasi & Kedisiplinan</div>
              <div class="likert-desc">Sopan santun, keterbukaan komunikasi, dan tanggung jawab terhadap pembagian tugas.</div>
              <div class="likert-options">
                ${this.renderLikertBtn('sikap', 1, 'Kurang menyenangkan')}
                ${this.renderLikertBtn('sikap', 2, 'Kurang komunikatif')}
                ${this.renderLikertBtn('sikap', 3, 'Cukup baik')}
                ${this.renderLikertBtn('sikap', 4, 'Ramah & tanggung jawab')}
                ${this.renderLikertBtn('sikap', 5, 'Sangat menyenangkan & suportif')}
              </div>
            </div>

            <!-- Notes -->
            <div style="margin-bottom: 24px;">
              <label style="font-weight: 600; font-size: 0.9rem; color: white; display: block; margin-bottom: 6px;">Pesan / Feedback Positif untuk Rekan (Opsional)</label>
              <textarea class="search-input" style="width: 100%; height: 75px; resize: vertical;" placeholder="Tuliskan apresiasi atau masukan yang membangun..." oninput="FormPeer.scores.notes = this.value">${this.scores.notes}</textarea>
            </div>

            <div style="display: flex; gap: 12px;">
              <button class="btn btn-primary" style="flex: 1; padding: 14px; font-size: 1rem;" onclick="FormPeer.submitPeerRating()">
                <i class="fas fa-paper-plane"></i> Kirim Ulasan untuk ${currentTeammate.name}
              </button>
              ${this.activeTeammateIndex < this.teammates.length - 1 ? `
                <button class="btn btn-secondary" onclick="FormPeer.nextTeammate()">
                  Lanjut ke Rekan Berikutnya <i class="fas fa-arrow-right"></i>
                </button>
              ` : ''}
            </div>
          ` : '<div style="color: var(--text-dim); text-align: center; padding: 40px;">Semua rekan telah dinilai.</div>'}
        </div>
      </div>
    `;
  },

  renderLikertBtn(category, val, label) {
    const isSelected = this.scores[category] === val;
    return `
      <div class="likert-btn ${isSelected ? 'selected' : ''}" onclick="FormPeer.setScore('${category}', ${val})">
        <span class="likert-num">${val}</span>
        <span class="likert-text">${label}</span>
      </div>
    `;
  },

  setScore(category, val) {
    this.scores[category] = val;
    this.render();
  },

  selectTeammateIndex(idx) {
    this.activeTeammateIndex = idx;
    this.scores = { kehadiran: 5, partisipasi: 5, sikap: 5, notes: '' };
    this.render();
  },

  nextTeammate() {
    if (this.activeTeammateIndex < this.teammates.length - 1) {
      this.activeTeammateIndex += 1;
      this.scores = { kehadiran: 5, partisipasi: 5, sikap: 5, notes: '' };
      this.render();
    }
  },

  async submitPeerRating() {
    const currentTeammate = this.teammates[this.activeTeammateIndex];
    if (!currentTeammate) return;

    try {
      await API.post('/api/eval/tabmin-member', {
        participant_id: currentTeammate.id,
        score_kehadiran: this.scores.kehadiran,
        score_partisipasi: this.scores.partisipasi,
        score_sikap: this.scores.sikap,
        notes: this.scores.notes
      });

      this.submittedTeammates.add(currentTeammate.id);
      showToast(`Penilaian untuk ${currentTeammate.name} berhasil disimpan!`, 'success');

      // Auto advance to next unsubmitted teammate if available
      const nextIdx = this.teammates.findIndex((t, i) => i > this.activeTeammateIndex && !this.submittedTeammates.has(t.id));
      if (nextIdx !== -1) {
        this.selectTeammateIndex(nextIdx);
      } else {
        this.render();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
