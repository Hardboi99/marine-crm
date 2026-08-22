// // Ocean Ambient Background — Marine BDM CRM
// // Injects a fixed, decorative background: drifting waves (CSS),
// // a sailing boat (CSS), and rising bubbles (single canvas + rAF).
// // Pauses automatically off-screen/hidden tab and respects reduced-motion.

// (function () {
//   function buildMarkup() {
//     let root = document.getElementById('ocean-bg');
//     if (!root) {
//       root = document.createElement('div');
//       root.id = 'ocean-bg';
//       document.body.insertBefore(root, document.body.firstChild);
//     }
//     root.innerHTML = `
//       <canvas id="ocean-bubbles-canvas"></canvas>
//       <div class="ocean-wave-layer wave-3"></div>
//       <div class="ocean-wave-layer wave-2"></div>
//       <div class="ocean-boat">⛵</div>
//       <div class="ocean-wave-layer wave-1"></div>
//     `;
//     return root;
//   }

//   function initBubbles() {
//     const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
//     const canvas = document.getElementById('ocean-bubbles-canvas');
//     if (!canvas || reducedMotion) return;

//     const ctx = canvas.getContext('2d');
//     let width, height, bubbles, dpr;
//     let running = true;

//     function resize() {
//       dpr = Math.min(window.devicePixelRatio || 1, 2);
//       width = window.innerWidth;
//       height = window.innerHeight;
//       canvas.width = width * dpr;
//       canvas.height = height * dpr;
//       canvas.style.width = width + 'px';
//       canvas.style.height = height + 'px';
//       ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
//     }

//     function makeBubble() {
//       const r = 2 + Math.random() * 6;
//       return {
//         x: Math.random() * width,
//         y: height + r + Math.random() * 100,
//         r,
//         speed: 0.25 + Math.random() * 0.6,
//         drift: (Math.random() - 0.5) * 0.4,
//         alpha: 0.08 + Math.random() * 0.18,
//         wobble: Math.random() * Math.PI * 2
//       };
//     }

//     function seed() {
//       const count = width < 640 ? 14 : width < 1200 ? 24 : 34;
//       bubbles = Array.from({ length: count }, () => {
//         const b = makeBubble();
//         b.y = Math.random() * height;
//         return b;
//       });
//     }

//     function draw() {
//       if (!running) return;
//       ctx.clearRect(0, 0, width, height);
//       for (const b of bubbles) {
//         b.y -= b.speed;
//         b.wobble += 0.02;
//         b.x += Math.sin(b.wobble) * b.drift;
//         if (b.y < -10) {
//           Object.assign(b, makeBubble());
//           b.y = height + 10;
//         }
//         ctx.beginPath();
//         ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
//         ctx.strokeStyle = `rgba(125, 232, 220, ${b.alpha})`;
//         ctx.lineWidth = 1;
//         ctx.stroke();
//         ctx.fillStyle = `rgba(125, 232, 220, ${b.alpha * 0.35})`;
//         ctx.fill();
//       }
//       requestAnimationFrame(draw);
//     }

//     document.addEventListener('visibilitychange', () => {
//       running = !document.hidden;
//       if (running) requestAnimationFrame(draw);
//     });

//     let resizeTimer;
//     window.addEventListener('resize', () => {
//       clearTimeout(resizeTimer);
//       resizeTimer = setTimeout(() => { resize(); seed(); }, 200);
//     });

//     resize();
//     seed();
//     requestAnimationFrame(draw);
//   }

//   if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', () => {
//       buildMarkup();
//       initBubbles();
//     });
//   } else {
//     buildMarkup();
//     initBubbles();
//   }
// })();
