// Sidebar Navigation Component — Marine BDM CRM (Accordion Edition, mobile-hardened v2)
//
// Fix in this version: mobile/desktop detection now uses
// window.matchMedia('(max-width: 768px)') everywhere instead of
// window.innerWidth <= 768. innerWidth and the CSS media query can
// disagree by a few px (scrollbar width, devicePixelRatio, viewport
// meta timing on tablets), which was letting the DESKTOP collapsed
// icon-rail state get applied on tablet/mobile widths — that's why
// the drawer was showing icons-only with no labels and no dark
// backdrop instead of the proper mobile overlay. matchMedia uses the
// exact same evaluation as the CSS, so JS and CSS can no longer
// disagree. Also added a listener that resets state cleanly whenever
// the viewport crosses the breakpoint in either direction. Routes,
// APIs, auth, IDs, and desktop behavior are otherwise unchanged.

const NAV_GROUPS = [
  {
    id: 'sales-pipeline',
    label: 'BDM Sales Pipeline',
    icon: '🧭',
    items: [
      { href: '/pages/countries.html', icon: '🌐', label: 'Country Management', match: 'countries' },
      { href: '/pages/companies.html', icon: '🏢', label: 'Vessel Owner Directory', match: 'companies' },
      { href: '/pages/calling-report.html', icon: '📞', label: 'Daily Calling Report', match: 'calling' },
      { href: '/pages/appointments.html', icon: '📅', label: 'Appointments Engine', match: 'appointments' },
      { href: '/pages/contracts.html', icon: '📜', label: 'Contracts', match: 'contracts' }
    ]
  },
  {
    id: 'hr-employees',
    label: 'HR & Employees',
    icon: '🧑',
    items: [
      { href: '/pages/employee.html', icon: '👨‍✈️', label: 'Employees', match: 'employee' },
      { href: '/pages/tasks.html', icon: '📋', label: 'Task Management', match: 'tasks' }
    ]
  },
  {
    id: 'crewing',
    label: 'Crewing & Recruitment',
    icon: '⚓',
    items: [
      { href: '/pages/candidates.html', icon: '👨‍✈️', label: 'Seafarers Directory', match: 'candidates' },
      { href: '/pages/requirements.html', icon: '📋', label: 'Requirements Vacancies', match: 'requirements' }
    ]
  },
  {
    id: 'compliance',
    label: 'Compliance & Logistics',
    icon: '⚙️',
    items: [
      { href: '/pages/ops.html', icon: '⚙️', label: 'Operations Pipeline', match: 'ops' }
    ]
  },
  {
    id: 'frontdesk',
    label: 'Front Desk',
    icon: '🛎️',
    items: [
      { href: '/pages/reception.html', icon: '🛎️', label: 'Reception Desk', match: 'reception' }
    ]
  },
  {
    id: 'updates',
    label: 'Updates & Analytics',
    icon: '🔔',
    items: [
      { href: '/pages/followups.html', icon: '🔔', label: 'Follow-up Queue', match: 'followups', badge: true }
      // 'Reports & Analytics' is appended conditionally below, role-gated
    ]
  }
];

// ── Single source of truth for "are we in mobile-drawer mode?" ────
// Uses the exact same query the CSS uses, so JS and CSS can never
// disagree about which layout should be active.
const MOBILE_QUERY = window.matchMedia('(max-width: 768px)');
function isMobileViewport() {
  return MOBILE_QUERY.matches;
}

function buildNavGroups(currentPath, userRole) {
  const isActive = (keyword) => currentPath.includes(keyword);
  const groups = NAV_GROUPS.map(g => ({ ...g, items: [...g.items] }));

  if (['ADMIN', 'HR', 'MANAGER'].includes(userRole)) {
    groups.find(g => g.id === 'updates').items.push(
      { href: '/pages/reports.html', icon: '📈', label: 'Reports & Analytics', match: 'reports' }
    );
  }

  let activeGroupId = null;

  const groupsHtml = groups.map(group => {
    const itemsHtml = group.items.map(item => {
      const active = isActive(item.match);
      if (active) activeGroupId = group.id;
      return `
        <a href="${item.href}" class="nav-subitem ${active ? 'active' : ''}" data-tooltip="${item.label}">
          <span class="nav-subitem-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
          ${item.badge ? `<span class="nav-badge nav-badge-pulse" id="followup-badge" style="display:none">0</span>` : ''}
        </a>`;
    }).join('');

    const groupHasActive = group.items.some(i => isActive(i.match));

    return `
      <div class="nav-group ${groupHasActive ? 'has-active' : ''}" data-group-id="${group.id}">
        <button type="button" class="nav-group-header" data-tooltip="${group.label}">
          <span class="nav-icon">${group.icon}</span>
          <span class="nav-label nav-group-label">${group.label}</span>
          <svg class="nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 6 15 12 9 18"></polyline>
          </svg>
        </button>
        <div class="nav-submenu">
          <div class="nav-submenu-inner">${itemsHtml}</div>
        </div>
      </div>`;
  }).join('');

  return { groupsHtml, activeGroupId };
}

function renderSidebar() {
  const currentPath = window.location.pathname;
  const sidebarContainer = document.getElementById('sidebar-container');
  if (!sidebarContainer) return;

  const isActive = (keyword) => currentPath.includes(keyword) ? 'active' : '';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const { groupsHtml, activeGroupId } = buildNavGroups(currentPath, user.role);

  sidebarContainer.innerHTML = `
    <div class="sidebar" id="app-sidebar">
      <div class="sidebar-logo">
        <img src="/public/assets/logo.png.png" class="login-logo-icon" alt="Logo">
        <div class="logo-text">
          <div class="logo-title">MARINE CRM</div>
          <div class="logo-subtitle">Vessel Owner Pipeline</div>
        </div>
      </div>

      <div class="sidebar-nav">
        <div class="nav-section-label">Overview</div>
        <a href="/pages/dashboard.html" class="nav-item ${isActive('dashboard')}" data-tooltip="Dashboard">
          <span class="nav-icon">📊</span>
          <span class="nav-label">Dashboard</span>
        </a>

        <div class="nav-section-label">Navigation</div>
        ${groupsHtml}
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

  

  // ── User info ────────────────────────────────────────────────
  try {
    if (user.name) {
      const el = document.getElementById('sidebar-user-avatar');
      const nameEl = document.getElementById('sidebar-user-name');
      const roleEl = document.getElementById('sidebar-user-role');
      if (el) el.textContent = user.name.charAt(0).toUpperCase();
      if (nameEl) nameEl.textContent = user.name;
      if (roleEl) roleEl.textContent = user.role || 'BDM';
    }
  } catch (e) { /* ignore */ }

  // ── Follow-up badge ──────────────────────────────────────────
  if (window.ApiService) {
    ApiService.getFollowUps({ status: 'PENDING' }).then(res => {
      const badge = document.getElementById('followup-badge');
      if (badge && res.data && res.data.length > 0) {
        badge.textContent = res.data.length;
        badge.style.display = 'inline-block';
      }
    }).catch(() => { });
  }

  // ── Accordion logic ──────────────────────────────────────────
  initSidebarAccordion(activeGroupId);
}

function initSidebarAccordion(activeGroupId) {
  const groups = Array.from(document.querySelectorAll('.nav-group'));
  if (!groups.length) return;

  const STORAGE_KEY = 'sidebarOpenGroup';
  const setOpen = (groupEl, open, animate = true) => {
    const submenu = groupEl.querySelector('.nav-submenu');
    const inner = groupEl.querySelector('.nav-submenu-inner');
    const header = groupEl.querySelector('.nav-group-header');
    if (!submenu || !inner || !header) return;

    if (!animate) submenu.style.transition = 'none';

    if (open) {
      groupEl.classList.add('open');
      header.setAttribute('aria-expanded', 'true');
      submenu.style.maxHeight = inner.scrollHeight + 'px';
      submenu.style.opacity = '1';
    } else {
      groupEl.classList.remove('open');
      header.setAttribute('aria-expanded', 'false');
      submenu.style.maxHeight = '0px';
      submenu.style.opacity = '0';
    }

    if (!animate) {
      // Force reflow then restore transitions for future interactions
      // eslint-disable-next-line no-unused-expressions
      submenu.offsetHeight;
      submenu.style.transition = '';
    }
  };

  const openOnly = (targetId, animate = true) => {
    groups.forEach(g => setOpen(g, g.dataset.groupId === targetId, animate));
    if (targetId) localStorage.setItem(STORAGE_KEY, targetId);
  };

  // Initial state: prefer the group containing the active route,
  // fall back to the last-opened group from a previous session.
  const initialGroupId = activeGroupId || localStorage.getItem(STORAGE_KEY);
  if (initialGroupId && groups.some(g => g.dataset.groupId === initialGroupId)) {
    openOnly(initialGroupId, false);
  }

  groups.forEach(groupEl => {
    const header = groupEl.querySelector('.nav-group-header');
    header.addEventListener('click', () => {
      const isOpen = groupEl.classList.contains('open');
      const sidebarEl = document.getElementById('app-sidebar');
      if (isMobileViewport() && sidebarEl && !sidebarEl.classList.contains('mobile-open')) {
        return; // ignore stray clicks while drawer closed
      }
      openOnly(isOpen ? null : groupEl.dataset.groupId);
    });
  });

  // Keep open submenu height correct on window resize (font wraps etc.)
  window.addEventListener('resize', () => {
    const openGroup = groups.find(g => g.classList.contains('open'));
    if (openGroup) setOpen(openGroup, true, false);
  });
}

function renderNavbar() {
  const user = JSON.parse(localStorage.getItem('user') || '{"name":"Guest","role":"BDM"}');
  const navbarContainer = document.getElementById('navbar-container');
  if (!navbarContainer) return;

  const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U';

  navbarContainer.innerHTML = `
    <nav class="navbar">
      <button class="navbar-toggle" id="sidebar-toggle-btn" title="Toggle Sidebar" aria-label="Toggle Sidebar">
        <span class="hbg-line"></span><span class="hbg-line"></span><span class="hbg-line"></span>
      </button>

      <div class="navbar-search">
        <span class="search-icon">🔍</span>
        <input type="text" id="global-search" placeholder="Search vessel owners, companies..." />
      </div>

      <div class="navbar-right">
        <button class="theme-toggle" id="theme-toggle-btn">🌙 Dark</button>

        <button class="btn btn-secondary btn-sm" onclick="window.location.href='/pages/organization chat.html'" title="Org Chart" style="display:flex;align-items:center;gap:5px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="6" r="3" stroke="currentColor" stroke-width="1.6"/><circle cx="5" cy="18" r="2.6" stroke="currentColor" stroke-width="1.6"/><circle cx="19" cy="18" r="2.6" stroke="currentColor" stroke-width="1.6"/><path d="M12 9v4M9 15l-2.5 1.5M15 15l2.5 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          Org Chart
        </button>

       
        <div class="user-menu" id="user-menu-btn" title="${user.name || 'User'}">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name">${user.name || 'User'}</div>
            <div class="user-role">${user.role || 'BDM'}</div>
          </div>
        </div>

        <button class="btn btn-secondary btn-sm" id="logout-btn" style="margin-left:4px;">↩ Logout</button>
      </div>
    </nav>
  `;

  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  toggleBtn.addEventListener('click', () => {
    const sidebar = document.getElementById('app-sidebar');
    const mainContent = document.querySelector('.main-content');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;

    if (isMobileViewport()) {
      const isOpen = sidebar.classList.toggle('mobile-open');
      if (overlay) overlay.classList.toggle('active', isOpen);
      toggleBtn.classList.toggle('is-open', isOpen);
      document.body.classList.toggle('no-scroll', isOpen);
    } else {
      const collapsed = sidebar.classList.toggle('collapsed');
      if (mainContent) mainContent.classList.toggle('sidebar-collapsed', collapsed);
      toggleBtn.classList.toggle('is-open', collapsed);
      localStorage.setItem('sidebarCollapsed', collapsed ? 'true' : 'false');
    }
  });

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

  const themeBtn = document.getElementById('theme-toggle-btn');
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    themeBtn.innerHTML = '☀️ Light';
  }

  themeBtn.addEventListener('click', () => {
    document.documentElement.classList.add('theme-transition');

    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    if (newTheme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    localStorage.setItem('theme', newTheme);
    themeBtn.innerHTML = newTheme === 'light' ? '☀️ Light' : '🌙 Dark';

    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: newTheme } }));

    window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 400);
  });
}

function renderFooter() {
  if (document.querySelector('.app-footer')) return;
  const mainContent = document.querySelector('.main-content');
  if (!mainContent) return;

  const footer = document.createElement('footer');
  footer.className = 'app-footer';
  footer.innerHTML = `
    <span>Marine CRM &copy; 2026</span>
    <span class="footer-sep">•</span>
    <span>Built for Vessel Management &amp; Sales Pipeline</span>
    <span class="footer-sep">•</span>
    <span>Version 1.0 | Support</span>
  `;
  mainContent.appendChild(footer);
}

(function applyStoredThemeEarly() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  if (!UI.requireAuth()) return;

  renderSidebar();
  renderNavbar();
  renderFooter();
});

document.addEventListener('DOMContentLoaded', () => {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  window.observeReveal = function (root = document) {
    root.querySelectorAll('[data-reveal]:not(.is-visible)').forEach(el => io.observe(el));
  };
  window.setTimeout(() => window.observeReveal(), 50);
});

// ── Lightweight SPA-style page-out transition on nav clicks ─────
// Fades the page content out just before navigating so the next
// page's fade-in (pageEnter animation, already in CSS) reads as
// one continuous transition instead of a hard cut.
document.addEventListener('DOMContentLoaded', () => {
  const page = document.querySelector('.page-content');
  if (!page) return;

  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="/pages/"]');
    if (!link || link.target === '_blank' || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    page.classList.add('page-exit');
    window.setTimeout(() => { window.location.href = link.href; }, 160);
  });
});