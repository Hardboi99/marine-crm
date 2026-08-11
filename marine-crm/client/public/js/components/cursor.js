// /public/js/components/cursor.js
// Custom Cursor — Zero lag, instant follow, theme-aware premium dot & ring

(function () {
    const coarseQuery = window.matchMedia('(pointer: coarse)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    let dot, ring;
    let isRunning = false;

    // We do not use requestAnimationFrame easing anymore to ensure zero lag.
    
    function shouldRun() {
        return !coarseQuery.matches && !reducedMotionQuery.matches;
    }

    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }

    function applyThemeClass() {
        const isLight = currentTheme() === 'light';
        if (dot) dot.classList.toggle('theme-light', isLight);
        if (ring) ring.classList.toggle('theme-light', isLight);
    }

    function createElements() {
        if (dot && ring) return;
        
        dot = document.createElement('div');
        dot.className = 'cursor-dot';
        
        ring = document.createElement('div');
        ring.className = 'cursor-ring';
        
        applyThemeClass();
        document.body.appendChild(ring);
        document.body.appendChild(dot);
    }

    function removeElements() {
        if (dot) { dot.remove(); dot = null; }
        if (ring) { ring.remove(); ring = null; }
    }

    // Direct mapping on mouse move for absolute 0-lag
    function onMouseMove(e) {
        const x = e.clientX;
        const y = e.clientY;
        
        if (dot) {
            dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
            dot.style.opacity = '1';
        }
        if (ring) {
            ring.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
            ring.style.opacity = '1';
        }
    }

    function onMouseLeaveDoc() {
        if (dot) dot.style.opacity = '0';
        if (ring) ring.style.opacity = '0';
    }

    function onMouseEnterDoc(e) {
        if (typeof e.clientX === 'number') onMouseMove(e);
    }

    function onMouseDown() { if (ring) ring.classList.add('is-down'); }
    function onMouseUp() { if (ring) ring.classList.remove('is-down'); }

    const hoverSelector = 'a, button, .btn, .nav-item, .nav-group-header, .nav-subitem, input, select, textarea, .card, .stat-card, .quick-action-card, [role="button"], .checklist-item';
    
    function onMouseOver(e) {
        if (ring && e.target.closest && e.target.closest(hoverSelector)) {
            ring.classList.add('is-hover');
        }
    }
    
    function onMouseOut(e) {
        if (ring && e.target.closest && e.target.closest(hoverSelector)) {
            ring.classList.remove('is-hover');
        }
    }

    function onThemeChange() { applyThemeClass(); }

    function start() {
        if (isRunning) return;
        createElements();
        document.body.classList.add('custom-cursor-active');
        isRunning = true;
    }

    function stop() {
        if (!isRunning) return;
        isRunning = false;
        document.body.classList.remove('custom-cursor-active');
        removeElements();
    }

    function evaluate() {
        if (shouldRun()) start();
        else stop();
    }

    function init() {
        document.addEventListener('mousemove', onMouseMove, { passive: true });
        document.addEventListener('mouseleave', onMouseLeaveDoc);
        document.addEventListener('mouseenter', onMouseEnterDoc);
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('mouseover', onMouseOver);
        document.addEventListener('mouseout', onMouseOut);
        window.addEventListener('themechange', onThemeChange);

        coarseQuery.addEventListener('change', evaluate);
        reducedMotionQuery.addEventListener('change', evaluate);

        evaluate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();