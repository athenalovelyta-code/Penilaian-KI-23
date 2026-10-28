// Gateway & Dual-Mode Authentication Portal for KI23
// Options: 1) Login sebagai Panitia (5 Jabatan), 2) Login sebagai Peserta (Profesi + Kelompok Tabmin)

const Gateway = {
  loginMode: 'panitia', // 'panitia' or 'peserta'

  // Panitia form state
  selectedJabatan: 'teknisi', // 'teknisi', 'kepala_sekolah', 'hrd', 'wali_kelas', 'pjk'
  panitiaPassword: '',
  showPanitiaPassword: false,
  loadingPanitia: false,

  // Peserta form state
  selectedProfession: 'Ilustrator', // 'Ilustrator', 'Fotografer', 'Layouter', 'Marcomm', 'Reporter'
  selectedGroup: 'Kelompok 1',       // 'Kelompok 1' to 'Kelompok 6'
  pesertaPassword: '',
  showPesertaPassword: false,
  loadingPeserta: false,

  // Auxiliary data
  professions: ['Ilustrator', 'Fotografer', 'Layouter', 'Marcomm', 'Reporter'],
  tabminGroups: ['Kelompok 1', 'Kelompok 2', 'Kelompok 3', 'Kelompok 4', 'Kelompok 5', 'Kelompok 6'],
  jabatanList: [
    {
      id: 'teknisi',
      title: 'Teknisi',
      subtitle: 'Akses Penuh & Panel Manajemen',
      icon: 'fa-tools',
      color: '#6366f1'
    },
    {
      id: 'kepala_sekolah',
      title: 'Kepala / Wakil Kepala Sekolah',
      subtitle: 'Read-Only Rekap Master & KPI',
      icon: 'fa-school',
      color: '#06b6d4'
    },
    {
      id: 'hrd',
      title: 'HRD',
      subtitle: 'Kepala HRD, Profesi & Kelompok',
      icon: 'fa-crown',
      color: '#ec4899'
    },
    {
      id: 'wali_kelas',
      title: 'Wali Kelas',
      subtitle: 'Penilai Isi Tugas (Isolasi Divisi)',
      icon: 'fa-chalkboard-teacher',
      color: '#f59e0b'
    },
    {
      id: 'pjk',
      title: 'PJK',
      subtitle: 'Penanggung Jawab Kelompok (Isolasi Tabmin)',
      icon: 'fa-users',
      color: '#10b981'
    }
  ],

  async init() {
    this.render();
  },

  setLoginMode(mode) {
    this.loginMode = mode;
    this.render();
  },

  selectJabatan(jabatanId) {
    this.selectedJabatan = jabatanId;
    this.render();
  },

  togglePanitiaPasswordVisibility() {
    this.showPanitiaPassword = !this.showPanitiaPassword;
    const input = document.getElementById('panitia-password-input');
    const icon = document.getElementById('panitia-eye-icon');
    if (input) {
      input.type = this.showPanitiaPassword ? 'text' : 'password';
    }
    if (icon) {
      icon.className = this.showPanitiaPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
  },

  togglePesertaPasswordVisibility() {
    this.showPesertaPassword = !this.showPesertaPassword;
    const input = document.getElementById('peserta-password-input');
    const icon = document.getElementById('peserta-eye-icon');
    if (input) {
      input.type = this.showPesertaPassword ? 'text' : 'password';
    }
    if (icon) {
      icon.className = this.showPesertaPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
  },

  async submitLoginPanitia() {
    const pwInput = document.getElementById('panitia-password-input');
    const pw = (pwInput ? pwInput.value : this.panitiaPassword).trim();

    if (!pw) {
      showToast('Silakan masukkan password panitia Anda.', 'warning');
      if (pwInput) pwInput.focus();
      return;
    }

    this.loadingPanitia = true;
    this.render();

    try {
      const res = await API.post('/api/auth/login-panitia', {
        jabatan: this.selectedJabatan,
        password: pw
      });

      localStorage.setItem('ki23_token', res.token);
      App.currentUser = res.user;
      App.renderNavbar();

      const user = res.user;
      showToast(res.message || `Selamat datang, ${user.full_name}!`, 'success');

      // Routing strictly enforcing RBAC
      if (user.role === 'teknisi') {
        App.navigate('admin');
      } else if (user.role === 'wali_kelas') {
        App.navigate('wali');
      } else if (user.role === 'pjk') {
        App.navigate('tabmin');
      } else if (user.role === 'hrd_profesi') {
        App.navigate('profesi');
      } else if (user.role === 'hrd_kelompok') {
        App.navigate('tabmin');
      } else {
        App.navigate('recap');
      }
    } catch (err) {
      this.loadingPanitia = false;
      this.render();
      showToast(err.message, 'error');
      const errBox = document.getElementById('login-panitia-error');
      if (errBox) {
        errBox.style.display = 'block';
        errBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message}`;
      }
    }
  },

  async submitLoginPeserta() {
    const pwInput = document.getElementById('peserta-password-input');
    const pw = (pwInput ? pwInput.value : this.pesertaPassword).trim();

    if (!pw) {
      showToast('Silakan masukkan password peserta Anda.', 'warning');
      if (pwInput) pwInput.focus();
      return;
    }

    this.loadingPeserta = true;
    this.render();

    try {
      const res = await API.post('/api/auth/login-peserta', {
        profession: this.selectedProfession,
        tabmin_group: this.selectedGroup,
        password: pw
      });

      localStorage.setItem('ki23_token', res.token);
      App.currentUser = res.user;
      App.renderNavbar();

      showToast(res.message || `Selamat datang, ${res.user.full_name}! Masuk ke form Peer Review.`, 'success');

      // Peserta can strictly only access peer review
      App.navigate('peer');
    } catch (err) {
      this.loadingPeserta = false;
      this.render();
      showToast(err.message, 'error');
      const errBox = document.getElementById('login-peserta-error');
      if (errBox) {
        errBox.style.display = 'block';
        errBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message}`;
      }
    }
  },

  render() {
    const container = document.getElementById('view-content');
    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; max-width: 860px; margin: 10px auto 30px;">
        <!-- Header Pill & Title -->
        <span class="demo-pill" style="margin-bottom: 12px; display: inline-block;">
          <i class="fas fa-shield-alt"></i> Portal Autentikasi Sistem Penilaian KI23
        </span>
        <h1 style="font-size: 2.2rem; margin-bottom: 10px; background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #818cf8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          Masuk ke Sesi Penilaian
        </h1>
        <p style="color: var(--text-muted); font-size: 0.98rem; line-height: 1.6; max-width: 650px; margin: 0 auto 24px;">
          Silakan pilih jenis akun Anda di bawah ini untuk memulai pengisian penilaian atau peninjauan nilai.
        </p>

        <!-- 2 Prominent Choices: Login Panitia vs Login Peserta -->
        <div class="login-type-switch">
          <!-- Choice 1: Panitia -->
          <div 
            class="login-type-card ${this.loginMode === 'panitia' ? 'active' : ''}" 
            onclick="Gateway.setLoginMode('panitia')"
          >
            <div class="login-type-icon">
              <i class="fas fa-user-shield"></i>
            </div>
            <div>
              <div style="font-size: 1.15rem; font-weight: 700; color: white;">Login sebagai Panitia</div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 3px;">
                Teknisi, Kepsek/Wakasek, HRD, Wali Kelas, & PJK
              </div>
            </div>
            <div style="margin-left: auto; color: ${this.loginMode === 'panitia' ? 'var(--primary)' : 'var(--text-dim)'}; font-size: 1.1rem;">
              <i class="fas ${this.loginMode === 'panitia' ? 'fa-check-circle' : 'fa-circle'}"></i>
            </div>
          </div>

          <!-- Choice 2: Peserta -->
          <div 
            class="login-type-card ${this.loginMode === 'peserta' ? 'active' : ''}" 
            onclick="Gateway.setLoginMode('peserta')"
          >
            <div class="login-type-icon" style="${this.loginMode === 'peserta' ? 'background: var(--secondary);' : ''}">
              <i class="fas fa-user-graduate"></i>
            </div>
            <div>
              <div style="font-size: 1.15rem; font-weight: 700; color: white;">Login sebagai Peserta</div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 3px;">
                Khusus Penilaian Peer Review Anggota Tabmin
              </div>
            </div>
            <div style="margin-left: auto; color: ${this.loginMode === 'peserta' ? 'var(--secondary)' : 'var(--text-dim)'}; font-size: 1.1rem;">
              <i class="fas ${this.loginMode === 'peserta' ? 'fa-check-circle' : 'fa-circle'}"></i>
            </div>
          </div>
        </div>

        <!-- Dynamic Form Body based on selected Login Mode -->
        <div style="max-width: 680px; margin: 0 auto;">
          ${this.loginMode === 'panitia' ? this.renderPanitiaForm() : this.renderPesertaForm()}
        </div>

        <!-- Security & Confidentiality Footer Note -->
        <div style="margin-top: 32px; font-size: 0.8rem; color: var(--text-dim); display: flex; align-items: center; justify-content: center; gap: 8px;">
          <i class="fas fa-lock" style="color: var(--primary);"></i>
          <span>Role-Based Access Control (RBAC) & Isolasi Nilai Terverifikasi Aktif</span>
        </div>
      </div>
    `;
  },

  renderPanitiaForm() {
    const selectedJabatanObj = this.jabatanList.find(j => j.id === this.selectedJabatan) || this.jabatanList[0];

    return `
      <div class="glass-card" style="padding: 28px; text-align: left; box-shadow: var(--shadow-lg); border: 1px solid rgba(99, 102, 241, 0.25);">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 18px; border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
          <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: rgba(99, 102, 241, 0.2); color: #a5b4fc; display: flex; align-items: center; justify-content: center;">
            <i class="fas fa-id-badge"></i>
          </div>
          <div>
            <h3 style="font-size: 1.15rem; color: white;">Portal Masuk Panitia KI23</h3>
            <p style="font-size: 0.8rem; color: var(--text-muted);">Pilih jabatan Anda (ada 5 pilihan) dan masukkan password panitia.</p>
          </div>
        </div>

        <!-- 1. Pilih Jabatan (5 pilihan) -->
        <label style="display: block; font-size: 0.88rem; font-weight: 700; color: white; margin-bottom: 10px;">
          1. Pilih Jabatan Anda:
        </label>
        
        <div class="jabatan-grid">
          ${this.jabatanList.map(j => `
            <div 
              class="jabatan-card ${this.selectedJabatan === j.id ? 'selected' : ''}" 
              onclick="Gateway.selectJabatan('${j.id}')"
            >
              <i class="fas ${j.icon} jabatan-icon" style="color: ${j.color};"></i>
              <div class="jabatan-name">${j.title}</div>
            </div>
          `).join('')}
        </div>

        <!-- Notice for selected jabatan -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 20px; font-size: 0.82rem; color: var(--text-muted); display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-info-circle" style="color: ${selectedJabatanObj.color}; font-size: 1rem;"></i>
          <div>
            <strong style="color: white;">${selectedJabatanObj.title}:</strong> ${selectedJabatanObj.subtitle}.
            ${this.selectedJabatan === 'wali_kelas' ? '<span style="color: #fde68a; display: block; margin-top: 2px;">⚠️ Sesuai constraint: Wali Kelas hanya dapat membuka penilaian anak dari profesi masing-masing.</span>' : ''}
            ${this.selectedJabatan === 'pjk' ? '<span style="color: #6ee7b7; display: block; margin-top: 2px;">⚠️ Sesuai constraint: PJK hanya dapat menilai dan melihat nilai anggota kelompoknya sendiri.</span>' : ''}
          </div>
        </div>

        <!-- 2. Input Password Panitia -->
        <div style="margin-bottom: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label style="font-size: 0.88rem; font-weight: 700; color: white;">
              2. Masukkan Password Panitia:
            </label>
            <span style="font-size: 0.75rem; color: var(--text-dim);">
              <i class="fas fa-file-excel" style="color: #10b981;"></i> Dilihat di berkas <strong>Daftar Panitia</strong>
            </span>
          </div>

          <div class="password-input-wrap">
            <input 
              type="${this.showPanitiaPassword ? 'text' : 'password'}" 
              id="panitia-password-input" 
              class="search-input" 
              style="width: 100%; font-size: 1rem; padding: 13px 16px; padding-left: 42px; background: #0f172a;" 
              placeholder="Masukkan password jabatan Anda..." 
              value="${this.panitiaPassword}"
              oninput="Gateway.panitiaPassword = this.value"
              onkeydown="if(event.key === 'Enter') Gateway.submitLoginPanitia()"
              autocomplete="current-password"
            >
            <i class="fas fa-key" style="position: absolute; left: 14px; color: var(--text-dim); font-size: 0.95rem;"></i>
            <button type="button" class="password-toggle-btn" onclick="Gateway.togglePanitiaPasswordVisibility()" title="Lihat/Sembunyikan Password">
              <i class="fas ${this.showPanitiaPassword ? 'fa-eye-slash' : 'fa-eye'}" id="panitia-eye-icon"></i>
            </button>
          </div>
        </div>

        <!-- Error display box -->
        <div id="login-panitia-error" style="display: none; padding: 10px 14px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: var(--radius-sm); color: #fca5a5; font-size: 0.85rem; margin-bottom: 18px;"></div>

        <!-- Submit Button -->
        <button 
          class="btn btn-primary" 
          style="width: 100%; padding: 14px; font-size: 1rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;"
          onclick="Gateway.submitLoginPanitia()"
          ${this.loadingPanitia ? 'disabled' : ''}
        >
          ${this.loadingPanitia ? '<i class="fas fa-spinner fa-spin"></i> Memverifikasi...' : '<i class="fas fa-sign-in-alt"></i> Masuk sebagai Panitia'}
        </button>
      </div>
    `;
  },

  renderPesertaForm() {
    return `
      <div class="glass-card" style="padding: 28px; text-align: left; box-shadow: var(--shadow-lg); border: 1px solid rgba(6, 182, 212, 0.25);">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 18px; border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
          <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: rgba(6, 182, 212, 0.2); color: #67e8f9; display: flex; align-items: center; justify-content: center;">
            <i class="fas fa-user-graduate"></i>
          </div>
          <div>
            <h3 style="font-size: 1.15rem; color: white;">Portal Masuk Peserta KI23</h3>
            <p style="font-size: 0.8rem; color: var(--text-muted);">Pilih Divisi Profesi dan Kelompok Tabmin Anda, lalu masukkan password.</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px;">
          <!-- 1. Pilih Divisi Profesi -->
          <div>
            <label style="display: block; font-size: 0.88rem; font-weight: 700; color: white; margin-bottom: 8px;">
              1. Divisi Profesi:
            </label>
            <select 
              class="custom-select" 
              style="width: 100%; padding: 12px 14px; font-size: 0.95rem; background: #0f172a;"
              onchange="Gateway.selectedProfession = this.value"
            >
              ${this.professions.map(p => `
                <option value="${p}" ${this.selectedProfession === p ? 'selected' : ''}>${p}</option>
              `).join('')}
            </select>
          </div>

          <!-- 2. Pilih Kelompok Tabmin -->
          <div>
            <label style="display: block; font-size: 0.88rem; font-weight: 700; color: white; margin-bottom: 8px;">
              2. Kelompok Tabmin:
            </label>
            <select 
              class="custom-select" 
              style="width: 100%; padding: 12px 14px; font-size: 0.95rem; background: #0f172a;"
              onchange="Gateway.selectedGroup = this.value"
            >
              ${this.tabminGroups.map(g => `
                <option value="${g}" ${this.selectedGroup === g ? 'selected' : ''}>${g}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- 3. Input Password Peserta -->
        <div style="margin-bottom: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label style="font-size: 0.88rem; font-weight: 700; color: white;">
              3. Masukkan Password Peserta:
            </label>
            <span style="font-size: 0.75rem; color: var(--text-dim);">
              <i class="fas fa-file-excel" style="color: #06b6d4;"></i> Dilihat di file <strong>Pengumuman Tahap 1 KI23</strong>
            </span>
          </div>

          <div class="password-input-wrap">
            <input 
              type="${this.showPesertaPassword ? 'text' : 'password'}" 
              id="peserta-password-input" 
              class="search-input" 
              style="width: 100%; font-size: 1rem; padding: 13px 16px; padding-left: 42px; background: #0f172a;" 
              placeholder="Contoh: NFN123, YTA123, EF123..." 
              value="${this.pesertaPassword}"
              oninput="Gateway.pesertaPassword = this.value"
              onkeydown="if(event.key === 'Enter') Gateway.submitLoginPeserta()"
              autocomplete="current-password"
            >
            <i class="fas fa-lock" style="position: absolute; left: 14px; color: var(--text-dim); font-size: 0.95rem;"></i>
            <button type="button" class="password-toggle-btn" onclick="Gateway.togglePesertaPasswordVisibility()" title="Lihat/Sembunyikan Password">
              <i class="fas ${this.showPesertaPassword ? 'fa-eye-slash' : 'fa-eye'}" id="peserta-eye-icon"></i>
            </button>
          </div>
        </div>

        <!-- Notice Peserta Isolation -->
        <div style="background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 20px; font-size: 0.82rem; color: #a5f3fc; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-user-secret" style="font-size: 1.1rem; color: #67e8f9;"></i>
          <div>
            <strong>Kerahasiaan Mutlak Peserta:</strong> Anda hanya dapat melakukan penilaian <em>Peer Review</em> untuk rekan satu kelompok Tabmin Anda, tanpa dapat melihat nilai-nilai lainnya.
          </div>
        </div>

        <!-- Error display box -->
        <div id="login-peserta-error" style="display: none; padding: 10px 14px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: var(--radius-sm); color: #fca5a5; font-size: 0.85rem; margin-bottom: 18px;"></div>

        <!-- Submit Button -->
        <button 
          class="btn btn-secondary" 
          style="width: 100%; padding: 14px; font-size: 1rem; font-weight: 700; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: white; display: flex; align-items: center; justify-content: center; gap: 8px;"
          onclick="Gateway.submitLoginPeserta()"
          ${this.loadingPeserta ? 'disabled' : ''}
        >
          ${this.loadingPeserta ? '<i class="fas fa-spinner fa-spin"></i> Memverifikasi...' : '<i class="fas fa-sign-in-alt"></i> Masuk sebagai Peserta'}
        </button>
      </div>
    `;
  }
};
