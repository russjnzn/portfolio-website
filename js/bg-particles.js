/**
 * bg-particles.js — Interactive 3D perspective dot grid.
 *
 * Renders a tilted grid of dots (like a receding floor) that ripples
 * outward from the mouse position. Only runs on the landing page.
 *
 * Technique: simplified perspective projection using a vanishing point.
 * No external dependencies. Respects prefers-reduced-motion.
 */

(function () {
  'use strict';

  var canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  /* Respect reduced-motion preference */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var ctx = canvas.getContext('2d');

  /* ── Viewport dimensions ─────────────────────── */
  var W = 0, H = 0;

  /* ── Mouse in screen coords (off-screen by default) ── */
  var msx = -9999, msy = -9999;

  /* ── Projection layout (recalculated on resize) ─ */
  var VX;         // vanishing-point X (center)
  var VY;         // vanishing-point Y (horizon height)
  var S_BOT;      // Y of the near/bottom edge of the grid
  var SPREAD;     // half-width of the grid at the near edge

  /* ── Grid dimensions ─────────────────────────── */
  var COLS    = 32;   // dots across
  var ROWS    = 20;   // dots deep (near → far)
  var GZ_MAX  = 1.2;  // gz value for the farthest row
  var PERSP   = 4.2;  // perspective strength — higher = more dramatic

  /* ── Wave parameters ─────────────────────────── */
  var WAVE_AMP  = 52;  // max wave offset in near-plane pixels
  var IDLE_AMP  = 30;  // idle wave amplitude (px at near scale)

  /* ── Point array: { gx, gz } ─────────────────── */
  var pts = [];

  /* ────────────────────────────────────────────── */
  /*  Layout                                        */
  /* ────────────────────────────────────────────── */

  function computeLayout() {
    VX     = W * 0.5;
    VY     = H * 0.42;   /* horizon sits 42 % from the top */
    S_BOT  = H;
    SPREAD = W * 2.99;   /* half-width of grid at the viewer's feet */
  }

  /* ────────────────────────────────────────────── */
  /*  Grid construction                             */
  /* ────────────────────────────────────────────── */

  function buildGrid() {
    pts = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        pts.push({
          gx: c / (COLS - 1) - 0.5,          /* –0.5 … +0.5 */
          gz: (r / (ROWS - 1)) * GZ_MAX,     /* 0 = near, GZ_MAX = far */
        });
      }
    }
  }

  /* ────────────────────────────────────────────── */
  /*  Projection helpers                            */
  /* ────────────────────────────────────────────── */

  /** Perspective factor: 1 at near edge, → 0 at horizon */
  function pf(gz) {
    return 1 / (1 + gz * PERSP);
  }

  /**
   * Project a grid point to screen coordinates.
   * waveY > 0  ⟹  upward displacement on screen (negative screen-Y).
   */
  function toScreen(gx, gz, waveY) {
    var p  = pf(gz);
    return {
      sx: VX + gx * SPREAD * p,
      sy: VY + (S_BOT - VY) * p - waveY * p,
      p:  p,
    };
  }

  /**
   * Inverse-project a screen point to grid (gx, gz).
   * Returns null if above the horizon.
   */
  function toGrid(sx, sy) {
    if (sy <= VY) return null;
    var p = (sy - VY) / (S_BOT - VY);
    if (p <= 0) return null;
    return {
      gx: (sx - VX) / (SPREAD * p),
      gz: (1 / p - 1) / PERSP,
    };
  }

  /* ────────────────────────────────────────────── */
  /*  Render loop                                   */
  /* ────────────────────────────────────────────── */

  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    var sec = t * 0.001;

    /* Map mouse to approximate grid position */
    var mg  = toGrid(msx, msy);
    var mgx = mg ? mg.gx : -999;
    var mgz = mg ? mg.gz : -999;

    var items = [];

    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];

      /* Grid-space distance from the mouse */
      var dx = p.gx - mgx;
      var dz = (p.gz - mgz) * 0.55;   /* compress Z so ripple is rounder */
      var gd = Math.sqrt(dx * dx + dz * dz);

      /*
       * Mouse ripple: gaussian envelope × outward-traveling sine wave.
       * The phase (gd * k − sec * speed) makes the wave travel outward.
       */
      var ripple = Math.exp(-gd * 1.5) *
                   Math.sin(gd * 6.0 - sec * 4.0) *
                   WAVE_AMP;

      /* Idle undulation: slow, organic cross-wave */
      var idle = Math.sin(p.gx * 5.5 + sec * 0.75) *
                 Math.cos(p.gz * 4.0 + sec * 0.60) * IDLE_AMP;

      var waveY = ripple + idle;
      var proj  = toScreen(p.gx, p.gz, waveY);

      /* Appearance scales with perspective depth + wave amplitude */
      var pFac   = proj.p;
      var amp    = Math.abs(waveY) / WAVE_AMP;
      var radius = Math.max(0.8, pFac * 1.7 + amp * 1);
      var alpha  = Math.max(0.06, pFac * 0.8 + amp * 0.30);

      items.push({ sx: proj.sx, sy: proj.sy, r: radius, a: alpha, p: pFac });
    }

    /* Painter's algorithm — far (small p) first so near dots overlap them */
    items.sort(function (a, b) { return a.p - b.p; });

    /* Pick dot color based on current theme — checked each frame so
       toggling light/dark is reflected immediately without a restart. */
    var isLight = document.documentElement.classList.contains('light');
    ctx.fillStyle = isLight ? '#0a0a0a' : '#ffffff';

    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      ctx.globalAlpha = it.a;
      ctx.beginPath();
      ctx.arc(it.sx, it.sy, it.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(draw);
  }

  /* ────────────────────────────────────────────── */
  /*  Events                                        */
  /* ────────────────────────────────────────────── */

  window.addEventListener('mousemove', function (e) {
    msx = e.clientX;
    msy = e.clientY;
  });

  window.addEventListener('mouseleave', function () {
    msx = -9999;
    msy = -9999;
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      computeLayout();
      buildGrid();
    }, 100);
  });

  /* ────────────────────────────────────────────── */
  /*  Init                                          */
  /* ────────────────────────────────────────────── */

  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  computeLayout();
  buildGrid();
  requestAnimationFrame(draw);

})();
