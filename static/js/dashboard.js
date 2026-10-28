// Dashboard & Recap Module for KI23 Evaluation System
// Strictly accessible to Supervisor & HRD

const Dashboard = {
  currentTab: 'master', // 'master', 'tabmin', 'profesi', 'products'
  currentGroupFilter: 'ALL',
  currentProfFilter: 'ALL',
  searchQuery: '',
  masterData: [],

  async init() {
    if (App.currentUser?.role === 'hrd_profesi' && this.currentTab === 'products') {
      this.currentTab = 'master';
    }
    await this.loadKPIs();
    await this.loadMasterRecap();
    this.render();
  },

  async loadKPIs() {
    try {
      const kpis = await API.get('/api/recap/summary-kpi');
      const el = document.getElementById('kpi-container');
      if (!el) return;

      el.innerHTML = `
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon indigo"><i class="fas fa-users"></i></div>
            <div>
              <div class="kpi-val">${kpis.total_participants}</div>
              <div class="kpi-lbl">Total Peserta Terdaftar</div>
              <div class="kpi-sub"><i class="fas fa-layer-group"></i> 6 Kelompok Tabmin | 5 Profesi</div>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon emerald"><i class="fas fa-tasks"></i></div>
            <div>
              <div class="kpi-val">${kpis.completion_percentage}%</div>
              <div class="kpi-lbl">Progres Penilaian</div>
              <div class="kpi-sub">${kpis.evaluated_participants} dari ${kpis.total_participants} terisi</div>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon cyan"><i class="fas fa-chart-line"></i></div>
            <div>
              <div class="kpi-val">${kpis.average_overall_score} <span style="font-size: 1rem; color: #94a3b8;">/ 5.0</span></div>
              <div class="kpi-lbl">Rata-rata Nilai Acara</div>
              <div class="kpi-sub">${(kpis.average_overall_score * 20).toFixed(1)} Skala 100</div>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon amber"><i class="fas fa-award"></i></div>
            <div>
              <div class="kpi-val">${kpis.total_tabmin_evals + kpis.total_prof_evals}</div>
              <div class="kpi-lbl">Total Lembar Nilai Masuk</div>
              <div class="kpi-sub">HRD, PJK, Wali & Peer</div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('Error loading KPIs:', err);
    }
  },

  async loadMasterRecap() {
    try {
      let query = `/api/recap/master?group=${encodeURIComponent(this.currentGroupFilter)}&profession=${encodeURIComponent(this.currentProfFilter)}`;
      if (this.searchQuery) {
        query += `&search=${encodeURIComponent(this.searchQuery)}`;
      }
      const res = await API.get(query);
      this.masterData = res.data || [];
      this.renderMasterTable();
    } catch (err) {
      console.error('Error loading master recap:', err);
      showToast(err.message, 'error');
    }
  },

  render() {
    const container = document.getElementById('view-content');
    if (!container) return;

    container.innerHTML = `
      <div id="kpi-container"></div>

      <div class="glass-card">
        <!-- Sub-navigation tabs -->
        <div style="display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; overflow-x: auto;">
          <button class="btn ${this.currentTab === 'master' ? 'btn-primary' : 'btn-secondary'}" onclick="Dashboard.switchTab('master')">
            <i class="fas fa-list-ol"></i> Rekap Nilai Akhir
          </button>
          <button class="btn ${this.currentTab === 'tabmin' ? 'btn-primary' : 'btn-secondary'}" onclick="Dashboard.switchTab('tabmin')">
            <i class="fas fa-user-friends"></i> Detail Tabmin Anggota
          </button>
          ${App.currentUser?.role !== 'hrd_profesi' ? `
            <button class="btn ${this.currentTab === 'products' ? 'btn-primary' : 'btn-secondary'}" onclick="Dashboard.switchTab('products')">
              <i class="fas fa-box-open"></i> Produk Karya Tabmin
            </button>
          ` : ''}
          <button class="btn ${this.currentTab === 'profesi' ? 'btn-primary' : 'btn-secondary'}" onclick="Dashboard.switchTab('profesi')">
            <i class="fas fa-graduation-cap"></i> Detail Kelas Profesi
          </button>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="toolbar">
          <div class="filter-group">
            <input type="text" id="recap-search" class="search-input" placeholder="Cari nama peserta / kelompok..." value="${this.searchQuery}" oninput="Dashboard.onSearch(this.value)">
            
            <select class="custom-select" id="group-filter" onchange="Dashboard.onGroupFilter(this.value)">
              <option value="ALL">Semua Kelompok</option>
              <option value="Kelompok 1">Kelompok 1</option>
              <option value="Kelompok 2">Kelompok 2</option>
              <option value="Kelompok 3">Kelompok 3</option>
              <option value="Kelompok 4">Kelompok 4</option>
              <option value="Kelompok 5">Kelompok 5</option>
              <option value="Kelompok 6">Kelompok 6</option>
            </select>

            <select class="custom-select" id="prof-filter" onchange="Dashboard.onProfFilter(this.value)">
              <option value="ALL">Semua Profesi</option>
              <option value="Ilustrator">Ilustrator</option>
              <option value="Fotografer">Fotografer</option>
              <option value="Layouter">Layouter</option>
              <option value="Marcomm">Marcomm</option>
              <option value="Reporter">Reporter</option>
            </select>
          </div>

          <button class="btn btn-success" id="export-excel-btn" onclick="Dashboard.exportExcel()">
            <i class="fas fa-file-excel"></i> Export Excel (.xlsx)
          </button>
        </div>

        <!-- Table View Container -->
        <div id="table-view-container">
          <!-- Filled by tab renderer -->
        </div>
      </div>

      <!-- Detail Modal -->
      <div id="detail-modal" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="modal-title" style="color: white; font-size: 1.25rem;">Rincian Penilaian Peserta</h3>
            <button class="modal-close" onclick="Dashboard.closeModal()">&times;</button>
          </div>
          <div id="modal-body">
            <!-- Filled dynamically -->
          </div>
        </div>
      </div>
    `;

    this.loadKPIs();
    if (this.currentTab === 'master') this.renderMasterTable();
    else if (this.currentTab === 'tabmin') this.loadTabminDetail();
    else if (this.currentTab === 'products') this.loadProductsDetail();
    else if (this.currentTab === 'profesi') this.loadProfesiDetail();
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.render();
  },

  onSearch(val) {
    this.searchQuery = val;
    this.loadMasterRecap();
  },

  onGroupFilter(val) {
    this.currentGroupFilter = val;
    this.loadMasterRecap();
  },

  onProfFilter(val) {
    this.currentProfFilter = val;
    this.loadMasterRecap();
  },

  renderMasterTable() {
    const container = document.getElementById('table-view-container');
    if (!container) return;

    if (!this.masterData.length) {
      container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-dim);">Tidak ada data peserta ditemukan.</div>`;
      return;
    }

    let rowsHtml = this.masterData.map((row, idx) => {
      const predikatClass = row.predikat === 'Sangat Memuaskan' ? 'badge-success' :
                            row.predikat === 'Memuaskan' ? 'badge-profesi' :
                            row.predikat === 'Cukup' ? 'badge-warning' : 'badge-danger';
      
      const scoreProf = row.nilai_profesi !== null ? `<span class="score-display score-mid">${row.nilai_profesi}</span>` : '<span style="color: #64748b;">-</span>';
      const scoreTab = row.nilai_tabmin_anggota !== null ? `<span class="score-display score-mid">${row.nilai_tabmin_anggota}</span>` : '<span style="color: #64748b;">-</span>';
      const scoreProd = row.nilai_produk_kelompok !== null ? `<span class="score-display">${row.nilai_produk_kelompok}</span>` : '<span style="color: #64748b;">-</span>';
      const scoreFinal5 = row.nilai_akhir_skala_5 !== null ? `<span class="score-display score-high">${row.nilai_akhir_skala_5}</span>` : '<span style="color: #64748b;">-</span>';
      const scoreFinal100 = row.nilai_akhir_skala_100 !== null ? `<strong style="color: #67e8f9;">${row.nilai_akhir_skala_100}</strong>` : '<span style="color: #64748b;">-</span>';

      return `
        <tr>
          <td style="text-align: center; color: var(--text-dim);">${idx + 1}</td>
          <td>
            <div style="font-weight: 700; color: white;">${row.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${row.pjk_name ? 'PJK: ' + row.pjk_name : ''}</div>
          </td>
          <td><span class="badge badge-profesi">${row.profession}</span></td>
          <td><span class="badge badge-group">${row.tabmin_group}</span></td>
          <td style="text-align: center;">${scoreProf}</td>
          <td style="text-align: center;">
            ${scoreTab}
            <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 2px;">${row.status_penilai}</div>
          </td>
          <td style="text-align: center;">${scoreProd}</td>
          <td style="text-align: center; background: rgba(99, 102, 241, 0.05);">${scoreFinal5}</td>
          <td style="text-align: center; background: rgba(99, 102, 241, 0.08);">${scoreFinal100}</td>
          <td style="text-align: center;"><span class="badge ${predikatClass}">${row.predikat}</span></td>
          <td style="text-align: center;">
            <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.78rem;" onclick="Dashboard.openDetail(${row.participant_id})">
              <i class="fas fa-eye"></i> Detail
            </button>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="table-responsive">
        <table class="custom-table" id="master-table">
          <thead>
            <tr>
              <th style="text-align: center;">No</th>
              <th>Nama Peserta</th>
              <th>Divisi Profesi</th>
              <th>Kelompok Tabmin</th>
              <th style="text-align: center;">Nilai Profesi (1-5)</th>
              <th style="text-align: center;">Nilai Anggota Tabmin</th>
              <th style="text-align: center;">Produk Kelompok</th>
              <th style="text-align: center;">Nilai Akhir (1-5)</th>
              <th style="text-align: center;">Nilai Akhir (100)</th>
              <th style="text-align: center;">Predikat</th>
              <th style="text-align: center;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  },

  async loadTabminDetail() {
    const container = document.getElementById('table-view-container');
    if (!container) return;

    try {
      const res = await API.get(`/api/recap/tabmin-detail?group=${encodeURIComponent(this.currentGroupFilter)}&search=${encodeURIComponent(this.searchQuery)}`);
      const members = res.members || [];

      let rowsHtml = members.map((m, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="font-weight: 700; color: white;">${m.name}</td>
          <td><span class="badge badge-group">${m.tabmin_group}</span></td>
          <td>${m.pjk_name || '-'}</td>
          <td style="text-align: center; font-weight: 700; color: #a5b4fc;">${m.skor_hrd !== null ? m.skor_hrd : '-'}</td>
          <td style="text-align: center; font-weight: 700; color: #67e8f9;">${m.skor_pjk !== null ? m.skor_pjk : '-'}</td>
          <td style="text-align: center; font-weight: 700; color: #6ee7b7;">${m.skor_peer !== null ? m.skor_peer : '-'} (${m.peer_count})</td>
          <td style="text-align: center; font-size: 1.1rem; font-weight: 800; color: #34d399;">${m.nilai_tabmin_anggota !== null ? m.nilai_tabmin_anggota : '-'}</td>
          <td style="text-align: center;"><span class="badge badge-profesi">${m.status_penilai}</span></td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="margin-bottom: 14px; color: var(--text-muted); font-size: 0.88rem;">
          <i class="fas fa-info-circle"></i> Rumus Nilai Akhir Anggota = <strong>Rata-Rata (Skor HRD + Skor PJK + Rata-Rata Skor Peer Review)</strong>.
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th style="text-align: center;">No</th>
                <th>Nama Peserta</th>
                <th>Kelompok</th>
                <th>PJK</th>
                <th style="text-align: center;">Skor HRD</th>
                <th style="text-align: center;">Skor PJK</th>
                <th style="text-align: center;">Skor Peer (Jml)</th>
                <th style="text-align: center;">Nilai Akhir Anggota</th>
                <th style="text-align: center;">Status Pengisian</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div style="color: var(--danger); padding: 20px;">Gagal memuat detail Tabmin: ${err.message}</div>`;
    }
  },

  async loadProductsDetail() {
    const container = document.getElementById('table-view-container');
    if (!container) return;

    try {
      const res = await API.get('/api/eval/tabmin-product');
      const products = res.products || [];

      let rowsHtml = products.map((p, idx) => `
        <tr>
          <td style="font-weight: 700; color: white; font-size: 1rem;"><span class="badge badge-group">${p.tabmin_group}</span></td>
          <td style="text-align: center; font-weight: 600;">${p.score_reporter}</td>
          <td style="text-align: center; font-weight: 600;">${p.score_fotografer}</td>
          <td style="text-align: center; font-weight: 600;">${p.score_ilustrator}</td>
          <td style="text-align: center; font-weight: 600;">${p.score_layouter}</td>
          <td style="text-align: center; font-weight: 600;">${p.score_marcomm}</td>
          <td style="text-align: center; font-size: 1.15rem; font-weight: 800; color: #34d399; background: rgba(16, 185, 129, 0.08);">
            ${p.score_total}
          </td>
          <td style="color: var(--text-muted); font-size: 0.85rem;">${p.notes || '-'}</td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="margin-bottom: 14px; color: var(--text-muted); font-size: 0.88rem;">
          <i class="fas fa-info-circle"></i> Penilaian Produk Kelompok dinilai dari 5 sudut pandang profesi. Total nilai dihitung otomatis dari rata-rata kelima aspek.
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Kelompok</th>
                <th style="text-align: center;">Hasil Reporter</th>
                <th style="text-align: center;">Hasil Fotografer</th>
                <th style="text-align: center;">Hasil Ilustrator</th>
                <th style="text-align: center;">Hasil Layouter</th>
                <th style="text-align: center;">Hasil Marcomm</th>
                <th style="text-align: center;">Penilaian Total Produk</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div style="color: var(--danger); padding: 20px;">Gagal memuat produk Tabmin: ${err.message}</div>`;
    }
  },

  async loadProfesiDetail() {
    const container = document.getElementById('table-view-container');
    if (!container) return;

    try {
      const res = await API.get(`/api/recap/profesi-detail?profession=${encodeURIComponent(this.currentProfFilter)}&search=${encodeURIComponent(this.searchQuery)}`);
      const list = res.participants || [];

      let rowsHtml = list.map((p, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="font-weight: 700; color: white;">${p.name}</td>
          <td><span class="badge badge-profesi">${p.profession}</span></td>
          <td><span class="badge badge-group">${p.tabmin_group}</span></td>
          <td style="text-align: center;">${p.keprof1_umum ?? '-'}</td>
          <td style="text-align: center;">${p.keprof1_tugas ?? '-'}</td>
          <td style="text-align: center;">${p.keprof2_umum ?? '-'}</td>
          <td style="text-align: center;">${p.keprof2_tugas ?? '-'}</td>
          <td style="text-align: center;">${p.keprof3_umum ?? '-'}</td>
          <td style="text-align: center; font-weight: 800; color: #38bdf8;">${p.nilai_profesi_total ?? '-'}</td>
          <td style="text-align: center;"><span class="badge ${p.status_absen === 'Hadir Lengkap' ? 'badge-success' : 'badge-warning'}">${p.status_absen}</span></td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="margin-bottom: 14px; color: var(--text-muted); font-size: 0.88rem;">
          <i class="fas fa-info-circle"></i> Penilaian Kelas Profesi mencakup evaluasi umum (Keprof 1, 2, 3) dan tugas / tugas pengganti (Keprof 1 & 2: Teknis oleh HRD + Isi oleh Wali Kelas).
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th style="text-align: center;">No</th>
                <th>Nama Peserta</th>
                <th>Profesi</th>
                <th>Kelompok</th>
                <th style="text-align: center;">Keprof 1 (Umum)</th>
                <th style="text-align: center;">Keprof 1 (Tugas)</th>
                <th style="text-align: center;">Keprof 2 (Umum)</th>
                <th style="text-align: center;">Keprof 2 (Tugas)</th>
                <th style="text-align: center;">Keprof 3 (Umum)</th>
                <th style="text-align: center;">Rata-rata Profesi</th>
                <th style="text-align: center;">Status Absensi</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div style="color: var(--danger); padding: 20px;">Gagal memuat detail Profesi: ${err.message}</div>`;
    }
  },

  async openDetail(participantId) {
    const modal = document.getElementById('detail-modal');
    const body = document.getElementById('modal-body');
    const title = document.getElementById('modal-title');
    if (!modal || !body) return;

    modal.classList.add('active');
    body.innerHTML = '<div style="text-align: center; padding: 30px;"><i class="fas fa-spinner fa-spin"></i> Memuat data...</div>';

    try {
      const p = this.masterData.find(x => x.participant_id === participantId);
      if (p) title.textContent = `Rincian Nilai: ${p.name}`;

      // Fetch profesi general & task details
      const genRes = await API.get(`/api/eval/profesi-general/${participantId}`);
      
      body.innerHTML = `
        <div style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
          <span class="badge badge-profesi">Profesi: ${p?.profession}</span>
          <span class="badge badge-group">Kelompok: ${p?.tabmin_group}</span>
          <span class="badge badge-success">Nilai Akhir: ${p?.nilai_akhir_skala_5} (${p?.nilai_akhir_skala_100}/100)</span>
        </div>

        <h4 style="color: #cbd5e1; margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
          <i class="fas fa-graduation-cap"></i> Evaluasi Kelas Profesi
        </h4>
        <div style="background: rgba(15, 23, 42, 0.4); border-radius: var(--radius-md); padding: 14px; margin-bottom: 18px;">
          <div style="font-weight: 700; font-size: 0.85rem; color: #a5b4fc; margin-bottom: 8px;">Penilaian Sesi Kelas:</div>
          ${(genRes.evaluations || []).map(g => {
            const isAbs = (g.is_absen === 1);
            let statusText = isAbs ? '<span style="color:#f59e0b; font-weight:700;">Tidak Hadir (Absen)</span>' : '<span style="color:#34d399; font-weight:700;">Hadir</span>';
            if (g.keprof_session === 3 && isAbs) statusText += ' — Nilai: 0.0';
            return `
              <div style="margin-bottom: 8px; font-size: 0.85rem; padding-bottom: 6px; border-bottom: 1px dashed rgba(255,255,255,0.07);">
                <strong>Keprof ${g.keprof_session}</strong> (${statusText}):
                ${!isAbs ? `Kehadiran: <strong>${g.score_kehadiran}</strong>, Partisipasi: <strong>${g.score_partisipasi}</strong>, Sikap: <strong>${g.score_sikap}</strong>` : (g.keprof_session <= 2 ? `<em>(Penilaian umum digantikan tugas pengganti)</em>` : `<em>(Skor 0.0)</em>`)}
                <div style="color: var(--text-dim); font-size: 0.78rem;">Catatan: ${g.notes || '-'}</div>
              </div>
            `;
          }).join('') || '<div style="color: var(--text-dim);">Belum ada evaluasi umum tersimpan.</div>'}

          <div style="font-weight: 700; font-size: 0.85rem; color: #38bdf8; margin-top: 14px; margin-bottom: 8px;">Penilaian Tugas (Teknis oleh HRD + Isi oleh Wali Kelas):</div>
          ${(genRes.tasks || []).map(t => {
            const taskLabel = t.is_replacement === 1 ? 'Tugas Pengganti' : 'Tugas Utama (Reguler)';
            return `
              <div style="margin-bottom: 8px; font-size: 0.85rem; padding-bottom: 6px; border-bottom: 1px dashed rgba(255,255,255,0.07);">
                <strong>Keprof ${t.keprof_session} — ${taskLabel}</strong>:
                Teknis: <strong>${t.score_teknis ?? '-'}</strong>, 
                Isi: <strong>${t.score_isi ?? '-'}</strong>
                <div style="color: var(--text-dim); font-size: 0.78rem;">Catatan: ${t.task_notes || '-'}</div>
              </div>
            `;
          }).join('') || '<div style="color: var(--text-dim);">Belum ada penugasan tersimpan.</div>'}
        </div>

        <h4 style="color: #cbd5e1; margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
          <i class="fas fa-user-friends"></i> Evaluasi Anggota Tabmin
        </h4>
        <div style="background: rgba(15, 23, 42, 0.4); border-radius: var(--radius-md); padding: 14px;">
          <p style="font-size: 0.88rem; margin-bottom: 6px;">Komponen Penilai: <strong>${p?.status_penilai}</strong></p>
          <p style="font-size: 0.88rem; color: #34d399;">Skor Anggota Tabmin: <strong>${p?.nilai_tabmin_anggota ?? '-'}</strong></p>
          <p style="font-size: 0.88rem; color: #67e8f9;">Skor Produk Kelompok: <strong>${p?.nilai_produk_kelompok ?? '-'}</strong></p>
        </div>
      `;
    } catch (err) {
      body.innerHTML = `<div style="color: var(--danger);">Gagal memuat detail: ${err.message}</div>`;
    }
  },

  closeModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) modal.classList.remove('active');
  },

  exportExcel() {
    const url = `/api/recap/export-excel?group=${encodeURIComponent(this.currentGroupFilter)}&profession=${encodeURIComponent(this.currentProfFilter)}`;
    showToast('Mengunduh file Excel Rekapitulasi Nilai...', 'info');
    window.location.href = url;
  }
};
