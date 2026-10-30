// Admin Panel for Teknisi KI23
// Full CRUD permissions: Participant list, Tabmin group assignments, and Staff / User Management

const AdminPanel = {
  currentTab: 'participants', // 'participants', 'tabmin_groups', or 'staff'
  professionFilter: 'ALL',
  groupFilter: 'ALL',
  staffRoleFilter: 'ALL',
  searchQuery: '',
  staffSearchQuery: '',
  participants: [],
  tabminGroups: [],
  staffList: [],

  // Active editing participant / staff
  editingParticipant: null,
  editingStaff: null,

  async init() {
    if (this.currentTab === 'tabmin_groups') {
      await this.loadTabminOverview();
    } else if (this.currentTab === 'staff') {
      await this.loadStaff();
    } else {
      await this.loadParticipants();
    }
    this.render();
  },

  async loadParticipants() {
    try {
      let url = `/api/admin/participants?profession=${encodeURIComponent(this.professionFilter)}&group=${encodeURIComponent(this.groupFilter)}`;
      if (this.searchQuery) {
        url += `&search=${encodeURIComponent(this.searchQuery)}`;
      }
      const res = await API.get(url);
      this.participants = res.participants || [];
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat daftar peserta: ' + err.message, 'error');
    }
  },

  async loadTabminOverview() {
    try {
      const res = await API.get('/api/admin/tabmin-overview');
      this.tabminGroups = res.groups || [];
    } catch (err) {
      console.error(err);
    }
  },

  async loadStaff() {
    try {
      const res = await API.get('/api/admin/staff');
      this.staffList = res.staff || [];
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat data staf/panitia: ' + err.message, 'error');
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    if (tab === 'tabmin_groups') {
      this.loadTabminOverview().then(() => this.render());
    } else if (tab === 'staff') {
      this.loadStaff().then(() => this.render());
    } else {
      this.loadParticipants().then(() => this.render());
    }
  },

  render() {
    const container = document.getElementById('view-content');
    if (!container) return;

    container.innerHTML = `
      <div class="glass-card" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="demo-pill" style="background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5;">
                <i class="fas fa-tools"></i> Khusus Teknisi
              </span>
              <h2 style="font-size: 1.5rem; color: white;">Panel Manajemen Sistem KI23</h2>
            </div>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">
              Hak akses penuh super admin: kelola panitia, jurusan peserta, pembagian anggota Tabmin, dan penilaian.
            </p>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn ${this.currentTab === 'staff' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminPanel.switchTab('staff')">
              <i class="fas fa-user-shield"></i> Kelola Panitia & User (${this.staffList.length})
            </button>
            <button class="btn ${this.currentTab === 'participants' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminPanel.switchTab('participants')">
              <i class="fas fa-users-cog"></i> Daftar Peserta & Jurusan
            </button>
            <button class="btn ${this.currentTab === 'tabmin_groups' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminPanel.switchTab('tabmin_groups')">
              <i class="fas fa-layer-group"></i> Anggota Kelompok Tabmin
            </button>
          </div>
        </div>
      </div>

      ${this.renderActiveTabContent()}

      <!-- Universal Modal (Participants / Staff) -->
      <div id="admin-modal" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="admin-modal-title" style="color: white; font-size: 1.25rem;">Modal Title</h3>
            <button class="modal-close" onclick="AdminPanel.closeModal()">&times;</button>
          </div>
          <div id="admin-modal-body">
            <!-- Form populated dynamically -->
          </div>
        </div>
      </div>
    `;

    if (this.currentTab === 'participants') {
      this.attachParticipantTable();
    } else if (this.currentTab === 'staff') {
      this.attachStaffTable();
    }
  },

  renderActiveTabContent() {
    if (this.currentTab === 'staff') {
      return this.renderStaffView();
    } else if (this.currentTab === 'tabmin_groups') {
      return this.renderTabminGroupsView();
    } else {
      return this.renderParticipantsView();
    }
  },

  // =========================================================================
  // TAB 1: STAFF & USER MANAGEMENT (NEW & CORE)
  // =========================================================================
  renderStaffView() {
    // Stats calculation
    const totalStaff = this.staffList.length;
    const countTeknisi = this.staffList.filter(s => s.role === 'teknisi').length;
    const countKepala = this.staffList.filter(s => s.role === 'kepala_sekolah' || s.role === 'wakil_kepala' || s.role === 'supervisor').length;
    const countHRD = this.staffList.filter(s => s.role.startsWith('hrd')).length;
    const countWali = this.staffList.filter(s => s.role === 'wali_kelas').length;
    const countPJK = this.staffList.filter(s => s.role === 'pjk').length;

    return `
      <!-- Stats Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 20px;">
        <div class="glass-card" style="padding: 14px 18px; border-left: 3px solid var(--primary);">
          <div style="font-size: 0.78rem; color: var(--text-muted);">Total Panitia</div>
          <div style="font-size: 1.6rem; font-weight: 800; color: white;">${totalStaff}</div>
        </div>
        <div class="glass-card" style="padding: 14px 18px; border-left: 3px solid #ef4444;">
          <div style="font-size: 0.78rem; color: #fca5a5;">Teknisi</div>
          <div style="font-size: 1.6rem; font-weight: 800; color: white;">${countTeknisi}</div>
        </div>
        <div class="glass-card" style="padding: 14px 18px; border-left: 3px solid #38bdf8;">
          <div style="font-size: 0.78rem; color: #7dd3fc;">Kepala & Wakil</div>
          <div style="font-size: 1.6rem; font-weight: 800; color: white;">${countKepala}</div>
        </div>
        <div class="glass-card" style="padding: 14px 18px; border-left: 3px solid #f59e0b;">
          <div style="font-size: 0.78rem; color: #fcd34d;">Tim HRD</div>
          <div style="font-size: 1.6rem; font-weight: 800; color: white;">${countHRD}</div>
        </div>
        <div class="glass-card" style="padding: 14px 18px; border-left: 3px solid #10b981;">
          <div style="font-size: 0.78rem; color: #6ee7b7;">Wali Kelas</div>
          <div style="font-size: 1.6rem; font-weight: 800; color: white;">${countWali}</div>
        </div>
        <div class="glass-card" style="padding: 14px 18px; border-left: 3px solid #14b8a6;">
          <div style="font-size: 0.78rem; color: #5eead4;">PJK</div>
          <div style="font-size: 1.6rem; font-weight: 800; color: white;">${countPJK}</div>
        </div>
      </div>

      <div class="glass-card">
        <div class="toolbar" style="margin-bottom: 20px;">
          <div class="filter-group">
            <input 
              type="text" 
              class="search-input" 
              placeholder="Cari nama panitia atau username..." 
              value="${this.staffSearchQuery}" 
              oninput="AdminPanel.onStaffSearch(this.value)"
            >
            
            <select class="custom-select" onchange="AdminPanel.onStaffRoleFilter(this.value)">
              <option value="ALL" ${this.staffRoleFilter === 'ALL' ? 'selected' : ''}>Semua Posisi / Role</option>
              <option value="teknisi" ${this.staffRoleFilter === 'teknisi' ? 'selected' : ''}>Teknisi</option>
              <option value="kepala_sekolah" ${this.staffRoleFilter === 'kepala_sekolah' ? 'selected' : ''}>Kepala Sekolah</option>
              <option value="wakil_kepala" ${this.staffRoleFilter === 'wakil_kepala' ? 'selected' : ''}>Wakil Kepala Sekolah</option>
              <option value="hrd_kepala" ${this.staffRoleFilter === 'hrd_kepala' ? 'selected' : ''}>Kepala HRD</option>
              <option value="hrd_kelompok_ketua" ${this.staffRoleFilter === 'hrd_kelompok_ketua' ? 'selected' : ''}>HRD Kelompok (Ketua)</option>
              <option value="hrd_profesi" ${this.staffRoleFilter === 'hrd_profesi' ? 'selected' : ''}>HRD Profesi</option>
              <option value="hrd_kelompok" ${this.staffRoleFilter === 'hrd_kelompok' ? 'selected' : ''}>HRD Kelompok</option>
              <option value="hrd_all" ${this.staffRoleFilter === 'hrd_all' ? 'selected' : ''}>HRD Kelompok & Profesi</option>
              <option value="wali_kelas" ${this.staffRoleFilter === 'wali_kelas' ? 'selected' : ''}>Wali Kelas</option>
              <option value="pjk" ${this.staffRoleFilter === 'pjk' ? 'selected' : ''}>PJK</option>
            </select>
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary" onclick="AdminPanel.syncPanitiaFromExcel()" title="Sinkronkan ulang dari berkas Pakai Daftar Ini Ya.xlsx">
              <i class="fas fa-sync-alt"></i> Sinkron Excel
            </button>
            <button class="btn btn-primary" onclick="AdminPanel.openAddStaffModal()">
              <i class="fas fa-user-plus"></i> + Tambah Panitia / User
            </button>
          </div>
        </div>

        <div id="staff-table-container"></div>
      </div>
    `;
  },

  attachStaffTable() {
    const container = document.getElementById('staff-table-container');
    if (!container) return;

    let filtered = this.staffList;
    if (this.staffRoleFilter !== 'ALL') {
      filtered = filtered.filter(s => {
        if (this.staffRoleFilter === 'kepala_sekolah') return s.role === 'kepala_sekolah' || s.role === 'supervisor';
        return s.role === this.staffRoleFilter;
      });
    }
    if (this.staffSearchQuery) {
      const q = this.staffSearchQuery.toLowerCase();
      filtered = filtered.filter(s => s.full_name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q));
    }

    if (!filtered.length) {
      container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-dim);">Tidak ada panitia yang sesuai dengan filter.</div>`;
      return;
    }

    const roleBadges = {
      'teknisi': { label: 'Teknisi (Super Admin)', bg: '#ef444422', border: '#ef444455', color: '#fca5a5', hak: 'Lihat & Edit Semua Nilai + Akses Panel' },
      'kepala_sekolah': { label: 'Kepala Sekolah', bg: '#38bdf822', border: '#38bdf855', color: '#7dd3fc', hak: 'Lihat Seluruh Nilai (Read-Only)' },
      'wakil_kepala': { label: 'Wakil Kepala Sekolah', bg: '#0ea5e922', border: '#0ea5e955', color: '#38bdf8', hak: 'Lihat Seluruh Nilai (Read-Only)' },
      'supervisor': { label: 'Kepala Sekolah (Supervisor)', bg: '#38bdf822', border: '#38bdf855', color: '#7dd3fc', hak: 'Lihat Seluruh Nilai (Read-Only)' },
      'hrd_kepala': { label: 'Kepala HRD', bg: '#f59e0b22', border: '#f59e0b55', color: '#fcd34d', hak: 'Lihat & Edit Semua Nilai Profesi & Tabmin' },
      'hrd_kelompok_ketua': { label: 'HRD Kelompok (Ketua)', bg: '#6366f122', border: '#6366f155', color: '#a5b4fc', hak: 'Lihat Semua Nilai, Hanya Edit Tabmin (Ketua)' },
      'hrd_profesi': { label: 'HRD Profesi', bg: '#ec489922', border: '#ec489955', color: '#f472b6', hak: 'Lihat Semua, Hanya Edit Kelas Profesi' },
      'hrd_kelompok': { label: 'HRD Kelompok', bg: '#8b5cf622', border: '#8b5cf655', color: '#c4b5fd', hak: 'Lihat Semua, Hanya Edit Tabmin' },
      'hrd_all': { label: 'HRD Kelompok & Profesi', bg: '#a855f722', border: '#a855f755', color: '#d8b4fe', hak: 'Edit nilai untuk kelompok atau profesi yang ditugaskan' },
      'wali_kelas': { label: 'Wali Kelas', bg: '#10b98122', border: '#10b98155', color: '#6ee7b7', hak: 'Hanya Edit Tugas & Pengganti (Isolasi HRD)' },
      'pjk': { label: 'PJK', bg: '#14b8a622', border: '#14b8a655', color: '#5eead4', hak: 'Hanya Edit Tabmin Kelompoknya (Isolasi HRD)' }
    };

    const rowsHtml = filtered.map((s, idx) => {
      const badge = roleBadges[s.role] || { label: s.role, bg: '#ffffff15', border: '#ffffff30', color: '#cbd5e1', hak: 'Akses Standar' };
      const safeName = s.full_name.replace(/'/g, "\\'");

      return `
        <tr>
          <td style="text-align: center; color: var(--text-dim);">${idx + 1}</td>
          <td>
            <div style="font-weight: 700; color: white;">${s.full_name}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim); font-family: monospace;">Username: @${s.username}</div>
          </td>
          <td>
            <span class="badge" style="background: ${badge.bg}; border: 1px solid ${badge.border}; color: ${badge.color}; font-size: 0.78rem;">
              ${badge.label}
            </span>
          </td>
          <td>
            ${s.assigned_profession ? `<span class="badge badge-profesi">${s.assigned_profession}</span>` : ''}
            ${s.assigned_group ? `<span class="badge badge-group">${s.assigned_group}</span>` : ''}
            ${!s.assigned_profession && !s.assigned_group ? '<span style="color: var(--text-dim); font-size: 0.8rem;">-</span>' : ''}
          </td>
          <td style="font-size: 0.82rem; color: var(--text-muted);">${badge.hak}</td>
          <td style="text-align: center; white-space: nowrap;">
            <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.78rem; margin-right: 6px;" onclick="AdminPanel.openEditStaffModal(${s.id})">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.78rem; color: #fca5a5; border-color: rgba(239, 68, 68, 0.3);" onclick="AdminPanel.deleteStaff(${s.id}, '${safeName}')">
              <i class="fas fa-trash-alt"></i> Hapus
            </button>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th style="text-align: center;">No</th>
              <th>Nama Panitia / User</th>
              <th>Posisi / Role</th>
              <th>Penugasan</th>
              <th>Hak Akses Penilaian</th>
              <th style="text-align: center;">Aksi Teknisi</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  },

  onStaffSearch(val) {
    this.staffSearchQuery = val;
    this.attachStaffTable();
  },

  onStaffRoleFilter(val) {
    this.staffRoleFilter = val;
    this.attachStaffTable();
  },

  openAddStaffModal() {
    this.editingStaff = null;
    const modal = document.getElementById('admin-modal');
    const title = document.getElementById('admin-modal-title');
    const body = document.getElementById('admin-modal-body');
    if (!modal || !body) return;

    title.innerHTML = '<i class="fas fa-user-plus" style="color: var(--primary);"></i> Tambah Panitia / User Baru';
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Nama Lengkap Panitia *</label>
          <input type="text" id="staff-name" class="search-input" style="width: 100%;" placeholder="Contoh: Dra. Siti Rahmah, M.Pd (atau nama Wakil Kepala Sekolah)">
        </div>

        <div>
          <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Posisi / Role Panitia *</label>
          <select id="staff-role" class="custom-select" style="width: 100%;" onchange="AdminPanel.toggleStaffAssignmentFields(this.value)">
            <option value="wakil_kepala">Wakil Kepala Sekolah (Supervisor - Read-Only)</option>
            <option value="kepala_sekolah">Kepala Sekolah (Supervisor - Read-Only)</option>
            <option value="teknisi">Teknisi (Super Admin - Akses Penuh)</option>
            <option value="hrd_kepala">Kepala HRD (Edit Semua Nilai)</option>
            <option value="hrd_kelompok_ketua">HRD Kelompok (Ketua - Lihat Semua, Hanya Edit Tabmin)</option>
            <option value="hrd_profesi">HRD Profesi (Hanya Edit Kelas Profesi)</option>
            <option value="hrd_kelompok">HRD Kelompok (Hanya Edit Tabmin)</option>
            <option value="hrd_all">HRD Kelompok & Profesi (Edit Semua Nilai)</option>
            <option value="wali_kelas">Wali Kelas (Hanya Edit Tugas & Pengganti, Isolasi HRD)</option>
            <option value="pjk">PJK (Hanya Edit Tabmin Kelompoknya, Isolasi HRD)</option>
          </select>
        </div>

        <!-- Dynamic Profession Assignment Picker -->
        <div id="staff-profession-field" style="display: none;">
          <label id="staff-profession-label" style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Penugasan Divisi Profesi</label>
          <select id="staff-prof" class="custom-select" style="width: 100%;">
            <option value="">Pilih profesi...</option>
            <option value="Reporter">Reporter</option>
            <option value="Fotografer">Fotografer</option>
            <option value="Ilustrator">Ilustrator</option>
            <option value="Layouter">Layouter</option>
            <option value="Marcomm">Marcomm</option>
            <option value="ALL">Semua Profesi</option>
          </select>
        </div>

        <!-- Dynamic Group Assignment Picker -->
        <div id="staff-group-field" style="display: none;">
          <label id="staff-group-label" style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Penugasan Kelompok Tabmin</label>
          <select id="staff-group" class="custom-select" style="width: 100%;">
            <option value="">Pilih kelompok...</option>
            <option value="Kelompok 1">Kelompok 1</option>
            <option value="Kelompok 2">Kelompok 2</option>
            <option value="Kelompok 3">Kelompok 3</option>
            <option value="Kelompok 4">Kelompok 4</option>
            <option value="Kelompok 5">Kelompok 5</option>
            <option value="Kelompok 6">Kelompok 6</option>
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div>
            <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Username (Opsional)</label>
            <input type="text" id="staff-username" class="search-input" style="width: 100%;" placeholder="Otomatis jika kosong">
          </div>
          <div>
            <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Password</label>
            <input type="text" id="staff-password" class="search-input" style="width: 100%;" placeholder="Default: password123" value="password123">
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 14px;">
          <button class="btn btn-primary" style="flex: 1;" onclick="AdminPanel.submitAddStaff()">
            <i class="fas fa-save"></i> Simpan Panitia Baru
          </button>
          <button class="btn btn-secondary" onclick="AdminPanel.closeModal()">Batal</button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    this.toggleStaffAssignmentFields(document.getElementById('staff-role').value);
  },

  toggleStaffAssignmentFields(role) {
    const profField = document.getElementById('staff-profession-field');
    const grpField = document.getElementById('staff-group-field');
    const professionRoles = ['wali_kelas', 'hrd_profesi', 'hrd_all'];
    const groupRoles = ['pjk', 'hrd_kelompok', 'hrd_all'];
    if (profField) profField.style.display = professionRoles.includes(role) ? 'block' : 'none';
    if (grpField) grpField.style.display = groupRoles.includes(role) ? 'block' : 'none';

    const profLabel = document.getElementById('staff-profession-label');
    const groupLabel = document.getElementById('staff-group-label');
    if (profLabel) {
      profLabel.textContent = role === 'wali_kelas'
        ? 'Penugasan Divisi Profesi Wali Kelas'
        : 'Penugasan Divisi Profesi HRD';
    }
    if (groupLabel) {
      groupLabel.textContent = role === 'pjk'
        ? 'Penugasan Kelompok Tabmin PJK'
        : 'Penugasan Kelompok Tabmin HRD';
    }

    const allProfessionOption = document.querySelector('#staff-prof option[value="ALL"]');
    const profSelect = document.getElementById('staff-prof');
    if (allProfessionOption) allProfessionOption.hidden = role !== 'wali_kelas';
    if (profSelect && role !== 'wali_kelas' && profSelect.value === 'ALL') profSelect.value = '';
  },

  async submitAddStaff() {
    const name = document.getElementById('staff-name').value.trim();
    const role = document.getElementById('staff-role').value;
    const username = document.getElementById('staff-username').value.trim();
    const password = document.getElementById('staff-password').value.trim() || 'password123';
    
    let assignedGroup = null;
    let assignedProf = null;
    if (['wali_kelas', 'hrd_profesi', 'hrd_all'].includes(role)) {
      assignedProf = document.getElementById('staff-prof').value;
    }
    if (['pjk', 'hrd_kelompok', 'hrd_all'].includes(role)) {
      assignedGroup = document.getElementById('staff-group').value;
    }

    if (!name) {
      showToast('Nama lengkap panitia wajib diisi.', 'warning');
      return;
    }
    if (['hrd_profesi', 'hrd_all'].includes(role) && !assignedProf) {
      showToast('Profesi penugasan HRD wajib dipilih.', 'warning');
      return;
    }
    if (['pjk', 'hrd_kelompok', 'hrd_all'].includes(role) && !assignedGroup) {
      showToast('Kelompok penugasan wajib dipilih.', 'warning');
      return;
    }

    try {
      const res = await API.post('/api/admin/staff', {
        full_name: name,
        role: role,
        username: username || null,
        password: password,
        assigned_group: assignedGroup,
        assigned_profession: assignedProf
      });
      showToast(res.message, 'success');
      this.closeModal();
      await this.loadStaff();
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  openEditStaffModal(staffId) {
    const staff = this.staffList.find(s => s.id === staffId);
    if (!staff) return;
    this.editingStaff = staff;

    const modal = document.getElementById('admin-modal');
    const title = document.getElementById('admin-modal-title');
    const body = document.getElementById('admin-modal-body');
    if (!modal || !body) return;

    title.innerHTML = `<i class="fas fa-user-edit" style="color: var(--secondary);"></i> Edit Panitia: ${staff.full_name}`;
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Nama Lengkap Panitia *</label>
          <input type="text" id="edit-staff-name" class="search-input" style="width: 100%;" value="${staff.full_name}">
        </div>

        <div>
          <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Posisi / Role *</label>
          <select id="edit-staff-role" class="custom-select" style="width: 100%;" onchange="AdminPanel.toggleStaffAssignmentFields(this.value)">
            <option value="teknisi" ${staff.role === 'teknisi' ? 'selected' : ''}>Teknisi (Super Admin - Akses Penuh)</option>
            <option value="kepala_sekolah" ${staff.role === 'kepala_sekolah' || staff.role === 'supervisor' ? 'selected' : ''}>Kepala Sekolah (Supervisor - Read-Only)</option>
            <option value="wakil_kepala" ${staff.role === 'wakil_kepala' ? 'selected' : ''}>Wakil Kepala Sekolah (Supervisor - Read-Only)</option>
            <option value="hrd_kepala" ${staff.role === 'hrd_kepala' ? 'selected' : ''}>Kepala HRD (Edit Semua Nilai)</option>
            <option value="hrd_kelompok_ketua" ${staff.role === 'hrd_kelompok_ketua' ? 'selected' : ''}>HRD Kelompok (Ketua - Lihat Semua, Hanya Edit Tabmin)</option>
            <option value="hrd_profesi" ${staff.role === 'hrd_profesi' ? 'selected' : ''}>HRD Profesi (Hanya Edit Kelas Profesi)</option>
            <option value="hrd_kelompok" ${staff.role === 'hrd_kelompok' ? 'selected' : ''}>HRD Kelompok (Hanya Edit Tabmin)</option>
            <option value="hrd_all" ${staff.role === 'hrd_all' ? 'selected' : ''}>HRD Kelompok & Profesi (Edit Semua Nilai)</option>
            <option value="wali_kelas" ${staff.role === 'wali_kelas' ? 'selected' : ''}>Wali Kelas (Hanya Edit Tugas & Pengganti, Isolasi HRD)</option>
            <option value="pjk" ${staff.role === 'pjk' ? 'selected' : ''}>PJK (Hanya Edit Tabmin Kelompoknya, Isolasi HRD)</option>
          </select>
        </div>

        <div id="staff-profession-field" style="display: ${['wali_kelas', 'hrd_profesi', 'hrd_all'].includes(staff.role) ? 'block' : 'none'};">
          <label id="staff-profession-label" style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">${staff.role === 'wali_kelas' ? 'Penugasan Divisi Profesi Wali Kelas' : 'Penugasan Divisi Profesi HRD'}</label>
          <select id="staff-prof" class="custom-select" style="width: 100%;">
            <option value="" ${!staff.assigned_profession ? 'selected' : ''}>Pilih profesi...</option>
            ${['Reporter', 'Fotografer', 'Ilustrator', 'Layouter', 'Marcomm'].map(prof => `
              <option value="${prof}" ${staff.assigned_profession === prof ? 'selected' : ''}>${prof}</option>
            `).join('')}
            <option value="ALL" ${staff.role === 'wali_kelas' && staff.assigned_profession === 'ALL' ? 'selected' : ''}>Semua Profesi</option>
          </select>
        </div>

        <div id="staff-group-field" style="display: ${['pjk', 'hrd_kelompok', 'hrd_all'].includes(staff.role) ? 'block' : 'none'};">
          <label id="staff-group-label" style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">${staff.role === 'pjk' ? 'Penugasan Kelompok Tabmin PJK' : 'Penugasan Kelompok Tabmin HRD'}</label>
          <select id="staff-group" class="custom-select" style="width: 100%;">
            <option value="" ${!staff.assigned_group ? 'selected' : ''}>Pilih kelompok...</option>
            ${['Kelompok 1', 'Kelompok 2', 'Kelompok 3', 'Kelompok 4', 'Kelompok 5', 'Kelompok 6'].map(grp => `
              <option value="${grp}" ${staff.assigned_group === grp ? 'selected' : ''}>${grp}</option>
            `).join('')}
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div>
            <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Username</label>
            <input type="text" id="edit-staff-username" class="search-input" style="width: 100%;" value="${staff.username}">
          </div>
          <div>
            <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Password Baru (Kosongkan jika tidak diubah)</label>
            <input type="password" id="edit-staff-password" class="search-input" style="width: 100%;" placeholder="Tetap seperti saat ini">
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 14px;">
          <button class="btn btn-primary" style="flex: 1;" onclick="AdminPanel.submitEditStaff(${staff.id})">
            <i class="fas fa-save"></i> Simpan Perubahan
          </button>
          <button class="btn btn-secondary" onclick="AdminPanel.closeModal()">Batal</button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    this.toggleStaffAssignmentFields(staff.role);
  },

  async submitEditStaff(staffId) {
    const name = document.getElementById('edit-staff-name').value.trim();
    const role = document.getElementById('edit-staff-role').value;
    const username = document.getElementById('edit-staff-username').value.trim();
    const password = document.getElementById('edit-staff-password').value.trim();

    let assignedGroup = null;
    let assignedProf = null;
    if (['wali_kelas', 'hrd_profesi', 'hrd_all'].includes(role)) {
      const el = document.getElementById('staff-prof');
      if (el) assignedProf = el.value;
    }
    if (['pjk', 'hrd_kelompok', 'hrd_all'].includes(role)) {
      const el = document.getElementById('staff-group');
      if (el) assignedGroup = el.value;
    }

    if (!name) {
      showToast('Nama lengkap panitia wajib diisi.', 'warning');
      return;
    }
    if (['hrd_profesi', 'hrd_all'].includes(role) && !assignedProf) {
      showToast('Profesi penugasan HRD wajib dipilih.', 'warning');
      return;
    }
    if (['pjk', 'hrd_kelompok', 'hrd_all'].includes(role) && !assignedGroup) {
      showToast('Kelompok penugasan wajib dipilih.', 'warning');
      return;
    }

    try {
      const res = await API.request(`/api/admin/staff/${staffId}`, {
        method: 'PUT',
        body: {
          full_name: name,
          role: role,
          username: username,
          password: password || null,
          assigned_group: assignedGroup || '',
          assigned_profession: assignedProf || ''
        }
      });
      showToast(res.message, 'success');
      this.closeModal();
      await this.loadStaff();
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async deleteStaff(staffId, staffName) {
    if (!confirm(`Apakah Anda yakin ingin menghapus akun panitia '${staffName}'?`)) {
      return;
    }

    try {
      const res = await API.request(`/api/admin/staff/${staffId}`, {
        method: 'DELETE'
      });
      showToast(res.message, 'success');
      await this.loadStaff();
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async syncPanitiaFromExcel() {
    if (!confirm('Apakah Anda ingin menyinkronkan ulang data panitia dari berkas Pakai Daftar Ini Ya.xlsx?')) {
      return;
    }

    try {
      const res = await API.post('/api/admin/sync-panitia', {});
      showToast(res.message, 'success');
      await this.loadStaff();
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // =========================================================================
  // TAB 2: PARTICIPANTS MANAGEMENT
  // =========================================================================
  renderParticipantsView() {
    return `
      <div class="glass-card">
        <div class="toolbar">
          <div class="filter-group">
            <input 
              type="text" 
              class="search-input" 
              placeholder="Cari nama, jurusan, profesi..." 
              value="${this.searchQuery}" 
              oninput="AdminPanel.onSearch(this.value)"
            >
            
            <select class="custom-select" onchange="AdminPanel.onProfFilter(this.value)">
              <option value="ALL" ${this.professionFilter === 'ALL' ? 'selected' : ''}>Semua Profesi</option>
              <option value="Ilustrator" ${this.professionFilter === 'Ilustrator' ? 'selected' : ''}>Ilustrator</option>
              <option value="Fotografer" ${this.professionFilter === 'Fotografer' ? 'selected' : ''}>Fotografer</option>
              <option value="Layouter" ${this.professionFilter === 'Layouter' ? 'selected' : ''}>Layouter</option>
              <option value="Marcomm" ${this.professionFilter === 'Marcomm' ? 'selected' : ''}>Marcomm</option>
              <option value="Reporter" ${this.professionFilter === 'Reporter' ? 'selected' : ''}>Reporter</option>
            </select>

            <select class="custom-select" onchange="AdminPanel.onGroupFilter(this.value)">
              <option value="ALL" ${this.groupFilter === 'ALL' ? 'selected' : ''}>Semua Kelompok Tabmin</option>
              <option value="Kelompok 1" ${this.groupFilter === 'Kelompok 1' ? 'selected' : ''}>Kelompok 1</option>
              <option value="Kelompok 2" ${this.groupFilter === 'Kelompok 2' ? 'selected' : ''}>Kelompok 2</option>
              <option value="Kelompok 3" ${this.groupFilter === 'Kelompok 3' ? 'selected' : ''}>Kelompok 3</option>
              <option value="Kelompok 4" ${this.groupFilter === 'Kelompok 4' ? 'selected' : ''}>Kelompok 4</option>
              <option value="Kelompok 5" ${this.groupFilter === 'Kelompok 5' ? 'selected' : ''}>Kelompok 5</option>
              <option value="Kelompok 6" ${this.groupFilter === 'Kelompok 6' ? 'selected' : ''}>Kelompok 6</option>
            </select>
          </div>

          <button class="btn btn-primary" onclick="AdminPanel.openAddModal()">
            <i class="fas fa-user-plus"></i> + Daftarkan Peserta Baru
          </button>
        </div>

        <div id="admin-table-container"></div>
      </div>
    `;
  },

  attachParticipantTable() {
    const container = document.getElementById('admin-table-container');
    if (!container) return;

    if (!this.participants.length) {
      container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-dim);">Tidak ada data peserta yang cocok.</div>`;
      return;
    }

    const rowsHtml = this.participants.map((p, idx) => `
      <tr>
        <td style="text-align: center; color: var(--text-dim);">${idx + 1}</td>
        <td>
          <div style="font-weight: 700; color: white;">${p.name}</div>
          <div style="font-size: 0.75rem; color: var(--text-dim);">ID: ${p.id}</div>
        </td>
        <td style="font-size: 0.82rem; color: #cbd5e1;">${p.jurusan || '-'}</td>
        <td>
          <span style="font-family: monospace; font-size: 0.85rem; padding: 3px 8px; border-radius: 4px; background: rgba(99,102,241,0.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3);">
            ${p.password || '-'}
          </span>
        </td>
        <td><span class="badge badge-profesi">${p.profession}</span></td>
        <td><span class="badge badge-group">${p.tabmin_group}</span></td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${p.pjk_name || '-'}</td>
        <td style="text-align: center; white-space: nowrap;">
          <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.78rem; margin-right: 6px;" onclick="AdminPanel.openEditModal(${p.id})">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.78rem; color: #fca5a5; border-color: rgba(239, 68, 68, 0.3);" onclick="AdminPanel.deleteParticipant(${p.id}, '${p.name.replace(/'/g, "\\'")}')">
            <i class="fas fa-trash-alt"></i> Hapus
          </button>
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th style="text-align: center;">No</th>
              <th>Nama Peserta</th>
              <th>Jurusan</th>
              <th>Password</th>
              <th>Divisi Profesi</th>
              <th>Kelompok Tabmin</th>
              <th>PJK</th>
              <th style="text-align: center;">Aksi Teknisi</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  },

  // =========================================================================
  // TAB 3: TABMIN GROUPS MATRICES
  // =========================================================================
  renderTabminGroupsView() {
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px;">
        ${this.tabminGroups.map(g => `
          <div class="glass-card" style="border-top: 3px solid var(--secondary);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 14px;">
              <div>
                <span class="badge badge-group" style="font-size: 0.9rem;">${g.group_name}</span>
                <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px;">
                  PJK: <strong style="color: white;">${g.pjk_name}</strong>
                </div>
              </div>
              <span class="badge badge-success" style="font-size: 0.82rem;">
                ${g.total_members} Anggota
              </span>
            </div>

            <div style="max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
              ${g.members.map(m => `
                <div style="padding: 8px 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                  <div>
                    <div style="font-weight: 600; font-size: 0.85rem; color: white;">${m.name}</div>
                    <span class="badge badge-profesi" style="font-size: 0.65rem;">${m.profession}</span>
                  </div>
                  <select 
                    class="custom-select" 
                    style="padding: 4px 8px; font-size: 0.75rem; background: #0f172a;" 
                    title="Pindahkan ke kelompok lain"
                    onchange="AdminPanel.moveMemberGroup(${m.id}, this.value)"
                  >
                    <option value="" disabled selected>Pindah..</option>
                    ${['Kelompok 1', 'Kelompok 2', 'Kelompok 3', 'Kelompok 4', 'Kelompok 5', 'Kelompok 6'].filter(grp => grp !== g.group_name).map(target => `
                      <option value="${target}">${target}</option>
                    `).join('')}
                  </select>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  onSearch(val) {
    this.searchQuery = val;
    this.loadParticipants().then(() => this.attachParticipantTable());
  },

  onProfFilter(val) {
    this.professionFilter = val;
    this.loadParticipants().then(() => this.attachParticipantTable());
  },

  onGroupFilter(val) {
    this.groupFilter = val;
    this.loadParticipants().then(() => this.attachParticipantTable());
  },

  openAddModal() {
    this.editingParticipant = null;
    const modal = document.getElementById('admin-modal');
    const title = document.getElementById('admin-modal-title');
    const body = document.getElementById('admin-modal-body');
    if (!modal || !body) return;

    title.innerHTML = '<i class="fas fa-user-plus" style="color: var(--primary);"></i> Daftarkan Peserta Baru';
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Nama Lengkap Peserta *</label>
          <input type="text" id="add-name" class="search-input" style="width: 100%;" placeholder="Contoh: Budi Santoso">
        </div>

        <div>
          <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Jurusan</label>
          <input type="text" id="add-jurusan" class="search-input" style="width: 100%;" placeholder="Contoh: A">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div>
            <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Divisi Profesi *</label>
            <select id="add-prof" class="custom-select" style="width: 100%;">
              <option value="Ilustrator">Ilustrator</option>
              <option value="Fotografer">Fotografer</option>
              <option value="Layouter">Layouter</option>
              <option value="Marcomm">Marcomm</option>
              <option value="Reporter">Reporter</option>
            </select>
          </div>

          <div>
            <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Kelompok Tabmin *</label>
            <select id="add-group" class="custom-select" style="width: 100%;">
              <option value="Kelompok 1">Kelompok 1 (PJK: Salsabila Az Zahra)</option>
              <option value="Kelompok 2">Kelompok 2 (PJK: Novita Tireina)</option>
              <option value="Kelompok 3">Kelompok 3 (PJK: Aldi Arkananta)</option>
              <option value="Kelompok 4">Kelompok 4 (PJK: Nadiny)</option>
              <option value="Kelompok 5">Kelompok 5 (PJK: Sarah Nur Rahmah)</option>
              <option value="Kelompok 6">Kelompok 6 (PJK: Ananda Ayu Pertiwi)</option>
            </select>
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 14px;">
          <button class="btn btn-primary" style="flex: 1;" onclick="AdminPanel.submitAddParticipant()">
            <i class="fas fa-save"></i> Daftarkan Peserta
          </button>
          <button class="btn btn-secondary" onclick="AdminPanel.closeModal()">Batal</button>
        </div>
      </div>
    `;

    modal.classList.add('active');
  },

  openEditModal(participantId) {
    const p = this.participants.find(x => x.id === participantId);
    if (!p) return;
    this.editingParticipant = p;

    const modal = document.getElementById('admin-modal');
    const title = document.getElementById('admin-modal-title');
    const body = document.getElementById('admin-modal-body');
    if (!modal || !body) return;

    title.innerHTML = `<i class="fas fa-edit" style="color: var(--secondary);"></i> Edit Peserta: ${p.name}`;
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Nama Lengkap Peserta</label>
          <input type="text" id="edit-name" class="search-input" style="width: 100%;" value="${p.name}">
        </div>

        <div>
          <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Jurusan</label>
          <input type="text" id="edit-jurusan" class="search-input" style="width: 100%;" value="${p.jurusan || ''}" placeholder="Contoh: A">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div>
            <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Divisi Profesi</label>
            <select id="edit-prof" class="custom-select" style="width: 100%;">
              ${['Ilustrator', 'Fotografer', 'Layouter', 'Marcomm', 'Reporter'].map(prof => `
                <option value="${prof}" ${p.profession === prof ? 'selected' : ''}>${prof}</option>
              `).join('')}
            </select>
          </div>

          <div>
            <label style="font-weight: 600; font-size: 0.85rem; color: white; display: block; margin-bottom: 6px;">Kelompok Tabmin</label>
            <select id="edit-group" class="custom-select" style="width: 100%;">
              ${['Kelompok 1', 'Kelompok 2', 'Kelompok 3', 'Kelompok 4', 'Kelompok 5', 'Kelompok 6'].map(grp => `
                <option value="${grp}" ${p.tabmin_group === grp ? 'selected' : ''}>${grp}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 14px;">
          <button class="btn btn-primary" style="flex: 1;" onclick="AdminPanel.submitEditParticipant(${p.id})">
            <i class="fas fa-save"></i> Simpan Perubahan
          </button>
          <button class="btn btn-secondary" onclick="AdminPanel.closeModal()">Batal</button>
        </div>
      </div>
    `;

    modal.classList.add('active');
  },

  closeModal() {
    const modal = document.getElementById('admin-modal');
    if (modal) modal.classList.remove('active');
  },

  async submitAddParticipant() {
    const name = document.getElementById('add-name').value.trim();
    const jurusan = document.getElementById('add-jurusan').value.trim();
    const prof = document.getElementById('add-prof').value;
    const grp = document.getElementById('add-group').value;

    if (!name) {
      showToast('Nama peserta wajib diisi.', 'warning');
      return;
    }

    try {
      const res = await API.post('/api/admin/participants', {
        name: name,
        jurusan: jurusan,
        profession: prof,
        tabmin_group: grp
      });
      showToast(res.message, 'success');
      this.closeModal();
      await this.loadParticipants();
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async submitEditParticipant(id) {
    const name = document.getElementById('edit-name').value.trim();
    const jurusan = document.getElementById('edit-jurusan').value.trim();
    const prof = document.getElementById('edit-prof').value;
    const grp = document.getElementById('edit-group').value;

    try {
      const res = await API.request(`/api/admin/participants/${id}`, {
        method: 'PUT',
        body: {
          name: name,
          jurusan: jurusan,
          profession: prof,
          tabmin_group: grp
        }
      });
      showToast(res.message, 'success');
      this.closeModal();
      await this.loadParticipants();
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async deleteParticipant(id, name) {
    if (!confirm(`Apakah Anda yakin ingin menghapus peserta '${name}'? Seluruh nilai dan riwayat terkait akan dihapus.`)) {
      return;
    }

    try {
      const res = await API.request(`/api/admin/participants/${id}`, {
        method: 'DELETE'
      });
      showToast(res.message, 'success');
      await this.loadParticipants();
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async moveMemberGroup(participantId, targetGroup) {
    try {
      const res = await API.post('/api/admin/move-tabmin-group', {
        participant_id: participantId,
        target_group: targetGroup
      });
      showToast(res.message, 'success');
      await this.loadTabminOverview();
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
