// Main Application Controller & Role-Based Navigation Router

const App = {
  currentUser: null,
  activeView: 'gateway', // 'gateway', 'admin', 'recap', 'profesi', 'tabmin', 'wali', 'peer'

  async init() {
    await this.restoreSession();
    this.setupView();
  },

  async restoreSession() {
    const token = localStorage.getItem('ki23_token');
    if (token) {
      try {
        const res = await API.get('/api/auth/me');
        this.currentUser = res.user;
      } catch {
        localStorage.removeItem('ki23_token');
        this.currentUser = null;
      }
    } else {
      this.currentUser = null;
    }

    this.renderNavbar();
  },

  async logout() {
    try {
      await API.post('/api/auth/logout', {});
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem('ki23_token');
    this.currentUser = null;
    this.renderNavbar();
    this.navigate('gateway');
    showToast('Sesi berakhir. Silakan login kembali di portal.', 'info');
  },

  renderNavbar() {
    const user = this.currentUser;

    const nameEl = document.getElementById('navbar-user-name');
    const roleEl = document.getElementById('navbar-user-role');
    const avatarEl = document.getElementById('navbar-user-avatar');
    const badgeEl = document.getElementById('current-user-badge');

    if (!user) {
      if (nameEl) nameEl.textContent = 'Belum Masuk';
      if (roleEl) roleEl.textContent = 'Silakan pilih login Panitia / Peserta';
      if (avatarEl) avatarEl.textContent = 'KI';
      if (badgeEl) {
        badgeEl.style.cursor = 'default';
        badgeEl.onclick = null;
      }
    } else {
      if (nameEl) nameEl.textContent = user.full_name;
      if (roleEl) {
        const roleMap = {
          'teknisi': 'Teknisi (Super Admin)',
          'kepala_sekolah': 'Kepala Sekolah (Read-Only)',
          'wakil_kepala': 'Wakil Kepala Sekolah (Read-Only)',
          'supervisor': 'Supervisor (Read-Only)',
          'hrd_kepala': 'Kepala HRD',
          'hrd_kelompok_ketua': 'HRD Kelompok (Ketua)',
          'hrd_profesi': 'HRD Profesi',
          'hrd_kelompok': 'HRD Kelompok',
          'hrd_all': 'HRD Kelompok & Profesi',
          'wali_kelas': `Wali Kelas ${user.assigned_profession || ''}`,
          'pjk': `PJK (${user.assigned_group || ''})`,
          'peserta': `Peserta (${user.assigned_group || ''})`
        };
        roleEl.textContent = roleMap[user.role] || user.role;
      }
      if (avatarEl) {
        const initials = (user.full_name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        avatarEl.textContent = initials;
      }
    }

    // Render Navigation Links according to RBAC
    const menuEl = document.getElementById('nav-menu-links');
    if (!menuEl) return;

    let linksHtml = '';

    if (!user) {
      linksHtml += `
        <div class="nav-link ${this.activeView === 'gateway' ? 'active' : ''}" onclick="App.navigate('gateway')">
          <i class="fas fa-sign-in-alt"></i> Portal Masuk
        </div>
      `;
    }

    if (user) {
      const role = user.role;

      if (role === 'teknisi') {
        linksHtml += `
          <div class="nav-link ${this.activeView === 'admin' ? 'active' : ''}" onclick="App.navigate('admin')">
            <i class="fas fa-tools"></i> Panel Teknisi
          </div>
          <div class="nav-link ${this.activeView === 'recap' ? 'active' : ''}" onclick="App.navigate('recap')">
            <i class="fas fa-chart-pie"></i> Rekapitulasi Nilai
          </div>
          <div class="nav-link ${this.activeView === 'profesi' ? 'active' : ''}" onclick="App.navigate('profesi')">
            <i class="fas fa-graduation-cap"></i> Penilaian Profesi
          </div>
          <div class="nav-link ${this.activeView === 'tabmin' ? 'active' : ''}" onclick="App.navigate('tabmin')">
            <i class="fas fa-users-cog"></i> Penilaian Tabmin
          </div>
        `;
      } else if (role === 'kepala_sekolah' || role === 'wakil_kepala' || role === 'supervisor') {
        linksHtml += `
          <div class="nav-link ${this.activeView === 'recap' ? 'active' : ''}" onclick="App.navigate('recap')">
            <i class="fas fa-chart-pie"></i> Rekapitulasi Nilai (Read-Only)
          </div>
        `;
      } else if (role === 'hrd_kepala' || role === 'hrd_all') {
        linksHtml += `
          <div class="nav-link ${this.activeView === 'recap' ? 'active' : ''}" onclick="App.navigate('recap')">
            <i class="fas fa-chart-pie"></i> Rekapitulasi Nilai
          </div>
          <div class="nav-link ${this.activeView === 'profesi' ? 'active' : ''}" onclick="App.navigate('profesi')">
            <i class="fas fa-graduation-cap"></i> Penilaian Profesi
          </div>
          <div class="nav-link ${this.activeView === 'tabmin' ? 'active' : ''}" onclick="App.navigate('tabmin')">
            <i class="fas fa-users-cog"></i> Penilaian Tabmin
          </div>
        `;
      } else if (role === 'hrd_profesi') {
        linksHtml += `
          <div class="nav-link ${this.activeView === 'recap' ? 'active' : ''}" onclick="App.navigate('recap')">
            <i class="fas fa-chart-pie"></i> Rekapitulasi Nilai
          </div>
          <div class="nav-link ${this.activeView === 'profesi' ? 'active' : ''}" onclick="App.navigate('profesi')">
            <i class="fas fa-graduation-cap"></i> Penilaian Profesi
          </div>
        `;
      } else if (role === 'hrd_kelompok' || role === 'hrd_kelompok_ketua') {
        linksHtml += `
          <div class="nav-link ${this.activeView === 'recap' ? 'active' : ''}" onclick="App.navigate('recap')">
            <i class="fas fa-chart-pie"></i> Rekapitulasi Nilai
          </div>
          <div class="nav-link ${this.activeView === 'tabmin' ? 'active' : ''}" onclick="App.navigate('tabmin')">
            <i class="fas fa-users-cog"></i> Penilaian Tabmin
          </div>
        `;
      } else if (role === 'wali_kelas') {
        linksHtml += `
          <div class="nav-link ${this.activeView === 'wali' ? 'active' : ''}" onclick="App.navigate('wali')">
            <i class="fas fa-chalkboard-teacher"></i> Form Penilaian Isi Tugas (${user.assigned_profession || 'Semua'})
          </div>
        `;
      } else if (role === 'pjk') {
        linksHtml += `
          <div class="nav-link ${this.activeView === 'tabmin' ? 'active' : ''}" onclick="App.navigate('tabmin')">
            <i class="fas fa-user-check"></i> Form Nilai Kelompok (${user.assigned_group || 'Kelompok'})
          </div>
        `;
      } else if (role === 'peserta') {
        linksHtml += `
          <div class="nav-link ${this.activeView === 'peer' ? 'active' : ''}" onclick="App.navigate('peer')">
            <i class="fas fa-user-friends"></i> Peer Review Rekan (${user.assigned_group || ''})
          </div>
        `;
      }

      // Add logout button
      linksHtml += `
        <div class="nav-link" onclick="App.logout()" style="color: #fca5a5; cursor: pointer;">
          <i class="fas fa-sign-out-alt"></i> Keluar
        </div>
      `;
    }

    menuEl.innerHTML = linksHtml;
  },

  setupView() {
    if (!this.currentUser) {
      this.navigate('gateway');
      return;
    }

    const role = this.currentUser.role;
    if (role === 'teknisi') {
      this.navigate('admin');
    } else if (role === 'wali_kelas') {
      this.navigate('wali');
    } else if (role === 'pjk') {
      this.navigate('tabmin');
    } else if (role === 'peserta') {
      this.navigate('peer');
    } else {
      this.navigate('recap');
    }
  },

  navigate(viewName) {
    if (!this.currentUser && viewName !== 'gateway') {
      viewName = 'gateway';
    }

    if (this.currentUser) {
      const roleViews = {
        teknisi: ['admin', 'recap', 'profesi', 'tabmin'],
        kepala_sekolah: ['recap'],
        wakil_kepala: ['recap'],
        supervisor: ['recap'],
        hrd_kepala: ['recap', 'profesi', 'tabmin'],
        hrd_profesi: ['recap', 'profesi'],
        hrd_kelompok: ['recap', 'tabmin'],
        hrd_kelompok_ketua: ['recap', 'tabmin'],
        hrd_all: ['recap', 'profesi', 'tabmin'],
        wali_kelas: ['wali'],
        pjk: ['tabmin'],
        peserta: ['peer']
      };
      const allowed = roleViews[this.currentUser.role] || [];
      if (!allowed.includes(viewName)) {
        viewName = this.currentUser.role === 'teknisi' ? 'admin'
          : this.currentUser.role === 'wali_kelas' ? 'wali'
          : this.currentUser.role === 'pjk' ? 'tabmin'
          : this.currentUser.role === 'peserta' ? 'peer'
          : 'recap';
      }
    }

    this.activeView = viewName;
    this.renderNavbar();

    const content = document.getElementById('view-content');
    if (!content) return;
    content.innerHTML = '<div style="text-align: center; padding: 50px;"><i class="fas fa-spinner fa-spin fa-2x" style="color: var(--primary);"></i></div>';

    if (viewName === 'gateway') {
      Gateway.init();
    } else if (viewName === 'admin') {
      AdminPanel.init();
    } else if (viewName === 'recap') {
      Dashboard.init();
    } else if (viewName === 'profesi') {
      FormProfesi.init();
    } else if (viewName === 'tabmin') {
      FormTabmin.init();
    } else if (viewName === 'wali') {
      FormWali.init();
    } else if (viewName === 'peer') {
      FormPeer.init();
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
