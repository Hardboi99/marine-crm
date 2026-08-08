// Custom Cursor Effect — Marine BDM CRM (glow-only v2)
// A single soft aqua glow that follows the pointer. No ring, no border,
// no circle outline — just light. Desktop pointer devices only.
//
// Changes vs the ring version:
//  - Removed the lagging ring element entirely (.cursor-ring is gone).
//  - Kept one element, .cursor-glow, which is a blurred radial-gradient
//    "light" with no border/outline of any kind.
//  - The glow eases toward the pointer for a soft, weighted feel instead
//    of snapping exactly to the cursor position every frame.
//  - Still opacity:0 by default (see cursor-glow.css) so it never flashes
//    at (0,0) before the first mousemove.
//  - Still fully disabled on coarse/touch pointers and when the user has
//    prefers-reduced-motion set, and re-evaluates live if either changes.
//  - rAF loop pauses when the tab is hidden, resumes on visibility.

(function () {
  const coarseQuery = window.matchMedia('(pointer: coarse)');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let glow, rafId = null;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let glowX = mouseX;
  let glowY = mouseY;
  let running = false;

  function shouldRun() {
    return !coarseQuery.matches && !reducedMotionQuery.matches;
  }

  function createElements() {
    if (glow) return;
    glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.body.appendChild(glow);
  }

  function removeElements() {
    if (glow) { glow.remove(); glow = null; }
  }

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (glow) glow.style.opacity = '1';
  }

  function onMouseLeaveDoc() {
    if (glow) glow.style.opacity = '0';
  }

  function onMouseEnterDoc(e) {
    // Snap to the pointer immediately, no lag-in after a tab switch.
    if (typeof e.clientX === 'number') {
      mouseX = e.clientX;
      mouseY = e.clientY;
      glowX = mouseX;
      glowY = mouseY;
    }
    if (glow) glow.style.opacity = '1';
  }

  function onMouseDown() { if (glow) glow.classList.add('is-down'); }
  function onMouseUp() { if (glow) glow.classList.remove('is-down'); }

  const hoverSelector = 'a, button, .btn, .nav-item, input, select, textarea, .card, .stat-card, .quick-action-card, [role="button"]';
  function onMouseOver(e) {
    if (glow && e.target.closest && e.target.closest(hoverSelector)) {
      glow.classList.add('is-hover');
    }
  }
  function onMouseOut(e) {
    if (glow && e.target.closest && e.target.closest(hoverSelector)) {
      glow.classList.remove('is-hover');
    }
  }

  function tick() {
    if (!running) return;
    // Soft easing — the glow trails the pointer slightly for a weighted,
    // light-like feel rather than rigidly locking to the cursor.
    glowX += (mouseX - glowX) * 0.16;
    glowY += (mouseY - glowY) * 0.16;
    if (glow) glow.style.transform = `translate(${glowX}px, ${glowY}px) translate(-50%, -50%)`;
    rafId = requestAnimationFrame(tick);
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (running && !rafId) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function start() {
    if (running) return;
    createElements();
    document.body.classList.add('custom-cursor-active');
    running = true;
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (!running) return;
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
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
    document.addEventListener('visibilitychange', onVisibilityChange);

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