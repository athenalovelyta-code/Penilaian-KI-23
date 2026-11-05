// Form Tabmin Module for HRD Kelompok & PJK
// Evaluates Tabmin members (3 indicators) and Tabmin products (5 profession aspects)

const FormTabmin = {
  activeSubTab: 'member', // 'member' or 'product'
  selectedGroup: 'Kelompok 1',
  selectedParticipantId: null,
  participants: [],
  searchQuery: '',
  savingMember: false,
  savingProduct: false,

  // Member scores
  memberScores: {
    kehadiran: 5,
    partisipasi: 5,
    sikap: 5,
    notes: ''
  },

  // Product scores (HRD only)
  productScores: {
    reporter: 5,
    fotografer: 5,
    ilustrator: 5,
    layouter: 5,
    marcomm: 5,
    notes: ''
  },

  async init() {
    const user = App.currentUser;
    if (user.role === 'pjk') {
      this.selectedGroup = user.assigned_group || 'Kelompok 1';
      this.activeSubTab = 'member';
    } else if (['hrd_kelompok', 'hrd_kelompok_ketua', 'hrd_all'].includes(user.role) && user.assigned_group) {
      // HRD Kelompok is isolated to their assigned group
      this.selectedGroup = user.assigned_group;
    }
    await this.loadParticipants();
    if (this.activeSubTab === 'product') {
      await this.loadProductScore();
    } else if (this.selectedParticipantId) {
      await this.loadMemberScore(this.selectedParticipantId);
    }
    this.render();
  },

  async loadParticipants() {
    try {
      const res = await API.get(`/api/eval/participants?group=${encodeURIComponent(this.selectedGroup)}`);
      this.participants = res.participants || [];
      if (!this.participants.some(p => p.id === this.selectedParticipantId)) {
        this.selectedParticipantId = this.participants[0]?.id || null;
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat peserta kelompok: ' + err.message, 'error');
    }
  },

  async loadMemberScore(participantId) {
    this.memberScores = {
      kehadiran: 5,
      partisipasi: 5,
      sikap: 5,
      notes: ''
    };

    if (!participantId) return;

    try {
      const res = await API.get('/api/eval/tabmin-member/my-evaluations');
      if (this.selectedParticipantId !== participantId) return;

      const role = App.currentUser.role;
      const evaluatorRole = ['hrd_kelompok', 'hrd_kelompok_ketua', 'hrd_kepala', 'hrd_all', 'teknisi'].includes(role)
        ? 'hrd'
        : (role === 'pjk' ? 'pjk' : 'peer');
      const evaluation = (res.evaluations || []).find(item =>
        item.participant_id === participantId && item.evaluator_role === evaluatorRole
      );

      if (evaluation) {
        this.memberScores = {
          kehadiran: evaluation.score_kehadiran,
          partisipasi: evaluation.score_partisipasi,
          sikap: evaluation.score_sikap,
          notes: evaluation.notes || ''
        };
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat penilaian anggota: ' + err.message, 'error');
    }
  },

  async loadProductScore() {
    const group = this.selectedGroup;
    this.productScores = {
      reporter: 5,
      fotografer: 5,
      ilustrator: 5,
      layouter: 5,
      marcomm: 5,
      notes: ''
    };

    try {
      const res = await API.get('/api/eval/tabmin-product');
      if (this.selectedGroup !== group) return;

      const evaluatorName = App.currentUser.full_name || App.currentUser.username;
      const prod = (res.products || []).find(p =>
        p.tabmin_group === group && p.evaluator_name === evaluatorName
      );
      if (prod) {
        this.productScores = {
          reporter: prod.score_reporter,
          fotografer: prod.score_fotografer,
          ilustrator: prod.score_ilustrator,
          layouter: prod.score_layouter,
          marcomm: prod.score_marcomm,
          notes: prod.notes || ''
        };
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat penilaian produk: ' + err.message, 'error');
    }
  },

  render() {
    const container = document.getElementById('view-content');
    if (!container) return;
    const user = App.currentUser;
    const isPJK = user.role === 'pjk';

    container.innerHTML = `
      <div class="glass-card" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <div>
            <h2 style="font-size: 1.4rem; color: white;">
              <i class="fas fa-users-cog" style="color: var(--secondary);"></i> 
              Form Penilaian ${isPJK ? 'PJK (' + user.assigned_group + ')' : (user.role === 'hrd_kelompok_ketua' ? 'HRD Kelompok (Ketua)' : (user.role === 'hrd_all' ? 'HRD Kelompok & Profesi' : 'HRD Kelompok'))}
            </h2>
            <p style="color: var(--text-muted); font-size: 0.85rem;">
              ${isPJK ? 'Penilaian anggota kelompok Tabmin yang menjadi tanggung jawab Anda.' : (user.role === 'hrd_kelompok_ketua' ? 'Penilaian anggota kelompok & produk karya Tabmin 1-6 (Ketua HRD Kelompok).' : (user.role === 'hrd_all' ? `Penilaian anggota dari ${user.assigned_group} atau profesi ${user.assigned_profession}.` : 'Penilaian anggota kelompok dan produk hasil karya Tabmin 1-6.'))}
            </p>
          </div>

          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <!-- Group Picker (Disabled for PJK and HRD Kelompok with assigned group) -->
            ${(isPJK || (['hrd_kelompok', 'hrd_kelompok_ketua', 'hrd_all'].includes(user.role) && user.assigned_group)) ? `
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge badge-group" style="font-size: 0.9rem; padding: 8px 16px;">${this.selectedGroup}</span>
                ${!isPJK ? `<span style="font-size: 0.72rem; color: var(--text-dim);"><i class="fas fa-lock"></i> ${user.role === 'hrd_all' ? 'Kelompok + Profesi' : 'Isolasi Kelompok'}</span>` : ''}
              </div>
            ` : `
              <select class="custom-select" onchange="FormTabmin.setGroup(this.value)">
                ${['Kelompok 1', 'Kelompok 2', 'Kelompok 3', 'Kelompok 4', 'Kelompok 5', 'Kelompok 6'].map(g => `
                  <option value="${g}" ${this.selectedGroup === g ? 'selected' : ''}>${g}</option>
                `).join('')}
              </select>
            `}

            <!-- Sub tabs (Product evaluation only for HRD) -->
            ${!isPJK ? `
              <div style="display: flex; gap: 6px;">
                <button class="btn ${this.activeSubTab === 'member' ? 'btn-primary' : 'btn-secondary'}" onclick="FormTabmin.setSubTab('member')">
                  <i class="fas fa-user-check"></i> Anggota
                </button>
                <button class="btn ${this.activeSubTab === 'product' ? 'btn-primary' : 'btn-secondary'}" onclick="FormTabmin.setSubTab('product')">
                  <i class="fas fa-box-open"></i> Produk Karya
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${this.activeSubTab === 'member' ? this.renderMemberView() : this.renderProductView()}
    `;
  },

  renderMemberView() {
    const filtered = this.participants.filter(p => !this.searchQuery || p.name.toLowerCase().includes(this.searchQuery.toLowerCase()));
    const active = this.participants.find(p => p.id === this.selectedParticipantId) || filtered[0];
    if (active && active.id !== this.selectedParticipantId) {
      this.selectedParticipantId = active.id;
    }

    return `
      <div style="display: grid; grid-template-columns: 320px 1fr; gap: 24px;">
        <!-- Left: Member list -->
        <div class="glass-card" style="height: fit-content;">
          <div style="margin-bottom: 14px;">
            <input type="text" class="search-input" style="width: 100%;" placeholder="Cari nama anggota..." value="${this.searchQuery}" oninput="FormTabmin.onSearch(this.value)">
          </div>

          <div style="max-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px;">
            ${filtered.map(p => `
              <div 
                style="padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition); border: 1px solid ${p.id === this.selectedParticipantId ? 'var(--primary)' : 'var(--border-color)'}; background: ${p.id === this.selectedParticipantId ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.02)'};"
                onclick="FormTabmin.selectParticipant(${p.id})"
              >
                <div style="font-weight: 600; font-size: 0.88rem; color: white;">${p.name}</div>
                <div style="display: flex; gap: 6px; margin-top: 4px;">
                  <span class="badge badge-profesi" style="font-size: 0.68rem;">${p.profession}</span>
                  <span class="badge badge-group" style="font-size: 0.68rem;">${p.tabmin_group}</span>
                </div>
              </div>
            `).join('') || '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Tidak ada anggota.</div>'}
          </div>
        </div>

        <!-- Right: Member Scoring Form -->
        <div class="glass-card">
          ${active ? `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 20px;">
              <div>
                <span class="badge badge-group">${active.tabmin_group}</span>
                <span class="badge badge-profesi">${active.profession}</span>
                <h3 style="font-size: 1.35rem; color: white; margin-top: 6px;">${active.name}</h3>
              </div>
              <span class="badge badge-success" style="font-size: 0.85rem; padding: 6px 14px;">
                Penilai: ${App.currentUser.full_name}
              </span>
            </div>

            <!-- 1. Kehadiran -->
            <div class="likert-group">
              <div class="likert-label">Kehadiran & Ketepatan Waktu</div>
              <div class="likert-desc">Kedisiplinan hadir di seluruh rangkaian forum dan agenda kelompok Tabmin.</div>
              <div class="likert-options">
                ${this.renderLikertBtn('kehadiran', 1, 'Terlambat >15m')}
                ${this.renderLikertBtn('kehadiran', 2, 'Terlambat 10-15m')}
                ${this.renderLikertBtn('kehadiran', 3, 'Terlambat 5-10m')}
                ${this.renderLikertBtn('kehadiran', 4, 'Tepat waktu')}
                ${this.renderLikertBtn('kehadiran', 5, 'Tepat waktu & siap')}
              </div>
            </div>

            <!-- 2. Partisipasi -->
            <div class="likert-group">
              <div class="likert-label">Partisipasi & Keaktifan Kelompok</div>
              <div class="likert-desc">Kontribusi ide, proaktif dalam tugas kelompok, dan kerjasama tim.</div>
              <div class="likert-options">
                ${this.renderLikertBtn('partisipasi', 1, 'Pasif total')}
                ${this.renderLikertBtn('partisipasi', 2, 'Kurang aktif')}
                ${this.renderLikertBtn('partisipasi', 3, 'Cukup aktif')}
                ${this.renderLikertBtn('partisipasi', 4, 'Aktif & kooperatif')}
                ${this.renderLikertBtn('partisipasi', 5, 'Sangat solutif & inisiatif')}
              </div>
            </div>

            <!-- 3. Sikap -->
            <div class="likert-group">
              <div class="likert-label">Sikap & Kedisiplinan</div>
              <div class="likert-desc">Sopan santun, tanggung jawab, dan komunikasi yang membangun antar sesama anggota.</div>
              <div class="likert-options">
                ${this.renderLikertBtn('sikap', 1, 'Tidak kondusif')}
                ${this.renderLikertBtn('sikap', 2, 'Kurang disiplin')}
                ${this.renderLikertBtn('sikap', 3, 'Cukup tertib')}
                ${this.renderLikertBtn('sikap', 4, 'Tertib & sopan')}
                ${this.renderLikertBtn('sikap', 5, 'Sangat teladan & suportif')}
              </div>
            </div>

            <!-- Catatan -->
            <div style="margin-bottom: 24px;">
              <label style="font-weight: 600; font-size: 0.9rem; color: white; display: block; margin-bottom: 6px;">Catatan Tambahan untuk Anggota</label>
              <textarea class="search-input" style="width: 100%; height: 80px; resize: vertical;" placeholder="Tulis catatan apresiasi atau evaluasi khusus..." oninput="FormTabmin.memberScores.notes = this.value">${this.memberScores.notes}</textarea>
            </div>

            <button id="tabmin-member-save" class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 1rem;" onclick="FormTabmin.submitMember()" ${this.savingMember ? 'disabled' : ''}>
              ${this.savingMember ? '<i class="fas fa-spinner fa-spin"></i> Menyimpan...' : '<i class="fas fa-save"></i> Simpan Penilaian Anggota Tabmin'}
            </button>
          ` : '<div style="color: var(--text-dim); text-align: center; padding: 40px;">Pilih anggota kelompok di panel kiri.</div>'}
        </div>
      </div>
    `;
  },

  renderProductView() {
    const avg = ((this.productScores.reporter + this.productScores.fotografer + this.productScores.ilustrator + this.productScores.layouter + this.productScores.marcomm) / 5.0).toFixed(2);

    return `
      <div class="glass-card">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 24px;">
          <div>
            <span class="badge badge-group" style="font-size: 0.9rem;">${this.selectedGroup}</span>
            <h3 style="font-size: 1.4rem; color: white; margin-top: 6px;">Evaluasi Produk / Hasil Karya Tabmin</h3>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.8rem; color: var(--text-muted);">Penilaian Total Produk:</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #34d399;">${avg} <span style="font-size: 1rem; color: #94a3b8;">/ 5.0</span></div>
          </div>
        </div>

        <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 20px;">
          Nilai hasil karya akhir kelompok ${this.selectedGroup} dari 5 perspektif divisi profesi. Sistem akan secara otomatis menghitung rata-rata nilai total produk.
        </p>

        <!-- Reporter -->
        <div class="likert-group">
          <div class="likert-label">1. Penilaian Hasil Reporter</div>
          <div class="likert-desc">Kualitas artikel, kedalaman riset, akurasi fakta, dan kekuatan narasi naskah.</div>
          <div class="likert-options">${this.renderProductLikert('reporter')}</div>
        </div>

        <!-- Fotografer -->
        <div class="likert-group">
          <div class="likert-label">2. Penilaian Hasil Fotografer</div>
          <div class="likert-desc">Kualitas visual foto, pencahayaan, komposisi angle, dan kekuatan penceritaan visual.</div>
          <div class="likert-options">${this.renderProductLikert('fotografer')}</div>
        </div>

        <!-- Ilustrator -->
        <div class="likert-group">
          <div class="likert-label">3. Penilaian Hasil Ilustrator</div>
          <div class="likert-desc">Kreativitas gambar/ilustrasi, kesesuaian gaya visual dengan topik, dan estetika.</div>
          <div class="likert-options">${this.renderProductLikert('ilustrator')}</div>
        </div>

        <!-- Layouter -->
        <div class="likert-group">
          <div class="likert-label">4. Penilaian Hasil Layouter</div>
          <div class="likert-desc">Harmonisasi tata letak, kenyamanan membaca, tipografi, dan konsistensi layout media.</div>
          <div class="likert-options">${this.renderProductLikert('layouter')}</div>
        </div>

        <!-- Marcomm -->
        <div class="likert-group">
          <div class="likert-label">5. Penilaian Hasil Marcomm</div>
          <div class="likert-desc">Strategi promosi, copy caption medsos, daya tarik branding, dan distribusi produk.</div>
          <div class="likert-options">${this.renderProductLikert('marcomm')}</div>
        </div>

        <!-- Notes -->
        <div style="margin-bottom: 24px;">
          <label style="font-weight: 600; font-size: 0.9rem; color: white; display: block; margin-bottom: 6px;">Catatan Review Karya Produk</label>
          <textarea class="search-input" style="width: 100%; height: 80px; resize: vertical;" placeholder="Tuliskan ulasan menyeluruh tentang produk kelompok ini..." oninput="FormTabmin.productScores.notes = this.value">${this.productScores.notes}</textarea>
        </div>

        <button id="tabmin-product-save" class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 1rem;" onclick="FormTabmin.submitProduct()" ${this.savingProduct ? 'disabled' : ''}>
          ${this.savingProduct ? '<i class="fas fa-spinner fa-spin"></i> Menyimpan...' : `<i class="fas fa-save"></i> Simpan Penilaian Produk ${this.selectedGroup}`}
        </button>
      </div>
    `;
  },

  renderLikertBtn(category, val, label) {
    const isSelected = this.memberScores[category] === val;
    return `
      <div class="likert-btn ${isSelected ? 'selected' : ''}" onclick="FormTabmin.setMemberScore('${category}', ${val})">
        <span class="likert-num">${val}</span>
        <span class="likert-text">${label}</span>
      </div>
    `;
  },

  renderProductLikert(aspect) {
    return [1, 2, 3, 4, 5].map(v => {
      const isSelected = this.productScores[aspect] === v;
      const labels = ['', 'Sangat Kurang', 'Kurang', 'Cukup Baik', 'Bagus', 'Istimewa'];
      return `
        <div class="likert-btn ${isSelected ? 'selected' : ''}" onclick="FormTabmin.setProductScore('${aspect}', ${v})">
          <span class="likert-num">${v}</span>
          <span class="likert-text">${labels[v]}</span>
        </div>
      `;
    }).join('');
  },

  setMemberScore(cat, val) {
    this.memberScores[cat] = val;
    this.render();
  },

  setProductScore(aspect, val) {
    this.productScores[aspect] = val;
    this.render();
  },

  async setGroup(g) {
    this.selectedGroup = g;
    await this.loadParticipants();
    if (this.activeSubTab === 'product') {
      await this.loadProductScore();
    } else if (this.selectedParticipantId) {
      await this.loadMemberScore(this.selectedParticipantId);
    }
    this.render();
  },

  async setSubTab(tab) {
    this.activeSubTab = tab;
    if (tab === 'product') {
      await this.loadProductScore();
    } else if (this.selectedParticipantId) {
      await this.loadMemberScore(this.selectedParticipantId);
    }
    this.render();
  },

  onSearch(val) {
    this.searchQuery = val;
    this.render();
  },

  async selectParticipant(id) {
    this.selectedParticipantId = id;
    const loading = this.loadMemberScore(id);
    this.render();
    await loading;
    if (this.selectedParticipantId === id) this.render();
  },

  async submitMember() {
    if (!this.selectedParticipantId || this.savingMember) return;
    const participantId = this.selectedParticipantId;
    const scores = { ...this.memberScores };
    this.savingMember = true;
    const button = document.getElementById('tabmin-member-save');
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    }

    try {
      await API.post('/api/eval/tabmin-member', {
        participant_id: participantId,
        score_kehadiran: scores.kehadiran,
        score_partisipasi: scores.partisipasi,
        score_sikap: scores.sikap,
        notes: scores.notes
      });
      showToast('Penilaian Anggota Tabmin berhasil disimpan!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      this.savingMember = false;
      const activeButton = document.getElementById('tabmin-member-save');
      if (activeButton) {
        activeButton.disabled = false;
        activeButton.innerHTML = '<i class="fas fa-save"></i> Simpan Penilaian Anggota Tabmin';
      }
    }
  },

  async submitProduct() {
    if (this.savingProduct) return;
    const group = this.selectedGroup;
    const scores = { ...this.productScores };
    this.savingProduct = true;
    const button = document.getElementById('tabmin-product-save');
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    }

    try {
      await API.post('/api/eval/tabmin-product', {
        tabmin_group: group,
        score_reporter: scores.reporter,
        score_fotografer: scores.fotografer,
        score_ilustrator: scores.ilustrator,
        score_layouter: scores.layouter,
        score_marcomm: scores.marcomm,
        notes: scores.notes
      });
      showToast(`Penilaian Produk ${group} berhasil disimpan!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      this.savingProduct = false;
      const activeButton = document.getElementById('tabmin-product-save');
      if (activeButton) {
        activeButton.disabled = false;
        activeButton.innerHTML = `<i class="fas fa-save"></i> Simpan Penilaian Produk ${this.selectedGroup}`;
      }
    }
  }
};
