// Sidebar Navigation Component — Marine BDM CRM

function renderSidebar() {
  const currentPath = window.location.pathname;

  const sidebarContainer = document.getElementById('sidebar-container');
  if (!sidebarContainer) return;

  const isActive = (keyword) =>
    currentPath.includes(keyword) ? 'active' : '';

  sidebarContainer.innerHTML = `
    <div class="sidebar" id="app-sidebar">
      <div class="sidebar-logo">
        <img src="/public/assets/logo.png.png" class="login-logo-icon" alt="Logo">
        <div class="logo-text">
          <div class="logo-title">MARINE BDM CRM</div>
          <div class="logo-subtitle">Vessel Owner Pipeline</div>
        </div>
      </div>

      <div class="sidebar-nav">
        <div class="nav-section-label">Overview</div>
        <a href="/pages/dashboard.html" class="nav-item ${isActive('dashboard')}">
          <span class="nav-icon">📊</span>
          <span class="nav-label">Dashboard</span>
        </a>

        <div class="nav-section-label">BDM Sales Pipeline</div>
        <a href="/pages/countries.html" class="nav-item ${isActive('countries')}">
          <span class="nav-icon">🌐</span>
          <span class="nav-label">Country Management</span>
        </a>
        <a href="/pages/companies.html" class="nav-item ${isActive('companies')}">
          <span class="nav-icon">🏢</span>
          <span class="nav-label">Vessel Owner Directory</span>
        </a>
        <a href="/pages/calling-report.html" class="nav-item ${isActive('calling')}">
          <span class="nav-icon">📞</span>
          <span class="nav-label">Daily Calling Report</span>
        </a>
        <a href="/pages/appointments.html" class="nav-item ${isActive('appointments')}">
          <span class="nav-icon">📅</span>
          <span class="nav-label">Appointments Engine</span>
        </a>
        <a href="/pages/contracts.html" class="nav-item ${isActive('contracts')}">
          <span class="nav-icon">📜</span>
          <span class="nav-label">Contracts</span>
        </a>

        <div class="nav-section-label">HR & Employees</div>
        <a href="/pages/employee.html" class="nav-item ${isActive('employee')}">
          <span class="nav-icon">👨‍💼</span>
          <span class="nav-label">Employees</span>
        </a>

        <div class="nav-section-label">Crewing & Recruitment</div>
        <a href="/pages/candidates.html" class="nav-item ${isActive('candidates')}">
          <span class="nav-icon">👨‍✈️</span>
          <span class="nav-label">Seafarers Directory</span>
        </a>
        <a href="/pages/requirements.html" class="nav-item ${isActive('requirements')}">
          <span class="nav-icon">📋</span>
          <span class="nav-label">Requirements Vacancies</span>
        </a>

        <div class="nav-section-label">Compliance & Logistics</div>
        <a href="/pages/ops.html" class="nav-item ${isActive('ops')}">
          <span class="nav-icon">⚙️</span>
          <span class="nav-label">Operations Pipeline</span>
        </a>

        <div class="nav-section-label">Updates & Analytics</div>
        <a href="/pages/followups.html" class="nav-item ${isActive('followups')}">
          <span class="nav-icon">🔔</span>
          <span class="nav-label">Follow-up Queue</span>
          <span class="nav-badge nav-badge-pulse" id="followup-badge" style="display:none">0</span>
        </a>
        ${['ADMIN', 'HR', 'MANAGER'].includes(JSON.parse(localStorage.getItem('user') || '{}').role) ? `
        <a href="/pages/reports.html" class="nav-item ${isActive('reports')}">
          <span class="nav-icon">📈</span>
          <span class="nav-label">Reports & Analytics</span>
        </a>
        ` : ''}
      </div>

      <div style="padding: 12px 8px; border-top: 1px solid rgba(255,255,255,0.05);">
        <div style="padding: 10px; display:flex; align-items:center; gap:10px; border-radius: var(--radius-sm);">
          <div id="sidebar-user-avatar" style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#0EA5E9,#6366F1);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:#fff;flex-shrink:0;">U</div>
          <div class="logo-text">
            <div id="sidebar-user-name" style="font-size:0.8rem;font-weight:600;color:var(--text-primary);white-space:nowrap;"></div>
            <div id="sidebar-user-role" style="font-size:0.68rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Create sidebar overlay for mobile drawer if missing
  let overlay = document.getElementById('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  const closeMobileSidebar = () => {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
  };

  overlay.addEventListener('click', closeMobileSidebar);

  // Close mobile sidebar on nav link click
  sidebarContainer.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        closeMobileSidebar();
      }
    });
  });

  // Set user info
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.name) {
      const el = document.getElementById('sidebar-user-avatar');
      const nameEl = document.getElementById('sidebar-user-name');
      const roleEl = document.getElementById('sidebar-user-role');
      if (el) el.textContent = user.name.charAt(0).toUpperCase();
      if (nameEl) nameEl.textContent = user.name;
      if (roleEl) roleEl.textContent = user.role || 'BDM';
    }
  } catch (e) { /* ignore */ }

  // Load pending follow-up count badge
  if (window.ApiService) {
    ApiService.getFollowUps({ status: 'PENDING' }).then(res => {
      const badge = document.getElementById('followup-badge');
      if (badge && res.data && res.data.length > 0) {
        badge.textContent = res.data.length;
        badge.style.display = 'inline-block';
      }
    }).catch(() => { });
  }
}

function renderNavbar() {
  const user = JSON.parse(localStorage.getItem('user') || '{"name":"Guest","role":"BDM"}');
  const navbarContainer = document.getElementById('navbar-container');
  if (!navbarContainer) return;

  const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U';

  navbarContainer.innerHTML = `
    <nav class="navbar">
      <button class="navbar-toggle" id="sidebar-toggle-btn" title="Toggle Sidebar">☰</button>

      <div class="navbar-search">
        <span class="search-icon">🔍</span>
        <input type="text" id="global-search" placeholder="Search vessel owners, companies..." />
      </div>

      <div class="navbar-right">
        <button class="theme-toggle" id="theme-toggle-btn">🌙 Dark</button>

        <button class="btn btn-secondary btn-sm" onclick="window.location.href='/pages/organization chat.html'" title="Org Chart" style="display:flex;align-items:center;gap:5px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><circle cx="12" cy="6" r="3" stroke="currentColor" stroke-width="1.6"/><circle cx="5" cy="18" r="2.6" stroke="currentColor" stroke-width="1.6"/><circle cx="19" cy="18" r="2.6" stroke="currentColor" stroke-width="1.6"/><path d="M12 9v4M9 15l-2.5 1.5M15 15l2.5 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          Org Chart
        </button>

        <div class="user-menu" id="user-menu-btn" title="${user.name || 'User'}">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name">${user.name || 'User'}</div>
            <div class="user-role">${user.role || 'BDM'}</div>
          </div>
        </div>

        <button class="btn btn-secondary btn-sm" id="logout-btn" style="margin-left:4px;">
          ↩ Logout
        </button>
      </div>
    </nav>
  `;

  // Sidebar toggle
  document.getElementById('sidebar-toggle-btn').addEventListener('click', () => {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    if (window.innerWidth <= 768) {
      const isOpen = sidebar.classList.toggle('mobile-open');
      if (overlay) {
        if (isOpen) overlay.classList.add('active');
        else overlay.classList.remove('active');
      }
    } else {
      sidebar.classList.toggle('collapsed');
    }
  });

  // Logout with confirm
  document.getElementById('logout-btn').addEventListener('click', async () => {
    const confirmed = await UI.confirm({
      title: 'Sign Out?',
      message: 'You will be returned to the login screen.',
      confirmText: 'Sign Out',
      cancelText: 'Stay',
      danger: false
    });
    if (confirmed) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/pages/login.html';
    }
  });

  // Theme toggle
  const themeBtn = document.getElementById('theme-toggle-btn');
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    themeBtn.innerHTML = '☀️ Light';
  }

  themeBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    if (newTheme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    localStorage.setItem('theme', newTheme);
    themeBtn.innerHTML = newTheme === 'light' ? '☀️ Light' : '🌙 Dark';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Auth guard
  if (!UI.requireAuth()) return;

  renderSidebar();
  renderNavbar();
});

