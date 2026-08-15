// Sidebar Navigation Component — Marine BDM CRM (Accordion Edition, v4)
//
// v4 adds (on top of the v3 production fixes below):
// 1. A shared window.AttendanceService — a thin wrapper that prefers
//    window.ApiService.attendance.* if your backend layer already
//    exposes one, and otherwise falls back to fetch() calls against
//    the endpoints in ATTENDANCE_ENDPOINTS. THESE ENDPOINT PATHS ARE
//    ASSUMED (no backend/API files were provided) — update
//    ATTENDANCE_ENDPOINTS to match your real routes, or wire a
//    window.ApiService.attendance object with the same method names
//    (getToday, checkIn, checkOut, getMonth, getSummary) and this
//    file will use it automatically without any further changes.
// 2. A navbar IN/OUT button (renderAttendanceNavButton) that shows
//    the employee's live attendance state and opens
//    /pages/attendance.html. It reuses the existing
//    .btn.btn-secondary.btn-sm styling used by the Org Chart button
//    so it stays visually consistent, plus a small state-driven
//    accent class (see the CSS addon file).
// 3. A 'attendance:changed' window event: attendance.html dispatches
//    it after a successful check-in/check-out so the navbar button
//    refreshes immediately without a full page reload.
//
// v3 fixes (unchanged):
// 1. Collapsed desktop rail no longer blocks navigation — submenu
//    shows as a hover flyout (CSS), so HR / Crewing / Reports / etc.
//    stay reachable even when the sidebar is collapsed.
// 2. Added the MOBILE_QUERY.addEventListener('change', ...) resize
//    handler that resets 'collapsed' / 'mobile-open' state whenever
//    the viewport crosses the 768px breakpoint.
// 3. Collapsed state is now restored from localStorage on load, and
//    is always stripped when entering mobile.
// 4. Mobile toggle defensively strips 'collapsed' before opening.

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
    label: 'Employees',
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
      { href: '/pages/requirements.html', icon: '📋', label: 'Requirements Vacancies', match: 'requirements' },
      { href: '/pages/job-applicants.html', icon: '📝', label: 'Job Applications', match: 'job-applicants' }
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
// becomes a fixed off-canvas drawer (transform: translateX(-105%)).
const MOBILE_QUERY = window.matchMedia('(max-width: 991.98px)');
function isMobileViewport() {
  return MOBILE_QUERY.matches;
}

function buildNavGroups(currentPath, userRole) {
  const isActive = (keyword) => currentPath.includes(keyword);
  let groups = NAV_GROUPS.map(g => ({ ...g, items: [...g.items] }));

  // Reports & Analytics: ADMIN / HR / MANAGER only
  if (['ADMIN', 'HR', 'MANAGER'].includes(userRole)) {
    groups.find(g => g.id === 'updates').items.push(
      {
        href: '/pages/reports.html',
        icon: '📈',
        label: 'Reports & Analytics',
        match: 'reports'
      }
    );
  }

  // BDM Sales Executive: Sales Pipeline + Employees + Tasks only
  if (userRole === 'BDM') {
    groups = groups.filter(g =>
      ['sales-pipeline', 'hr-employees'].includes(g.id)
    );
  }
  // Sourcing Manager: Crewing + Task Management + Front Desk + Follow-up Queue
  // Reports & Analytics remains hidden because it is ADMIN/HR/MANAGER-only.
  if (userRole === 'SOURCING_MANAGER' || userRole === 'MANAGER_SOURCING') {
  groups = groups
    .map(g => {
      if (g.id === 'crewing') return g;
      if (g.id === 'frontdesk') return g;

      if (g.id === 'hr-employees') {
        return {
          ...g,
          items: g.items.filter(i =>
            ['employee', 'hr-operations', 'tasks'].includes(i.match)
          )
        };
      }

      if (g.id === 'updates') {
        return {
          ...g,
          items: g.items.filter(i => ['candidates', 'job-applicants', 'requirements', 'followups'].includes(i.match))
        };
      }

      return { ...g, items: [] };
    })
    .filter(g => g.items.length > 0);
}


// Manager - Docs
if (userRole === 'MANAGER_DOCS') {
  groups = groups
    .map(g => {

      if (g.id === 'hr-employees') {
        return {
          ...g,
          items: g.items.filter(i =>
            ['employee', 'hr-operations', 'tasks'].includes(i.match)
          )
        };
      }

      if (g.id === 'crewing') {
        return {
          ...g,
          items: g.items.filter(i => ['candidates', 'job-applicants'].includes(i.match))
        };
      }

      return { ...g, items: [] };
    })
    .filter(g => g.items.length > 0);

  groups.push({
    id: 'docs',
    label: 'Documents',
    icon: '📄',
    items: [
      {
        href: '/pages/documents.html',
        icon: '📄',
        label: 'Documents',
        match: 'documents'
      }
    ]
  });
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

// ================================================================
// ATTENDANCE — shared service + navbar IN/OUT button
//
// No backend/API files were supplied alongside sidebar.js, so the
// endpoints below are assumed to match the REST conventions already
// used by documentsApi in documents.html (Bearer auth header, JSON
// body, /api/<resource> paths). If your real backend uses different
// routes, either update ATTENDANCE_ENDPOINTS below, or define
// window.ApiService.attendance = { getToday, checkIn, checkOut,
// getMonth, getSummary } in your api.js — this file will prefer
// that automatically and none of the code below needs to change.
// ================================================================

const ATTENDANCE_ENDPOINTS = {
  today: '/api/attendance/today',
  checkin: '/api/attendance/checkin',
  checkout: '/api/attendance/checkout',
  month: '/api/attendance/month',
  summary: '/api/attendance/summary'
};

async function attendanceFetch(method, url, body) {
  const token = localStorage.getItem('token');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty/non-JSON body */ }

  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

// Normalizes both possible shapes: a window.ApiService.attendance.*
// call (which — like documentsApi.getAll() elsewhere in this app —
// may resolve to an axios response with a `.data` envelope) and a
// raw fetch() call (which resolves to the parsed JSON directly).
async function callAttendanceMethod(methodName, ...args) {
  if (window.ApiService && window.ApiService.attendance &&
      typeof window.ApiService.attendance[methodName] === 'function') {
    const res = await window.ApiService.attendance[methodName](...args);
    return (res && res.data !== undefined) ? res.data : res;
  }
  return ATTENDANCE_FETCH_IMPL[methodName](...args);
}

const ATTENDANCE_FETCH_IMPL = {
  getToday: () => attendanceFetch('GET', ATTENDANCE_ENDPOINTS.today),
  checkIn: () => attendanceFetch('POST', ATTENDANCE_ENDPOINTS.checkin, {}),
  checkOut: () => attendanceFetch('POST', ATTENDANCE_ENDPOINTS.checkout, {}),
  getMonth: (year, month, employeeId) => attendanceFetch(
    'GET',
    `${ATTENDANCE_ENDPOINTS.month}?year=${year}&month=${month}${employeeId ? `&employeeId=${encodeURIComponent(employeeId)}` : ''}`
  ),
  getSummary: (year, month, employeeId) => attendanceFetch(
    'GET',
    `${ATTENDANCE_ENDPOINTS.summary}?year=${year}&month=${month}${employeeId ? `&employeeId=${encodeURIComponent(employeeId)}` : ''}`
  )
};

window.AttendanceService = {
  getToday: () => callAttendanceMethod('getToday'),
  checkIn: () => callAttendanceMethod('checkIn'),
  checkOut: () => callAttendanceMethod('checkOut'),
  getMonth: (year, month, employeeId) => callAttendanceMethod('getMonth', year, month, employeeId),
  getSummary: (year, month, employeeId) => callAttendanceMethod('getSummary', year, month, employeeId)
};

// A record's status normalizes to one of: 'CHECKED_IN', 'CHECKED_OUT',
// or anything else (treated as "not started yet today").
function attendanceButtonState(record) {
  if (!record) return 'NOT_STARTED';
  if (record.checkInTime && !record.checkOutTime) return 'CHECKED_IN';
  if (record.checkInTime && record.checkOutTime) return 'CHECKED_OUT';
  return 'NOT_STARTED';
}

function applyAttendanceButtonState(state) {
  const btn = document.getElementById('attendance-nav-btn');
  if (!btn) return;
  const icon = document.getElementById('attendance-nav-icon');
  const label = document.getElementById('attendance-nav-label');
  const dot = document.getElementById('attendance-nav-dot');

  btn.classList.remove('state-checkin', 'state-checkout', 'state-done');

  if (state === 'CHECKED_IN') {
    btn.classList.add('state-checkout');
    if (icon) icon.textContent = '⏱️';
    if (label) label.textContent = 'Check Out';
    if (dot) dot.style.display = 'inline-block';
    btn.setAttribute('aria-label', 'Checked in — tap to check out');
    btn.title = 'Checked in — tap to check out';
  } else if (state === 'CHECKED_OUT') {
    btn.classList.add('state-done');
    if (icon) icon.textContent = '✅';
    if (label) label.textContent = 'Checked Out';
    if (dot) dot.style.display = 'none';
    btn.setAttribute('aria-label', 'Checked out for today — view attendance');
    btn.title = 'Checked out for today — view attendance';
  } else {
    btn.classList.add('state-checkin');
    if (icon) icon.textContent = '🕒';
    if (label) label.textContent = 'Check In';
    if (dot) dot.style.display = 'none';
    btn.setAttribute('aria-label', 'Not checked in — tap to check in');
    btn.title = 'Not checked in — tap to check in';
  }
}

async function refreshAttendanceNavButton() {
  const btn = document.getElementById('attendance-nav-btn');
  if (!btn) return;
  try {
    const record = await window.AttendanceService.getToday();
    applyAttendanceButtonState(attendanceButtonState(record));
  } catch (err) {
    // Keep the button usable even if the status fetch failed — the
    // attendance page itself will surface the real error.
    applyAttendanceButtonState('NOT_STARTED');
  }
}

function renderAttendanceNavButton(container) {
  const wrap = document.createElement('button');
  wrap.className = 'btn btn-secondary btn-sm attendance-nav-btn state-checkin';
  wrap.id = 'attendance-nav-btn';
  wrap.type = 'button';
  wrap.title = 'Attendance';
  wrap.setAttribute('aria-label', 'Attendance');
  wrap.innerHTML = `
    <span class="attendance-nav-dot" id="attendance-nav-dot" style="display:none;"></span>
    <span class="navbar-icon" id="attendance-nav-icon">🕒</span>
    <span class="navbar-label" id="attendance-nav-label">Attendance</span>
  `;
  wrap.addEventListener('click', () => {
    window.location.href = '/pages/attendance.html';
  });
  container.appendChild(wrap);

  refreshAttendanceNavButton();

  // Refresh instantly when attendance.html tells us something changed,
  // and whenever the tab regains focus (covers "checked in on phone,
  // came back to this tab" without needing a poll timer).
  window.addEventListener('attendance:changed', refreshAttendanceNavButton);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshAttendanceNavButton();
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

      <div class="navbar-right" id="navbar-right">
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

  // Insert the attendance IN/OUT button as the FIRST action in the
  // navbar-right cluster (before the theme toggle) so it stays in the
  // same prominent, always-reachable spot as the other icon-only
  // actions once the ≤576px collapse rules kick in.
  const navbarRight = document.getElementById('navbar-right');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (navbarRight && themeToggleBtn) {
    const attendanceHolder = document.createElement('span');
    navbarRight.insertBefore(attendanceHolder, themeToggleBtn);
    renderAttendanceNavButton(navbarRight);
    // renderAttendanceNavButton appends to the end of navbarRight by
    // default; move the button we just created to right before the
    // placeholder, then drop the placeholder.
    const btn = document.getElementById('attendance-nav-btn');
    if (btn) navbarRight.insertBefore(btn, attendanceHolder);
    attendanceHolder.remove();
  }

  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  toggleBtn.addEventListener('click', () => {
    const sidebar = document.getElementById('app-sidebar');
    const mainContent = document.querySelector('.main-content');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;

    if (isMobileViewport()) {
      // Defensive: never let 'collapsed' fight 'mobile-open'
      sidebar.classList.remove('collapsed');
      mainContent?.classList.remove('sidebar-collapsed');

      const isOpen = sidebar.classList.toggle('mobile-open');
      if (overlay) overlay.classList.toggle('active', isOpen);
      toggleBtn.classList.toggle('is-open', isOpen);
      document.body.classList.toggle('no-scroll', isOpen);
    } else {
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

  const savedTheme = localStorage.getItem('theme') || 'light';
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
      const sidebar = document.getElementById('app-sidebar');
      sidebar?.classList.remove('mobile-open');
      overlay.classList.remove('active');
      toggleBtn.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
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
  const savedTheme = localStorage.getItem('theme') || 'light';
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
  const overlay = document.getElementById('sidebar-overlay');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (!sidebar) return;

  if (e.matches) {
    // Entered mobile: strip desktop-only state
    sidebar.classList.remove('collapsed');
    mainContent?.classList.remove('sidebar-collapsed');
  } else {
    // Entered desktop: strip mobile-only state, restore collapsed pref
    sidebar.classList.remove('mobile-open');
    overlay?.classList.remove('active');
    document.body.classList.remove('no-scroll');
    toggleBtn?.classList.remove('is-open');

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
})