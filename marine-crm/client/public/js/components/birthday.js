// Birthday Celebration Widget — Marine BDM CRM (Premium Edition, v2)
// ------------------------------------------------------------------
// Self-mounting, vanilla JS/CSS only (no frameworks). Include this
// script on any page and it will:
//
//   1. Render the existing floating "Upcoming Birthdays" pill/panel
//      (bottom-right desktop, bottom-center mobile) on EVERY page —
//      structure kept intact from the previous version.
//   2. If ANY employee's birthday is today, automatically show a
//      full-screen Celebration Popup as soon as the data loads on
//      page load — confetti, balloons, sparkles, glowing avatar ring,
//      the works — BUT ONLY ON THE DASHBOARD PAGE (dashboard.html).
//      On every other page (employee, HR, reports, follow-ups,
//      appointments, reception, etc.) the widget/panel/badge still
//      shows and still loads data, it just never opens the popup.
//   3. Clicking ANY birthday card in the panel (today or upcoming)
//      opens the same popup for that specific person — again, only
//      when the current page is the dashboard. On any other page a
//      card click simply closes the panel and does nothing else.
//   4. "Today" cards in the list get a stronger gradient, pulsing
//      glow border, gentle float, and a small animated cake icon.
//      Upcoming cards keep the clean look with just a hover lift.
//
// v2 change: added isDashboardPage() and routed every call site that
// opens the celebration popup (auto-trigger + card click) through
// openCelebrationFor(), which now checks the page first and no-ops
// everywhere else. Nothing about the confetti/balloon/sparkle
// effects, popup markup, or card styling was changed.
//
// Data source: window.ApiService.employees.getUpcomingBirthdays()
// Expected fields per record (extra/missing fields degrade
// gracefully): name, position, dateOfBirth, isToday, daysUntil,
// employeeId (optional), joinDate (optional), photo/avatarUrl
// (optional).
// ------------------------------------------------------------------

(function () {
  const STYLE_ID = "bday-widget-styles";

  const MESSAGES = [
    "Wishing you smooth sailing, fair winds, and an amazing year ahead!",
    "Hope your day is as wonderful as you are — enjoy every moment!",
    "Another year, another voyage — here's to new adventures ahead!",
    "Thank you for everything you bring to the crew. Have a fantastic birthday!",
    "May this year bring you calm seas and even better opportunities.",
  ];

  // ── Page gate ─────────────────────────────────────────────────
  // The celebration popup (auto-trigger AND card-click trigger) is
  // only allowed to open when the current page is dashboard.html.
  // Everything else about the widget (fab, panel, badge, data load)
  // still runs on every page.
  function isDashboardPage() {
    const path = window.location.pathname.toLowerCase();
    return path.endsWith("/dashboard.html") || path === "/dashboard.html" || path.endsWith("dashboard");
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* ============================================================
         FLOATING WIDGET (pill + panel)
         ============================================================ */
      .bday-widget {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 9500;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      }

      .bday-fab {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 18px 12px 14px;
        border-radius: 999px;
        border: 1px solid var(--glass-border);
        background: var(--glass-bg);
        backdrop-filter: blur(var(--glass-blur));
        -webkit-backdrop-filter: blur(var(--glass-blur));
        box-shadow: var(--shadow-lg);
        color: var(--text-primary);
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        position: relative;
        animation: bdayFloat 3.6s ease-in-out infinite;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      }

      .bday-fab:hover {
        transform: translateY(-3px);
        border-color: rgba(45, 212, 191, 0.4);
        box-shadow: var(--shadow-glow-teal);
      }

      .bday-fab .bday-emoji {
        font-size: 1.25rem;
        line-height: 1;
        display: inline-block;
        animation: bdaySway 2.4s ease-in-out infinite;
      }

      .bday-fab.has-today {
        border-color: rgba(242, 197, 114, 0.55);
        box-shadow: 0 0 0 1px rgba(242, 197, 114, 0.25), var(--shadow-lg);
      }

      .bday-fab.has-today::before {
        content: '';
        position: absolute;
        inset: -3px;
        border-radius: 999px;
        border: 1.5px solid rgba(242, 197, 114, 0.55);
        animation: bdayRing 1.8s ease-out infinite;
        pointer-events: none;
      }

      .bday-fab .bday-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 20px;
        background: linear-gradient(135deg, var(--yellow), #ef4444);
        color: #1a1300;
        font-size: 0.68rem;
        font-weight: 800;
      }

      @keyframes bdayFloat { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-7px);} }
      @keyframes bdaySway  { 0%,100% { transform: rotate(-6deg);} 50% { transform: rotate(8deg);} }
      @keyframes bdayRing  { 0% { opacity:0.65; transform:scale(1);} 100% { opacity:0; transform:scale(1.18);} }

      .bday-panel {
        width: 320px;
        max-width: calc(100vw - 32px);
        max-height: 60vh;
        display: flex;
        flex-direction: column;
        border-radius: var(--radius-lg);
        background: var(--bg-card);
        border: 1px solid var(--glass-border);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        transform-origin: bottom right;
        transform: scale(0.9) translateY(8px);
        opacity: 0;
        pointer-events: none;
        transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.18s ease;
      }

      .bday-widget.open .bday-panel {
        transform: scale(1) translateY(0);
        opacity: 1;
        pointer-events: auto;
      }

      .bday-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border-color);
        background: linear-gradient(135deg, rgba(20, 184, 166, 0.08), rgba(34, 211, 238, 0.04));
        flex-shrink: 0;
      }

      .bday-panel-header h4 {
        margin: 0;
        font-size: 0.92rem;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .bday-panel-close {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 1px solid var(--border-color);
        background: var(--bg-input);
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        font-size: 0.75rem;
        transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
      }

      .bday-panel-close:hover {
        background: rgba(248, 113, 113, 0.15);
        color: #f87171;
        transform: rotate(90deg);
      }

      .bday-panel-body {
        overflow-y: auto;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      /* ── Birthday cards ────────────────────────────────────────── */
      .bday-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 11px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
        background: rgba(255, 255, 255, 0.02);
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, border-color 0.2s ease;
      }

      .bday-row:not(.is-today):hover {
        transform: translateY(-3px) scale(1.015);
        box-shadow: var(--shadow-card);
        border-color: rgba(45, 212, 191, 0.3);
      }

      .bday-row:not(.is-today):active {
        transform: translateY(-1px) scale(1.0);
      }

      .bday-row.is-today {
        position: relative;
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(239, 68, 68, 0.1));
        border: 1px solid rgba(245, 158, 11, 0.4);
        animation: bdayCardFloat 3.2s ease-in-out infinite;
      }

      .bday-row.is-today::before {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: inherit;
        border: 1.5px solid rgba(245, 158, 11, 0.55);
        animation: bdayCardPulse 1.8s ease-out infinite;
        pointer-events: none;
      }

      .bday-row.is-today:hover {
        transform: translateY(-4px) scale(1.02);
        box-shadow: 0 10px 26px rgba(245, 158, 11, 0.25);
      }

      @keyframes bdayCardFloat { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-3px);} }
      @keyframes bdayCardPulse { 0% { opacity:0.7; transform:scale(1);} 100% { opacity:0; transform:scale(1.035);} }

      .bday-row-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.7rem;
        font-weight: 700;
        color: #fff;
        background: linear-gradient(135deg, #0ea5e9, #6366f1);
        overflow: hidden;
      }
      .bday-row-avatar img { width: 100%; height: 100%; object-fit: cover; }

      .bday-row-info { flex: 1; min-width: 0; }

      .bday-row-name {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .bday-row-meta {
        font-size: 0.72rem;
        color: var(--text-muted);
        margin-top: 1px;
      }

      .bday-row-tag {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.66rem;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 20px;
        white-space: nowrap;
      }

      .bday-row-tag.today {
        background: linear-gradient(135deg, #f59e0b, #ef4444);
        color: #fff;
      }

      .bday-row-tag .bday-cake-icon {
        display: inline-block;
        animation: bdayCakeWiggle 1.4s ease-in-out infinite;
      }

      @keyframes bdayCakeWiggle {
        0%, 100% { transform: rotate(0deg); }
        25%      { transform: rotate(-12deg); }
        75%      { transform: rotate(12deg); }
      }

      .bday-row-tag.soon {
        background: rgba(99, 102, 241, 0.15);
        color: #818cf8;
      }

      .bday-empty {
        text-align: center;
        padding: 24px 12px;
        color: var(--text-muted);
        font-size: 0.82rem;
      }

      @media (max-width: 640px) {
        .bday-widget {
          right: 50%;
          bottom: 18px;
          transform: translateX(50%);
          align-items: center;
        }
        .bday-panel {
          width: min(340px, calc(100vw - 24px));
          transform-origin: bottom center;
        }
      }

      /* ============================================================
         CELEBRATION POPUP
         ============================================================ */
      .bday-cele-overlay {
        position: fixed;
        inset: 0;
        z-index: 10500;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(4, 10, 18, 0.72);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }

      .bday-cele-overlay.active {
        opacity: 1;
        pointer-events: auto;
      }

      .bday-cele-card {
        position: relative;
        width: 100%;
        max-width: 420px;
        max-height: 92vh;
        overflow-y: auto;
        border-radius: 26px;
        padding: 30px 26px 26px;
        text-align: center;
        background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg-secondary) 100%);
        border: 1px solid rgba(242, 197, 114, 0.3);
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(242, 197, 114, 0.12), 0 0 60px rgba(242, 197, 114, 0.12);
        transform: scale(0.72) translateY(30px);
        opacity: 0;
        transition: transform 0.5s cubic-bezier(0.22, 1.4, 0.36, 1), opacity 0.3s ease;
      }

      .bday-cele-overlay.active .bday-cele-card {
        transform: scale(1) translateY(0);
        opacity: 1;
      }

      .bday-cele-card.calm {
        border-color: var(--glass-border);
        box-shadow: var(--shadow-lg);
      }

      .bday-cele-close {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid var(--border-color);
        background: var(--bg-input);
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 2;
        transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
      }

      .bday-cele-close:hover {
        background: rgba(248, 113, 113, 0.15);
        color: #f87171;
        transform: rotate(90deg);
      }

      /* ── Custom Brand Logo Styling ── */
      .bday-cele-brand-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 24px;
      }

      .bday-cele-brand-wrapper .login-logo-icon {
        height: 46px;
        width: auto;
        object-fit: contain;
      }

      .bday-cele-brand-wrapper .logo-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }

     .bday-cele-brand-wrapper .logo-title {
        font-size: 1.25rem;
        font-weight: 900;
        letter-spacing: 0.05em;
        margin: 0;
        background: linear-gradient(90deg, #0ea5e9, #1e3a8a);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .bday-cele-avatar-wrap {
        position: relative;
        width: 108px;
        height: 108px;
        margin: 0 auto 16px;
      }

      .bday-cele-avatar-ring {
        position: absolute;
        inset: -8px;
        border-radius: 50%;
        background: conic-gradient(from 0deg, #f59e0b, #ef4444, #f2c572, #14b8a6, #f59e0b);
        animation: bdaySpin 4s linear infinite;
      }

      .bday-cele-card.calm .bday-cele-avatar-ring {
        background: conic-gradient(from 0deg, var(--accent-primary), var(--accent-aqua), var(--accent-primary));
        animation-duration: 7s;
      }

      @keyframes bdaySpin { to { transform: rotate(360deg); } }

      .bday-cele-avatar {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2.1rem;
        font-weight: 800;
        color: #fff;
        background: linear-gradient(135deg, #0ea5e9, #6366f1);
        border: 4px solid var(--bg-card);
      }
      .bday-cele-avatar img { width: 100%; height: 100%; object-fit: cover; }

      .bday-cele-badge {
        position: absolute;
        bottom: -4px;
        right: -2px;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        background: linear-gradient(135deg, #f59e0b, #ef4444);
        border: 3px solid var(--bg-card);
        box-shadow: 0 0 14px rgba(245, 158, 11, 0.7);
        animation: bdayBadgeBounce 1.6s ease-in-out infinite;
      }

      @keyframes bdayBadgeBounce {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50%      { transform: translateY(-4px) rotate(-8deg); }
      }

      .bday-cele-heading {
        font-family: 'Manrope', 'Inter', sans-serif;
        font-size: 1.5rem;
        font-weight: 800;
        margin: 4px 0 2px;
        background: linear-gradient(90deg, var(--text-primary), var(--accent-aqua));
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .bday-cele-name {
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: 2px;
      }

      .bday-cele-role {
        font-size: 0.8rem;
        color: var(--accent-aqua);
        font-weight: 600;
        margin-bottom: 14px;
      }

      .bday-cele-message {
        font-size: 0.86rem;
        line-height: 1.6;
        color: var(--text-secondary);
        padding: 14px 16px;
        border-radius: 14px;
        background: var(--bg-input);
        border: 1px solid var(--border-color);
        margin-bottom: 16px;
      }

      .bday-cele-meta {
        display: flex;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }

      .bday-cele-meta-pill {
        font-size: 0.72rem;
        color: var(--text-muted);
        background: var(--bg-input);
        border: 1px solid var(--border-color);
        padding: 5px 12px;
        border-radius: 20px;
      }

      .bday-cele-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
      }

      .bday-cele-nav {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-top: 16px;
      }

      .bday-cele-nav button {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 1px solid var(--border-color);
        background: var(--bg-input);
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }
      .bday-cele-nav button:hover { border-color: var(--accent-primary); color: var(--accent-primary); }
      .bday-cele-nav button:disabled { opacity: 0.35; cursor: not-allowed; }

      .bday-cele-dots { display: flex; gap: 6px; }
      .bday-cele-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: var(--border-color);
        transition: background 0.2s ease, transform 0.2s ease;
      }
      .bday-cele-dot.active { background: var(--accent-primary); transform: scale(1.3); }

      @media (max-width: 480px) {
        .bday-cele-card { padding: 24px 18px 20px; border-radius: 20px; }
        .bday-cele-avatar-wrap { width: 92px; height: 92px; }
        .bday-cele-heading { font-size: 1.28rem; }
      }

      /* ── Confetti canvas ──────────────────────────────────────── */
      .bday-confetti-canvas {
        position: fixed;
        inset: 0;
        z-index: 10510;
        pointer-events: none;
      }

      /* ── Balloons ─────────────────────────────────────────────── */
      .bday-balloon {
        position: fixed;
        bottom: -80px;
        z-index: 10505;
        font-size: 2.2rem;
        pointer-events: none;
        animation-name: bdayBalloonRise;
        animation-timing-function: ease-in;
        animation-fill-mode: forwards;
        filter: drop-shadow(0 6px 10px rgba(0,0,0,0.25));
      }

      @keyframes bdayBalloonRise {
        0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
        8%   { opacity: 1; }
        100% { transform: translateY(-115vh) translateX(var(--bday-drift, 30px)) rotate(8deg); opacity: 0; }
      }

      /* ── Sparkles ─────────────────────────────────────────────── */
      .bday-sparkle {
        position: fixed;
        z-index: 10506;
        pointer-events: none;
        font-size: 1rem;
        color: #f2c572;
        animation: bdaySparkleTwinkle 1.4s ease-in-out infinite;
      }

      @keyframes bdaySparkleTwinkle {
        0%, 100% { opacity: 0; transform: scale(0.4) rotate(0deg); }
        50%      { opacity: 1; transform: scale(1) rotate(90deg); }
      }

      @media (prefers-reduced-motion: reduce) {
        .bday-fab, .bday-fab .bday-emoji, .bday-fab.has-today::before,
        .bday-row.is-today, .bday-row.is-today::before,
        .bday-cele-avatar-ring, .bday-cele-badge,
        .bday-balloon, .bday-sparkle, .bday-cake-icon {
          animation: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function initials(name) {
    return (name || "")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function avatarHtml(emp) {
    const photo = emp.photo || emp.avatarUrl || emp.photoUrl;
    if (photo) return `<img src="${photo}" alt="${emp.name}" />`;
    return initials(emp.name);
  }

  function pickMessage(emp) {
    const seed = (emp.name || "").length + (emp.daysUntil || 0);
    return MESSAGES[seed % MESSAGES.length];
  }

  function buildRow(emp, index) {
    const dob = new Date(emp.dateOfBirth);
    const dobStr = dob.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    const tag = emp.isToday
      ? `<span class="bday-row-tag today"><span class="bday-cake-icon">🎂</span> Today</span>`
      : `<span class="bday-row-tag soon">In ${emp.daysUntil} day${emp.daysUntil === 1 ? "" : "s"}</span>`;
    return `
      <div class="bday-row ${emp.isToday ? "is-today" : ""}" data-bday-index="${index}" tabindex="0" role="button" aria-label="View birthday card for ${emp.name}">
        <div class="bday-row-avatar">${avatarHtml(emp)}</div>
        <div class="bday-row-info">
          <div class="bday-row-name">${emp.name}</div>
          <div class="bday-row-meta">📅 ${dobStr}${emp.position ? " · " + emp.position : ""}</div>
        </div>
        ${tag}
      </div>`;
  }

  /* ------------------------------------------------------------
     CONFETTI / BALLOONS / SPARKLES
     ------------------------------------------------------------ */
  function launchConfetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = document.createElement("canvas");
    canvas.className = "bday-confetti-canvas";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const colors = ["#14B8A6", "#22D3EE", "#F2C572", "#F87171", "#A78BFA", "#34D399"];
    const pieces = [];
    const count = Math.min(160, Math.floor((window.innerWidth * window.innerHeight) / 9000));

    for (let i = 0; i < count; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.5,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy: 2 + Math.random() * 3.5,
        vx: -1.5 + Math.random() * 3,
        rot: Math.random() * 360,
        vr: -8 + Math.random() * 16,
        tilt: Math.random() * Math.PI * 2,
      });
    }

    let frame = 0;
    const maxFrames = 260;

    function draw() {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = frame > maxFrames - 40 ? Math.max(0, (maxFrames - frame) / 40) : 1;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (frame < maxFrames) {
        requestAnimationFrame(draw);
      } else {
        canvas.remove();
      }
    }
    requestAnimationFrame(draw);

    window.addEventListener(
      "resize",
      function onResize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      },
      { once: true },
    );
  }

  function launchBalloons() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const emojis = ["🎈", "🎈", "🎈", "🎉", "🎊"];
    const count = 9;
    for (let i = 0; i < count; i++) {
      const b = document.createElement("div");
      b.className = "bday-balloon";
      b.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      const leftPct = 5 + Math.random() * 90;
      const duration = 4.5 + Math.random() * 2.5;
      const delay = Math.random() * 0.8;
      const drift = -60 + Math.random() * 120;
      b.style.left = leftPct + "vw";
      b.style.setProperty("--bday-drift", drift + "px");
      b.style.animationDuration = duration + "s";
      b.style.animationDelay = delay + "s";
      document.body.appendChild(b);
      setTimeout(() => b.remove(), (duration + delay) * 1000 + 200);
    }
  }

  function launchSparkles() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const count = 16;
    for (let i = 0; i < count; i++) {
      const s = document.createElement("div");
      s.className = "bday-sparkle";
      s.textContent = "✦";
      s.style.left = Math.random() * 100 + "vw";
      s.style.top = Math.random() * 100 + "vh";
      s.style.animationDelay = Math.random() * 1.2 + "s";
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 5200);
    }
  }

  /* ------------------------------------------------------------
     CELEBRATION POPUP
     ------------------------------------------------------------ */
  let celebrationOverlay = null;
  let celebrationList = [];
  let celebrationIndex = 0;

  function ensureOverlay() {
    if (celebrationOverlay) return celebrationOverlay;
    const overlay = document.createElement("div");
    overlay.className = "bday-cele-overlay";
    overlay.innerHTML = `<div class="bday-cele-card" id="bday-cele-card"></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeCelebration();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("active")) closeCelebration();
      if (overlay.classList.contains("active")) {
        if (e.key === "ArrowRight") stepCelebration(1);
        if (e.key === "ArrowLeft") stepCelebration(-1);
      }
    });
    celebrationOverlay = overlay;
    return overlay;
  }

  function renderCelebrationCard() {
    const overlay = ensureOverlay();
    const card = overlay.querySelector("#bday-cele-card");
    const emp = celebrationList[celebrationIndex];
    if (!emp) return;

    const isToday = !!emp.isToday;
    card.className = "bday-cele-card" + (isToday ? "" : " calm");

    const metaPills = [];
    if (emp.employeeId) metaPills.push(`<span class="bday-cele-meta-pill"><i class="fas fa-id-badge"></i> ${emp.employeeId}</span>`);
    if (emp.joinDate) {
      const jd = new Date(emp.joinDate);
      if (!isNaN(jd)) {
        metaPills.push(
          `<span class="bday-cele-meta-pill"><i class="fas fa-anchor"></i> Joined ${jd.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>`,
        );
      }
    }

    const nav =
      celebrationList.length > 1
        ? `
      <div class="bday-cele-nav">
        <button type="button" id="bday-cele-prev" aria-label="Previous" ${celebrationIndex === 0 ? "disabled" : ""}><i class="fas fa-chevron-left"></i></button>
        <div class="bday-cele-dots">
          ${celebrationList.map((_, i) => `<span class="bday-cele-dot ${i === celebrationIndex ? "active" : ""}"></span>`).join("")}
        </div>
        <button type="button" id="bday-cele-next" aria-label="Next" ${celebrationIndex === celebrationList.length - 1 ? "disabled" : ""}><i class="fas fa-chevron-right"></i></button>
      </div>`
        : "";

    card.innerHTML = `
      <button type="button" class="bday-cele-close" id="bday-cele-close" aria-label="Close">
        <i class="fas fa-times"></i>
      </button>

      <div class="bday-cele-brand-wrapper">
        <img src="/public/assets/logo.png.png" class="login-logo-icon" alt="Logo">
        <div class="logo-text">
          <div class="logo-title"> MARINE CRM </div>
        </div>
      </div>

      <div class="bday-cele-avatar-wrap">
        <div class="bday-cele-avatar-ring"></div>
        <div class="bday-cele-avatar">${avatarHtml(emp)}</div>
        ${isToday ? `<div class="bday-cele-badge">🎂</div>` : ""}
      </div>

      <div class="bday-cele-heading">${isToday ? "Happy Birthday!" : "Coming Up!"}</div>
      <div class="bday-cele-name">${emp.name}</div>
      ${emp.position ? `<div class="bday-cele-role">${emp.position}</div>` : `<div style="height:14px"></div>`}

      <div class="bday-cele-message">
        ${isToday ? pickMessage(emp) : `Birthday in ${emp.daysUntil} day${emp.daysUntil === 1 ? "" : "s"} — mark your calendar to wish them well!`}
      </div>

      ${metaPills.length ? `<div class="bday-cele-meta">${metaPills.join("")}</div>` : ""}

      <div class="bday-cele-actions">
        <button type="button" class="btn btn-primary" id="bday-cele-ok">${isToday ? "🎉 Celebrate" : "Got it"}</button>
      </div>

      ${nav}
    `;

    card.querySelector("#bday-cele-close").onclick = closeCelebration;
    card.querySelector("#bday-cele-ok").onclick = closeCelebration;
    const prevBtn = card.querySelector("#bday-cele-prev");
    const nextBtn = card.querySelector("#bday-cele-next");
    if (prevBtn) prevBtn.onclick = () => stepCelebration(-1);
    if (nextBtn) nextBtn.onclick = () => stepCelebration(1);
  }

  function stepCelebration(dir) {
    const next = celebrationIndex + dir;
    if (next < 0 || next >= celebrationList.length) return;
    celebrationIndex = next;
    renderCelebrationCard();
    const emp = celebrationList[celebrationIndex];
    if (emp && emp.isToday) fireCelebrationEffects();
  }

  function fireCelebrationEffects() {
    launchConfetti();
    launchBalloons();
    launchSparkles();
  }

  // ── Single choke point for opening the popup ────────────────────
  // Every call site (auto-trigger on load, and a birthday-card click
  // in the panel) goes through here. The dashboard-only restriction
  // lives in exactly one place so it can't be bypassed by adding a
  // new trigger later.
  function openCelebrationFor(list, startIndex) {
    if (!isDashboardPage()) return; // popup only ever opens on Dashboard

    celebrationList = list;
    celebrationIndex = startIndex || 0;
    renderCelebrationCard();
    const overlay = ensureOverlay();
    requestAnimationFrame(() => overlay.classList.add("active"));
    document.body.style.overflow = "hidden";

    const emp = celebrationList[celebrationIndex];
    if (emp && emp.isToday) fireCelebrationEffects();
  }

  function closeCelebration() {
    if (!celebrationOverlay) return;
    celebrationOverlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  /* ------------------------------------------------------------
     MOUNT
     ------------------------------------------------------------ */
  async function mount() {
    if (!window.ApiService || !window.ApiService.employees || !window.ApiService.employees.getUpcomingBirthdays) {
      return;
    }
    if (document.querySelector(".bday-widget")) return;

    injectStyles();

    const widget = document.createElement("div");
    widget.className = "bday-widget";
    widget.innerHTML = `
      <div class="bday-panel" role="dialog" aria-label="Upcoming birthdays">
        <div class="bday-panel-header">
          <h4><span>🎂</span> Upcoming Birthdays</h4>
          <button type="button" class="bday-panel-close" aria-label="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="bday-panel-body" id="bday-panel-body">
          <div class="bday-empty">Loading…</div>
        </div>
      </div>
      <button type="button" class="bday-fab" id="bday-fab" aria-haspopup="true" aria-expanded="false">
        <span class="bday-emoji">🎂</span>
        <span>Birthdays</span>
      </button>
    `;
    document.body.appendChild(widget);

    const fab = widget.querySelector("#bday-fab");
    const closeBtn = widget.querySelector(".bday-panel-close");
    const body = widget.querySelector("#bday-panel-body");

    function open() {
      widget.classList.add("open");
      fab.setAttribute("aria-expanded", "true");
    }
    function close() {
      widget.classList.remove("open");
      fab.setAttribute("aria-expanded", "false");
    }
    function toggle() {
      widget.classList.contains("open") ? close() : open();
    }

    fab.addEventListener("click", toggle);
    closeBtn.addEventListener("click", close);
    document.addEventListener("click", (e) => {
      if (!widget.contains(e.target)) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    let list = [];
    try {
      const res = await window.ApiService.employees.getUpcomingBirthdays();
      list = res.data || [];
      body.innerHTML = list.length
        ? list.map((emp, i) => buildRow(emp, i)).join("")
        : `<div class="bday-empty">No birthdays in the next 30 days. 🎈</div>`;

      // Card click/tap → open the same celebration popup for that
      // person. openCelebrationFor() itself enforces the dashboard-
      // only rule, so on any other page this just closes the panel
      // and nothing further happens — no modal, no confetti.
      body.querySelectorAll("[data-bday-index]").forEach((el) => {
        el.addEventListener("click", () => {
          const idx = parseInt(el.getAttribute("data-bday-index"), 10);
          close();
          openCelebrationFor(list, idx);
        });
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            el.click();
          }
        });
      });

      const todayList = list.filter((e) => e.isToday);
      if (todayList.length > 0) {
        fab.classList.add("has-today");
        fab.querySelector("span:nth-child(2)").textContent =
          todayList.length === 1 ? "1 birthday today!" : `${todayList.length} birthdays today!`;
        const badge = document.createElement("span");
        badge.className = "bday-count";
        badge.textContent = todayList.length;
        fab.appendChild(badge);

        // Auto-show the celebration popup as soon as the page loads
        // whenever there's a birthday today — openCelebrationFor()
        // still enforces the dashboard-only rule on top of this.
        //
        // SESSION GATE: sessionStorage persists for the tab's whole
        // login session but is cleared on logout (see sidebar.js) and
        // on browser/tab close, so refreshing the dashboard or coming
        // back to it later in the same session does NOT re-fire the
        // popup/confetti — only the first dashboard load after login
        // does. A manual click on a birthday card in the panel is a
        // deliberate action by the person, so it is NOT gated here —
        // it always opens the popup (and confetti, if it's today).
        const SESSION_KEY = "bdayCelebrationShown";
        if (!sessionStorage.getItem(SESSION_KEY)) {
          sessionStorage.setItem(SESSION_KEY, "true");
          setTimeout(() => openCelebrationFor(todayList, 0), 500);
        }
      }
    } catch (err) {
      body.innerHTML = `<div class="bday-empty">Could not load birthday data.</div>`;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();