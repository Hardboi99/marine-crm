(function () {
  async function checkMyBirthday() {
    try {
      const todayKey = `birthday_shown_${new Date().toISOString().split('T')[0]}`;
      if (localStorage.getItem(todayKey)) return;

      const res = await window.ApiService.employees.checkMyBirthday();
      const { isBirthdayToday, firstName } = res.data || {};
      if (!isBirthdayToday) return;

      showPopup(firstName);
      localStorage.setItem(todayKey, '1');
    } catch (e) { /* silent — non-critical */ }
  }

  function showPopup(firstName) {
    const div = document.createElement('div');
    div.id = 'birthday-popup';
    div.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);';
    div.innerHTML = `
      <div style="max-width:440px;width:100%;border-radius:20px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.5);animation:bdayPop .5s cubic-bezier(.34,1.56,.64,1) both;">
        <div style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:36px 32px;text-align:center;">
          <div style="font-size:64px;margin-bottom:8px;">🎉</div>
          <h2 style="color:#fff;margin:0;font-size:26px;font-weight:800;">Happy Birthday, ${firstName}! 🎉</h2>
        </div>
        <div style="background:var(--bg-card,#0f172a);padding:28px 32px;text-align:center;">
          <p style="color:var(--text-primary,#f1f5f9);font-size:15px;line-height:1.7;margin:0 0 20px;">
            Wishing you a fantastic birthday from the entire Marine CRM team! 🚢<br>
            May this year bring great success, health, and happiness.
          </p>
          <button id="bday-close-btn" class="btn btn-primary" style="width:100%;font-size:15px;padding:12px;">Thank you! 🎂</button>
        </div>
      </div>`;
    document.body.appendChild(div);
    const close = () => div.remove();
    div.querySelector('#bday-close-btn').onclick = close;
    div.addEventListener('click', (e) => { if (e.target === div) close(); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const user = window.UI ? window.UI.getUser() : JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.id) checkMyBirthday();
  });
})();