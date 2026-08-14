// Sidebar Navigation Component — Marine BDM CRM (Accordion Edition, v5 — production)
//
// v3 fixes (kept): collapsed-desktop hover flyout, breakpoint-crossing
// reset at 991.98px, collapsed state restore, defensive class strip.
// v3.1: HR Operations entry.
// v4: closeMobileDrawer() reused by hamburger/overlay/nav-link taps.
//
// v5 — this pass fixes two concrete bugs:
//
// 1. SCROLL BLEED: openMobileDrawer()/closeMobileDrawer() now directly
//    set document.body.style.overflow = 'hidden' / '' (in addition to
//    the 'no-scroll' class, which stays for any CSS that hooks it).
//    Previously only the toggle-button code path set 'no-scroll';
//    other paths that could open/close the drawer didn't always run
//    through the same code, so the class could be left off and the
//    page behind the drawer kept scrolling.
//
// 2. "FROZEN" NAVIGATION: nav-item/nav-subitem links used to bubble
//    up to the separate SPA page-transition listener on document.body,
//    which called e.preventDefault() and only navigated after a
//    160ms delay. On mobile that combined with the drawer's closing
//    transition to make taps feel like they did nothing. Nav links
//    now call e.stopPropagation() (NEVER e.preventDefault()) so that
//    outer listener never sees the click, and the browser's native
//    <a href> navigation fires immediately — closeMobileDrawer() runs
//    first, in the same tick, but does not block or delay the follow-
//    on navigation in any way.

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
      { href: '/pages/hr-operations.html', icon: '🛠️', label: 'HR Operations', match: 'hr-operations' },
      { href: '/pages/tasks.html', icon: '📋', label: 'Task Management', match: 'tasks' }
    ]
  },
  {
    id: 'crewing',
    label: 'Crewing & Recruitment',
    icon: '⚓',
    items: [
      { href: '/pages/candidates.html', icon: '👨‍✈️', label: 'Seafarers Directory', match: 'candidates' },
      { href: '/pages/job-applicants.html', icon: '📋', label: 'Job Applicants', match: 'job-applicants' },
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
      // 'Reports & Analytics' appended conditionally below, role-gated
    ]
  }
];

// ── Single source of truth for "are we in mobile-drawer mode?" ────
// MUST match the 991.98px breakpoint in styles1.css where the sidebar
// becomes a fixed off-canvas drawer.
const MOBILE_QUERY = window.matchMedia('(max-width: 991.98px)');
function isMobileViewport() {
  return MOBILE_QUERY.matches;
}

// ── Symmetric open/close for the mobile drawer ──────────────────────
// Both functions are the ONLY places that touch mobile-open state, the
// overlay, the toggle button's is-open class, and body scroll locking.
// Every caller (hamburger, overlay click, nav-link tap, breakpoint
// crossing) goes through these two functions so none of that state
// can ever drift out of sync.
function openMobileDrawer() {
  const sidebar = document.getElementById('app-sidebar');
  const mainContent = document.querySelector('.main-content');
  const overlay = document.getElementById('sidebar-overlay');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (!sidebar) return;

  // Defensive: never let a stray 'collapsed' class fight 'mobile-open'
  sidebar.classList.remove('collapsed');
  mainContent?.classList.remove('sidebar-collapsed');

  sidebar.classList.add('mobile-open');
  overlay?.classList.add('active');
  toggleBtn?.classList.add('is-open');

  // Lock background scroll while the drawer is open. Set directly on
  // the inline style (not just a class) so this can never depend on a
  // CSS rule being present/loaded — belt-and-braces alongside
  // 'no-scroll' for any styling that hooks the class.
  document.body.classList.add('no-scroll');
  document.body.style.overflow = 'hidden';
}

function closeMobileDrawer() {
  const sidebar = document.getElementById('app-sidebar');
  const mainContent = document.querySelector('.main-content');
  const overlay = document.getElementById('sidebar-overlay');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (!sidebar) return;

  sidebar.classList.remove('mobile-open');
  mainContent?.classList.remove('sidebar-collapsed');
  overlay?.classList.remove('active');
  toggleBtn?.classList.remove('is-open');

  // Always restore scroll, even if it was never explicitly locked —
  // this is what guarantees no lingering scroll-bleed after the
  // drawer closes via ANY path (hamburger, overlay, nav-link tap,
  // breakpoint crossing).
  document.body.classList.remove('no-scroll');
  document.body.style.overflow = '';
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
        <button type="button" class="nav-group-header" data-tooltip="${group.label}" aria-expanded="false">
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

  // ── Restore collapsed state (desktop only) ──────────────────
  applyStoredCollapsedState();

  // ── Accordion logic ──────────────────────────────────────────
  initSidebarAccordion(activeGroupId);

  // ── Mobile: tapping a real destination link closes the drawer
  //    instantly and lets native navigation proceed uninterrupted.
  //    e.stopPropagation() keeps this click from ever reaching the
  //    SPA page-transition listener on document.body, which is what
  //    used to preventDefault() it and delay navigation by 160ms —
  //    that delay, stacked with the drawer's own closing animation,
  //    is what made taps feel "frozen". NEVER call preventDefault()
  //    here: the <a href> must be allowed to navigate normally. ────
  sidebarContainer.querySelectorAll('.nav-item, .nav-subitem').forEach(link => {
    link.addEventListener('click', (e) => {
      if (isMobileViewport()) {
        closeMobileDrawer();
        e.stopPropagation();
      }
    });
  });
}

// Applies the persisted "collapsed" preference, but only when we are
// actually on desktop. Never leaves 'collapsed' set on a mobile view.
function applyStoredCollapsedState() {
  const sidebar = document.getElementById('app-sidebar');
  const mainContent = document.querySelector('.main-content');
  if (!sidebar) return;

  if (isMobileViewport()) {
    sidebar.classList.remove('collapsed');
    mainContent?.classList.remove('sidebar-collapsed');
    return;
  }

  const storedCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  sidebar.classList.toggle('collapsed', storedCollapsed);
  mainContent?.classList.toggle('sidebar-collapsed', storedCollapsed);

  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  toggleBtn?.classList.toggle('is-open', storedCollapsed);
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
      const sidebarEl = document.getElementById('app-sidebar');

      // Mobile drawer closed → header click does nothing
      if (isMobileViewport() && sidebarEl && !sidebarEl.classList.contains('mobile-open')) {
        return;
      }

      // Desktop collapsed rail → don't run the accordion; navigation
      // in this state happens via the CSS hover-flyout instead.
      if (!isMobileViewport() && sidebarEl && sidebarEl.classList.contains('collapsed')) {
        return;
      }

      const isOpen = groupEl.classList.contains('open');
      openOnly(isOpen ? null : groupEl.dataset.groupId);
    });
  });

  // Keep open submenu height correct on window resize
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

      <div class="navbar-right">
        <button class="theme-toggle" id="theme-toggle-btn" aria-label="Toggle theme">
          <span class="navbar-icon" id="theme-toggle-icon">🌙</span><span class="navbar-label" id="theme-toggle-label">Dark</span>
        </button>

        <button class="btn btn-secondary btn-sm navbar-orgchart-btn" onclick="window.location.href='/pages/organization chat.html'" title="Org Chart" aria-label="Org Chart" style="display:flex;align-items:center;gap:5px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="6" r="3" stroke="currentColor" stroke-width="1.6"/><circle cx="5" cy="18" r="2.6" stroke="currentColor" stroke-width="1.6"/><circle cx="19" cy="18" r="2.6" stroke="currentColor" stroke-width="1.6"/><path d="M12 9v4M9 15l-2.5 1.5M15 15l2.5 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <span class="navbar-label">Org Chart</span>
        </button>

        <div class="user-menu" id="user-menu-btn" title="${user.name || 'User'}">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name">${user.name || 'User'}</div>
            <div class="user-role">${user.role || 'BDM'}</div>
          </div>
        </div>

        <button class="btn btn-secondary btn-sm" id="logout-btn" aria-label="Logout" style="margin-left:4px;">
          <span class="navbar-icon">↩</span><span class="navbar-label">Logout</span>
        </button>
      </div>
    </nav>
  `;

  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  toggleBtn.addEventListener('click', () => {
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar) return;

    if (isMobileViewport()) {
      if (sidebar.classList.contains('mobile-open')) {
        closeMobileDrawer();
      } else {
        openMobileDrawer();
      }
    } else {
      const mainContent = document.querySelector('.main-content');
      sidebar.classList.remove('mobile-open');
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
      // "Once per login session" for the birthday celebration popup
      // means the login, not the browser tab — clear it here so a
      // fresh login after logout is treated as a new session.
      sessionStorage.removeItem('bdayCelebrationShown');
      window.location.href = '/pages/login.html';
    }
  });

  const themeBtn = document.getElementById('theme-toggle-btn');
  const themeIconEl = document.getElementById('theme-toggle-icon');
  const themeLabelEl = document.getElementById('theme-toggle-label');

  function setThemeButtonState(theme) {
    // Update the icon/label spans in place — never overwrite
    // themeBtn.innerHTML directly, or the span structure the mobile
    // icon-only CSS depends on (.navbar-label) gets destroyed.
    if (themeIconEl) themeIconEl.textContent = theme === 'light' ? '☀️' : '🌙';
    if (themeLabelEl) themeLabelEl.textContent = theme === 'light' ? 'Light' : 'Dark';
  }

  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    setThemeButtonState('light');
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
    setThemeButtonState(newTheme);

    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: newTheme } }));

    window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 400);
  });

  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      closeMobileDrawer();
    });
  }
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

// ── Breakpoint-crossing reset ────────────────────────────────────
MOBILE_QUERY.addEventListener('change', (e) => {
  const sidebar = document.getElementById('app-sidebar');
  const mainContent = document.querySelector('.main-content');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (!sidebar) return;

  if (e.matches) {
    // Entered mobile: strip desktop-only state
    sidebar.classList.remove('collapsed');
    mainContent?.classList.remove('sidebar-collapsed');
  } else {
    // Entered desktop: strip mobile-only state (also restores scroll)
    closeMobileDrawer();

    const storedCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    sidebar.classList.toggle('collapsed', storedCollapsed);
    mainContent?.classList.toggle('sidebar-collapsed', storedCollapsed);
    toggleBtn?.classList.toggle('is-open', storedCollapsed);
  }
});

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
// NOTE: this listener never fires for .nav-item/.nav-subitem taps —
// their own click handler (in renderSidebar, above) calls
// e.stopPropagation() before this ever runs, so sidebar links always
// navigate immediately via native <a href> behavior. This handler is
// still used for other in-app links (quick-action cards, etc.).
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