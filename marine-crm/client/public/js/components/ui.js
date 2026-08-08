// Reusable Helper Components & UI Utilities — Marine BDM CRM

const UI = {

  // ─── TOAST NOTIFICATIONS ────────────────────────────────────
  showToast: (message, type = 'info', duration = 4000) => {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const iconMap = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${iconMap[type] || 'ℹ'}</span>
      <div class="toast-content" style="flex:1">${message}</div>
      <button onclick="this.closest('.toast').remove()" style="background:none;border:none;color:inherit;opacity:0.5;cursor:pointer;font-size:1rem;padding:0 0 0 8px;">×</button>
    `;

    container.appendChild(toast);

    // Auto dismiss
    const timer = setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);

    toast.querySelector('button').addEventListener('click', () => clearTimeout(timer));
  },

  // ─── MODAL ──────────────────────────────────────────────────
  createModal: ({ title, bodyHtml, footerHtml, customClass = '', onClose }) => {
    // Remove any existing modal from DOM directly (no animation, no recursion)
    const existing = document.querySelector('.modal-overlay');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal ${customClass}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" id="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>
    `;

    document.body.appendChild(overlay);

    // Single source of truth for closing — no recursion
    let _closed = false;
    const closeModal = () => {
      if (_closed) return;
      _closed = true;
      overlay.style.opacity = '0';
      const modalBox = overlay.querySelector('.modal');
      if (modalBox) {
        modalBox.style.transform = 'scale(0.95) translateY(10px)';
        modalBox.style.transition = 'all 0.2s ease';
      }
      setTimeout(() => {
        // Use the native HTMLElement.remove() via prototype to avoid any override
        HTMLElement.prototype.remove.call(overlay);
        if (onClose) onClose();
      }, 200);    
    };

    const closeBtn = overlay.querySelector('#modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Expose only .close() — do NOT override .remove() to avoid recursion
    overlay.close = closeModal;

    return overlay;
  },

  // ─── CONFIRM DIALOG ─────────────────────────────────────────
  // Accepts either UI.confirm('message') or UI.confirm({ title, message, ... })
  confirm: (optionsOrMessage) => {
    const opts = typeof optionsOrMessage === 'string'
      ? { message: optionsOrMessage }
      : (optionsOrMessage || {});
    const { title = 'Are you sure?', message = '', confirmText = 'Delete', cancelText = 'Cancel', danger = true } = opts;
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-box">
          <div class="confirm-icon">${danger ? '🗑️' : '❓'}</div>
          <div class="confirm-title">${title}</div>
          <div class="confirm-message">${message}</div>
          <div class="confirm-actions">
            <button id="confirm-cancel" class="btn btn-secondary">${cancelText}</button>
            <button id="confirm-ok" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${confirmText}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const cleanup = (result) => {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s';
        setTimeout(() => overlay.remove(), 200);
        resolve(result);
      };

      overlay.querySelector('#confirm-ok').addEventListener('click', () => cleanup(true));
      overlay.querySelector('#confirm-cancel').addEventListener('click', () => cleanup(false));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    });
  },

  // ─── ANIMATED COUNTUP ───────────────────────────────────────
  countUp: (element, target, duration = 1000, prefix = '', suffix = '') => {
    if (!element) return;
    const start = Date.now();
    const startVal = 0;
    const update = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (target - startVal) * eased);
      element.textContent = prefix + current.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  },

  // ─── SKELETON LOADER ────────────────────────────────────────
  showTableSkeleton: (tbody, cols = 5, rows = 5) => {
    if (!tbody) return;
    tbody.innerHTML = Array(rows).fill(0).map(() => `
      <tr>
        ${Array(cols).fill(0).map(() => `<td><div class="skeleton skeleton-text w-75"></div></td>`).join('')}
      </tr>
    `).join('');
  },

  showStatsSkeleton: () => {
    document.querySelectorAll('.stat-value').forEach(el => {
      el.innerHTML = '<div class="skeleton skeleton-stat"></div>';
    });
  },

  // ─── DATE FORMATTERS ────────────────────────────────────────
  formatDate: (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  },

  formatDateTime: (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-GB', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  formatRelativeTime: (dateStr) => {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs  = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 1)    return 'just now';
    if (mins < 60)   return `${mins}m ago`;
    if (hrs < 24)    return `${hrs}h ago`;
    if (days < 7)    return `${days}d ago`;
    return UI.formatDate(dateStr);
  },

  daysUntil: (dateStr) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
  },

  // ─── STATUS BADGES ───────────────────────────────────────────
  renderStatusBadge: (status) => {
    const map = {
      PROSPECT:    'badge-blue',
      NEGOTIATING: 'badge-yellow',
      CLIENT:      'badge-green',
      REJECTED:    'badge-red',
      ACTIVE:      'badge-green',
      DRAFT:       'badge-gray',
      EXPIRED:     'badge-red',
      CANCELLED:   'badge-red',
      PENDING:     'badge-yellow',
      COMPLETED:   'badge-green',
      SELECTED:    'badge-green',
      YES:         'badge-green',
      NO:          'badge-red',
    };
    const cls = map[status] || 'badge-gray';
    return `<span class="badge ${cls}">${status}</span>`;
  },

  renderRYGBadge: (color) => {
    if (!color) return '<span class="badge badge-gray">N/A</span>';
    const cls = color.toLowerCase();
    const labels = { red: '🔴 Red', yellow: '🟡 Yellow', green: '🟢 Green' };
    return `<span class="status-ryg ${cls}">${labels[cls] || color}</span>`;
  },

  renderPipelineDot: (status) => {
    const cls = (status || '').toLowerCase();
    return `<span class="pipeline-dot ${cls}"></span>`;
  },

  // ─── EMPTY STATE ─────────────────────────────────────────────
  renderEmptyState: (icon, title, message, actionHtml = '') => {
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <h3>${title}</h3>
        <p>${message}</p>
        ${actionHtml}
      </div>
    `;
  },

  // ─── AUTH GUARD ──────────────────────────────────────────────
  requireAuth: () => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/pages/login.html';
      return false;
    }
    return true;
  },

  getUser: () => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); }
    catch { return {}; }
  }
};

window.UI = UI;