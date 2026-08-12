(function () {
  async function checkMyBirthday(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayKey = `birthday_shown_${userId}_${today}`;
      if (localStorage.getItem(todayKey)) return;

      const res = await window.ApiService.employees.checkMyBirthday();
      const data = (res && res.data) ? res.data : res || {};
      const { isBirthdayToday, firstName } = data;
      if (!isBirthdayToday) return;

      showPopup(firstName || 'Friend');
      localStorage.setItem(todayKey, '1');
    } catch (e) { /* silent — non-critical */ }
  }

  function showPopup(firstName) {
    const overlay = document.createElement('div');
    overlay.id = 'birthday-popup';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);';

    overlay.innerHTML = `
      <div style="max-width:520px;width:100%;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(2,6,23,0.6);animation:bdayPop .45s cubic-bezier(.2,.9,.3,1) both;background:linear-gradient(180deg,#071032 0%, #0f172a 100%);">
        <div style="padding:28px 24px 18px 24px;position:relative;">
          <button id="bday-x" aria-label="Close birthday" style="position:absolute;right:14px;top:14px;background:transparent;border:0;color:#cbd5e1;font-size:18px;cursor:pointer;">✕</button>
          <div style="font-size:56px;margin-bottom:6px;">🎉</div>
          <h2 style="color:#f8fafc;margin:0;font-size:22px;font-weight:800;">Happy Birthday, ${firstName}!</h2>
          <p style="color:#cbd5e1;margin:10px 0 0;font-size:14px;line-height:1.6;">Wishing you a fantastic day from the entire Marine CRM team — enjoy!</p>
        </div>
        <div style="padding:18px 20px 26px;border-top:1px solid rgba(255,255,255,0.03);display:flex;gap:10px;flex-wrap:wrap;">
          <button id="bday-close-btn" class="btn btn-primary" style="flex:1;min-width:120px;padding:10px 14px;font-size:15px;">Thank you! 🎂</button>
          <button id="bday-dismiss" class="btn btn-secondary" style="flex:1;min-width:120px;padding:10px 14px;font-size:15px;background:transparent;color:#cbd5e1;border:1px solid rgba(255,255,255,0.06);">Close</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const dialog = overlay.querySelector('div');
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    };

    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    overlay.querySelector('#bday-close-btn').onclick = close;
    overlay.querySelector('#bday-dismiss').onclick = close;
    overlay.querySelector('#bday-x').onclick = close;

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Focus management
    const primary = overlay.querySelector('#bday-close-btn');
    if (primary) primary.focus();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const user = window.UI ? window.UI.getUser() : JSON.parse(localStorage.getItem('user') || '{}');
    const userId = (user && (user.id || user._id)) || null;
    if (!userId) return;

    const callWhenReady = () => {
      if (window.ApiService && window.ApiService.employees && typeof window.ApiService.employees.checkMyBirthday === 'function') {
        checkMyBirthday(userId);
        return true;
      }
      return false;
    };

    if (!callWhenReady()) {
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (callWhenReady() || Date.now() - t0 > 5000) clearInterval(iv);
      }, 150);
    }
  });
})();