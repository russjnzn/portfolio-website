/**
 * zenzo.js — Interactive pet companion. Loaded with defer on every page.
 * Follows the same IIFE + window.Manager pattern as js/main.js.
 */

/* --------------------------------------------------------------------------
   FOWT prevention — hide immediately if previously hidden by user
   -------------------------------------------------------------------------- */
(function () {
  if (localStorage.getItem('zenzo:hidden') === 'true') {
    document.documentElement.setAttribute('data-zenzo-hidden', '');
  }
})();

/* --------------------------------------------------------------------------
   ZenzoManager
   -------------------------------------------------------------------------- */
window.ZenzoManager = (function () {

  // ── Constants ─────────────────────────────────────────────────────────────
  var W = 80;            // character width  (px) — 2.5x the 32px sprite grid, matches CSS
  var H = 80;            // character height (px)
  var FOOT = H * 0.94;   // distance from top to feet (sprite feet end at row 30/32)
  var WALK_SPEED = 88;   // px / second
  var IDLE_MIN = 3500;   // ms before a new wander target is chosen
  var IDLE_MAX = 9000;

  // Selectors that Zenzo can perch on when dropped
  var PERCH_SELECTORS = [
    '.dock__item',
    '.navbar__logo',
    '.navbar__link',
    '.about-action',
    '.about-quick-link',
    '.testimonial-card',
    '.timeline-item',
    '.project-card',
    '.skill-item',
    '.modal-card',
    'h1', 'h2',
    'button:not(#zenzo-btn):not(#theme-btn):not(.zenzo-menu__btn):not(.chat-send-btn)',
  ].join(', ');

  // Left-to-right nav order — used to pick which edge Zenzo enters from
  var PAGE_ORDER = { 'index': 0, 'about': 1, 'timeline': 2, 'projects': 3, 'skills': 4 };

  function getCurrentPageKey() {
    var name = window.location.pathname.split('/').pop() || 'index.html';
    return name.replace('.html', '') || 'index';
  }

  // Chat bubble message pools (weighted by current stat thresholds in selectBubbleMessage)
  var MESSAGES = {
    idle: [
      "Hi! I'm Zenzo! 👋",
      "Double-click anywhere to call me!",
      "I wonder what's out there...",
      "*looks around curiously*",
      "Hey, you! Yes, you!",
      "Hover me to see what I can do!",
      "Bored... drag me somewhere fun!",
      "I like it here.",
    ],
    hungry: [
      "Feed me, I'm starving! 🍖",
      "My tummy is grumbling...",
      "Is that kibble I smell? 👀",
      "*stomach growls loudly*",
      "So... hungry...",
    ],
    sad: [
      "Pet me? 🥺",
      "I need some attention...",
      "Don't forget about me!",
      "*sighs quietly*",
      "I feel a bit lonely...",
    ],
    happy: [
      "This is the best day ever!",
      "I love it here! ✨",
      "Life is wonderful!",
      "You're the best!",
      "So happy right now! 🎉",
    ],
    tired: [
      "So... sleepy...",
      "*yaaawn*",
      "Need... nap...",
      "Eyes... so heavy...",
    ],
  };

  // ── State ─────────────────────────────────────────────────────────────────
  var st = {
    x: 0, y: 0,
    facing: 'right',
    mode: 'idle',        // idle | walking | sleeping | dragging | perched | eating
    speed: 0,            // current trot speed (px/s, eased)
    targetX: 0, targetY: 0,
    perchedEl: null,
    stats: { hunger: 25, happiness: 85, energy: 100 },
    reducedMotion: false,
    playThrowMode: false,
    idleTimerId: null,
  };

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var worldEl, charEl, menuEl, toysEl;
  var rig = null; // SVG bone group refs, filled by initRig()
  var rafId, lastTs;
  var perchedObserver = null, scrollCb = null;
  var entryTimerId = null, hasEntered = false;
  var activeBubble = null, bubbleTimerId = null;

  // ── DOM injection ─────────────────────────────────────────────────────────
  function inject() {
    // Toys layer (below Zenzo)
    toysEl = document.createElement('div');
    toysEl.id = 'zenzo-toys';
    document.body.appendChild(toysEl);

    // World container
    worldEl = document.createElement('div');
    worldEl.id = 'zenzo-world';
    worldEl.setAttribute('aria-hidden', 'true');

    // Character
    charEl = document.createElement('div');
    charEl.id = 'zenzo';
    charEl.setAttribute('tabindex', '0');
    charEl.setAttribute('role', 'button');
    charEl.setAttribute('aria-label', 'Zenzo, your portfolio companion. Press Space to pet, F to feed, P to play, S to sleep.');

    // Inline SVG — retro pixel-art sprite (Pokémon GBA style). Drawn on a
    // 32x32 logical pixel grid: every coordinate is an integer, fills are
    // flat palette colors with a dark outline, shape-rendering crispEdges
    // keeps edges hard when scaled up 3x. Every zr-* group is a rig bone
    // driven from JS (updateRig) at a stepped 12fps with quantized angles
    // so motion reads as hand-drawn animation frames; zsv-* elements keep
    // CSS-only opacity effects (glow pulses, blink, sparkles).
    // Render order (painter's model): tail → hind legs → body →
    // front legs → head group (ears behind head, antenna on top).
    //
    // Palette: outline #222034 · white #ffffff · light #dbe3ee ·
    //          mid #aebccd · visor #10141f (+hi #2c3a52) ·
    //          cyan #3ee6e6 (lt #b8fbfb, dk #1ba8b4) · blush #ff9aa8
    var svg = [
      '<svg class="zenzo__svg" viewBox="0 0 32 32" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',

      // zr-flip mirrors the whole sprite when facing left (instant, retro)
      '<g class="zr-flip">',
      // zr-rig carries whole-body hop + lean
      '<g class="zr-rig">',

      // ── TAIL — one connected stepped plume curving up-right ────────────
      '<g class="zr-tail">',
        '<path d="M24 22 L24 17 L25 17 L25 15 L26 15 L26 13 L27 13 L27 11 L31 11 L31 16 L30 16 L30 18 L29 18 L29 20 L28 20 L28 22 Z" fill="#222034"/>',
        '<path d="M25 21 L25 17 L26 17 L26 15 L27 15 L27 13 L28 13 L28 12 L30 12 L30 15 L29 15 L29 17 L28 17 L28 19 L27 19 L27 21 Z" fill="#dbe3ee"/>',
        '<rect x="28" y="12" width="1" height="2" fill="#ffffff"/>',
      '</g>',

      // ── HIND LEGS (behind body, shaded for depth) — thicker rect, curved foot end ──
      '<g class="zr-leg-bl">',
        '<path d="M3 23 L9 23 L9 29 L8 29 L8 30 L4 30 L4 29 L3 29 Z" fill="#222034"/>',
        '<rect x="4" y="24" width="4" height="4" fill="#aebccd"/>',
        '<rect x="5" y="29" width="2" height="1" fill="#8da2b5"/>',
      '</g>',
      '<g class="zr-leg-br">',
        '<path d="M29 23 L23 23 L23 29 L24 29 L24 30 L28 30 L28 29 L29 29 Z" fill="#222034"/>',
        '<rect x="24" y="24" width="4" height="4" fill="#aebccd"/>',
        '<rect x="25" y="29" width="2" height="1" fill="#8da2b5"/>',
      '</g>',

      // ── BODY — stepped rounded blob with glowing chest core ────────────
      '<g class="zr-body">',
        '<path d="M10 15 L22 15 L22 16 L24 16 L24 18 L25 18 L25 24 L24 24 L24 26 L22 26 L22 27 L10 27 L10 26 L8 26 L8 24 L7 24 L7 18 L8 18 L8 16 L10 16 Z" fill="#222034"/>',
        '<rect x="10" y="16" width="12" height="1" fill="#ffffff"/>',
        '<rect x="9"  y="17" width="14" height="1" fill="#ffffff"/>',
        '<rect x="8"  y="18" width="16" height="6" fill="#ffffff"/>',
        '<rect x="9"  y="24" width="14" height="1" fill="#dbe3ee"/>',
        '<rect x="10" y="25" width="12" height="1" fill="#dbe3ee"/>',
        // chest core — square halo + outlined pixel core
        '<rect class="zsv-core-halo" x="12" y="16" width="8" height="8" fill="#3ee6e6" opacity="0.15"/>',
        '<rect x="13" y="17" width="6" height="6" fill="#222034"/>',
        '<rect class="zsv-core" x="14" y="18" width="4" height="4" fill="#3ee6e6"/>',
        '<rect x="14" y="18" width="2" height="1" fill="#b8fbfb"/>',
        '<rect x="14" y="19" width="1" height="1" fill="#b8fbfb"/>',
        '<rect x="14" y="21" width="4" height="1" fill="#1ba8b4"/>',
      '</g>',

      // ── FRONT LEGS — thicker rect with curved foot end (mirrors hind leg shape) ─
      '<g class="zr-leg-fl">',
        '<path d="M9 23 L15 23 L15 29 L14 29 L14 30 L10 30 L10 29 L9 29 Z" fill="#222034"/>',
        '<rect x="10" y="24" width="4" height="4" fill="#ffffff"/>',
        '<rect x="11" y="29" width="2" height="1" fill="#dbe3ee"/>',
      '</g>',
      '<g class="zr-leg-fr">',
        '<path d="M23 23 L17 23 L17 29 L18 29 L18 30 L22 30 L22 29 L23 29 Z" fill="#222034"/>',
        '<rect x="18" y="24" width="4" height="4" fill="#ffffff"/>',
        '<rect x="19" y="29" width="2" height="1" fill="#dbe3ee"/>',
      '</g>',

      // ── HEAD GROUP ─────────────────────────────────────────────────────
      '<g class="zr-head">',

        // EARS — droopy stepped flaps tucked behind the head
        '<g class="zr-ear-l">',
          '<path d="M4 5 L7 5 L7 6 L8 6 L8 13 L7 13 L7 14 L4 14 L4 13 L2 13 L2 11 L1 11 L1 8 L2 8 L2 6 L4 6 Z" fill="#222034"/>',
          '<rect x="3" y="6" width="4" height="7" fill="#dbe3ee"/>',
          '<rect x="2" y="8" width="1" height="3" fill="#dbe3ee"/>',
          '<rect x="2" y="10" width="2" height="3" fill="#aebccd"/>',
        '</g>',
        '<g class="zr-ear-r">',
          '<path d="M28 5 L25 5 L25 6 L24 6 L24 13 L25 13 L25 14 L28 14 L28 13 L30 13 L30 11 L31 11 L31 8 L30 8 L30 6 L28 6 Z" fill="#222034"/>',
          '<rect x="25" y="6" width="4" height="7" fill="#dbe3ee"/>',
          '<rect x="29" y="8" width="1" height="3" fill="#dbe3ee"/>',
          '<rect x="28" y="10" width="2" height="3" fill="#aebccd"/>',
        '</g>',

        // HEAD — big stepped rounded square
        '<path d="M8 3 L24 3 L24 4 L26 4 L26 6 L27 6 L27 14 L26 14 L26 16 L24 16 L24 17 L8 17 L8 16 L6 16 L6 14 L5 14 L5 6 L6 6 L6 4 L8 4 Z" fill="#222034"/>',
        '<rect x="8" y="4"  width="16" height="1" fill="#ffffff"/>',
        '<rect x="7" y="5"  width="18" height="1" fill="#ffffff"/>',
        '<rect x="6" y="6"  width="20" height="8" fill="#ffffff"/>',
        '<rect x="7" y="14" width="18" height="1" fill="#ffffff"/>',
        '<rect x="8" y="15" width="16" height="1" fill="#dbe3ee"/>',

        // VISOR — dark stepped face screen with pixel gleam
        '<path d="M10 6 L22 6 L22 7 L23 7 L23 8 L24 8 L24 12 L23 12 L23 13 L22 13 L22 14 L10 14 L10 13 L9 13 L9 12 L8 12 L8 8 L9 8 L9 7 L10 7 Z" fill="#222034"/>',
        '<rect x="10" y="7" width="12" height="6" fill="#10141f"/>',
        '<rect x="9"  y="8" width="14" height="4" fill="#10141f"/>',
        '<rect x="10" y="7" width="3" height="1" fill="#2c3a52"/>',
        '<rect x="10" y="8" width="1" height="1" fill="#2c3a52"/>',

        // EYES — chunky happy pixel crescents
        '<g class="zsv-eyes">',
          '<rect x="11" y="9" width="1" height="2" fill="#3ee6e6"/>',
          '<rect x="12" y="8" width="1" height="2" fill="#3ee6e6"/>',
          '<rect x="13" y="8" width="1" height="2" fill="#3ee6e6"/>',
          '<rect x="14" y="9" width="1" height="2" fill="#3ee6e6"/>',
          '<rect x="12" y="8" width="2" height="1" fill="#b8fbfb"/>',
          '<rect x="18" y="9" width="1" height="2" fill="#3ee6e6"/>',
          '<rect x="19" y="8" width="1" height="2" fill="#3ee6e6"/>',
          '<rect x="20" y="8" width="1" height="2" fill="#3ee6e6"/>',
          '<rect x="21" y="9" width="1" height="2" fill="#3ee6e6"/>',
          '<rect x="19" y="8" width="2" height="1" fill="#b8fbfb"/>',
        '</g>',

        // SAD EYES — shown via .zenzo--sad (downturned, dimmer)
        '<g class="zsv-eyes-sad">',
          '<rect x="11" y="8" width="1" height="2" fill="#1ba8b4"/>',
          '<rect x="12" y="9" width="1" height="2" fill="#1ba8b4"/>',
          '<rect x="13" y="9" width="1" height="2" fill="#1ba8b4"/>',
          '<rect x="14" y="8" width="1" height="2" fill="#1ba8b4"/>',
          '<rect x="18" y="8" width="1" height="2" fill="#1ba8b4"/>',
          '<rect x="19" y="9" width="1" height="2" fill="#1ba8b4"/>',
          '<rect x="20" y="9" width="1" height="2" fill="#1ba8b4"/>',
          '<rect x="21" y="8" width="1" height="2" fill="#1ba8b4"/>',
        '</g>',

        // BLINK COVER — visor-colored lids + closed-eye lines
        '<g class="zsv-blink">',
          '<rect x="10" y="8" width="6" height="4" fill="#10141f"/>',
          '<rect x="17" y="8" width="6" height="4" fill="#10141f"/>',
          '<rect x="11" y="9" width="4" height="1" fill="#1ba8b4"/>',
          '<rect x="18" y="9" width="4" height="1" fill="#1ba8b4"/>',
        '</g>',

        // CHEEK BLUSH — single pixel pair per cheek
        '<rect x="7"  y="14" width="2" height="1" fill="#ff9aa8"/>',
        '<rect x="23" y="14" width="2" height="1" fill="#ff9aa8"/>',

        // ── ANTENNA — pixel stem with glowing orb ────────────────────────
        '<g class="zr-antenna">',
          '<rect x="16" y="0" width="1" height="4" fill="#222034"/>',
          '<rect class="zsv-antenna-glow-ring" x="13" y="-5" width="7" height="7" fill="#3ee6e6" opacity="0.18"/>',
          '<rect x="14" y="-4" width="5" height="5" fill="#222034"/>',
          '<rect class="zsv-antenna-ball" x="15" y="-3" width="3" height="3" fill="#3ee6e6"/>',
          '<rect x="15" y="-3" width="1" height="1" fill="#b8fbfb"/>',
          '<g class="zsv-sparkle-1" transform="translate(9,-1)">',
            '<rect x="-1" y="0" width="3" height="1" fill="#3ee6e6"/>',
            '<rect x="0" y="-1" width="1" height="3" fill="#3ee6e6"/>',
          '</g>',
          '<g class="zsv-sparkle-2" transform="translate(24,-3)">',
            '<rect x="-1" y="0" width="3" height="1" fill="#3ee6e6"/>',
            '<rect x="0" y="-1" width="1" height="3" fill="#3ee6e6"/>',
          '</g>',
        '</g>',

      '</g>',   // /zr-head
      '</g>',   // /zr-rig
      '</g>',   // /zr-flip

      '</svg>',
    ].join('');

    charEl.innerHTML = '<div class="zenzo__shadow"></div>' + svg + '<div class="zenzo__particles"></div>';

    // Quick-action menu
    menuEl = document.createElement('div');
    menuEl.id = 'zenzo-menu';
    menuEl.setAttribute('role', 'menu');
    menuEl.hidden = true;
    menuEl.innerHTML =
      '<button class="zenzo-menu__btn" data-action="pet"   role="menuitem" title="Pet" aria-label="Pet Zenzo">🤚</button>' +
      '<button class="zenzo-menu__btn" data-action="feed"  role="menuitem" title="Feed" aria-label="Feed Zenzo">🦴</button>' +
      '<button class="zenzo-menu__btn" data-action="play"  role="menuitem" title="Play" aria-label="Play with Zenzo">⚽</button>' +
      '<button class="zenzo-menu__btn" data-action="sleep" role="menuitem" title="Sleep" aria-label="Let Zenzo sleep">💤</button>';

    worldEl.appendChild(charEl);
    worldEl.appendChild(menuEl);
    document.body.appendChild(worldEl);
  }

  // ── Procedural animation rig ──────────────────────────────────────────────
  // Drives every body part from the RAF loop like a retro game sprite:
  // simulation is continuous (springs, stride synced to ground speed) but
  // everything is QUANTIZED on output — the rig steps at ~12fps, angles snap
  // to coarse increments and translations snap to whole sprite pixels, so
  // motion reads as hand-drawn animation frames (Pokémon overworld style).
  var FPS_STEP = 1 / 12;           // rig updates ~12 times per second
  var anim = {
    t: Math.random() * 10,         // local clock (randomized so two tabs desync)
    acc: 0,                        // frame-step accumulator
    phase: 0,                      // walk-cycle phase (radians)
    prevX: 0, prevY: 0, hasPrev: false,
    vx: 0, vy: 0,                  // smoothed real velocity (px/s)
    bob: 0, bobV: 0,               // vertical gait hop (sprite px)
    lean: 0,                       // whole-body tilt (deg, local space)
    sit: 1,                        // 0 = standing, 1 = sitting (snapped binary)
    headRot: 0,
    earL: { a: 0, v: 0 },
    earR: { a: 0, v: 0 },
    ant:  { a: 0, v: 0 },
    wagPh: 0, wagAmp: 6, wagFreq: 3.5,
    legA: 0, legB: 0,              // diagonal leg pair angles
  };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // Damped spring integrator: pulls s.a toward target, overshoots naturally
  function springStep(s, target, k, c, dt) {
    s.v += ((target - s.a) * k - s.v * c) * dt;
    s.a += s.v * dt;
  }

  function setT(el, t) { el.setAttribute('transform', t); }

  function initRig() {
    function q(sel) { return charEl.querySelector(sel); }
    rig = {
      flip:  q('.zr-flip'),  root:  q('.zr-rig'),
      body:  q('.zr-body'),  head:  q('.zr-head'),
      earL:  q('.zr-ear-l'), earR:  q('.zr-ear-r'),
      tail:  q('.zr-tail'),  ant:   q('.zr-antenna'),
      legFL: q('.zr-leg-fl'), legFR: q('.zr-leg-fr'),
      legBL: q('.zr-leg-bl'), legBR: q('.zr-leg-br'),
    };
  }

  // Impulses other systems can fire (pet, landing) so floppy parts react
  function kickRig(strength) {
    anim.earL.v += 220 * strength;
    anim.earR.v -= 200 * strength;
    anim.ant.v  += 260 * strength;
    anim.wagAmp  = Math.max(anim.wagAmp, 24 * strength);
    anim.wagFreq = Math.max(anim.wagFreq, 12 * strength);
  }

  // Quantizers — the secret to the retro feel: coarse angle steps and whole
  // sprite pixels make continuous simulation read as discrete frames
  function qa(deg, step) { return Math.round(deg / step) * step; }
  function qp(px)        { return Math.round(px); }

  function updateRig(dtIn) {
    if (!rig) return;
    var a = anim;

    if (st.reducedMotion) {
      // Static sitting pose, facing flip only — no motion
      setT(rig.flip, 'translate(16 0) scale(' + (st.facing === 'left' ? -1 : 1) + ' 1) translate(-16 0)');
      return;
    }

    // Step the rig at ~12fps — like flipping sprite frames
    a.acc += dtIn;
    if (a.acc < FPS_STEP) return;
    var dt = clamp(a.acc, 0.02, 0.15);
    a.acc = 0;
    a.t += dt;

    // --- real velocity from position delta (covers walking AND dragging) ---
    if (!a.hasPrev) { a.prevX = st.x; a.prevY = st.y; a.hasPrev = true; }
    var sm = Math.min(1, dt * 14);
    a.vx += ((st.x - a.prevX) / dt - a.vx) * sm;
    a.vy += ((st.y - a.prevY) / dt - a.vy) * sm;
    a.prevX = st.x; a.prevY = st.y;
    var spd = Math.min(Math.hypot(a.vx, a.vy), 600);

    var dragging = st.mode === 'dragging';
    var sleeping = st.mode === 'sleeping';
    var moving   = spd > 6 && !dragging;
    var eating   = charEl.classList.contains('zenzo--eating');

    // --- facing: instant sprite mirror, no tween (retro sprites just flip) ---
    var flip = st.facing === 'left' ? -1 : 1;

    // --- gait: stride phase advances with distance traveled ---
    if (moving) a.phase += spd * dt / 11;
    var stride = Math.sin(a.phase);

    // body hop: two footfalls per stride cycle (in sprite pixels)
    var prevBob = a.bob;
    var bobTarget = moving ? -Math.abs(stride) * 1.4 : 0;
    a.bob += (bobTarget - a.bob) * Math.min(1, dt * 18);
    var bobV = (a.bob - prevBob) / dt;
    var bobKick = clamp((bobV - a.bobV) * 0.14, -40, 40);
    a.bobV = bobV;

    // --- pose: snap between standing and sitting frames (binary, retro) ---
    var sitT = (!moving && !dragging &&
                (st.mode === 'idle' || sleeping || st.mode === 'perched')) ? 1 : 0;
    a.sit += (sitT - a.sit) * Math.min(1, dt * (sitT ? 3.5 : 9));
    var sit = a.sit > 0.5 ? 1 : 0;

    // --- lean: tip forward while trotting, sway from inertia while carried ---
    var leanT = 0;
    if (dragging)    leanT = flip * clamp(-a.vx * 0.045, -14, 14);
    else if (moving) leanT = clamp(spd * 0.05, 0, 6);
    a.lean += (leanT - a.lean) * Math.min(1, dt * 7);

    // --- idle breathing: classic 1px sprite bounce, half the cycle down ---
    var breathe = Math.sin(a.t * (sleeping ? 1.4 : 2.0)) > 0 ? 0 : 1;

    // --- floppy ears + antenna: springs kicked by every gait hop ---
    a.earL.v += bobKick * 1.15;
    a.earR.v += bobKick;
    a.ant.v  -= bobKick * 0.8;
    springStep(a.earL, a.lean * -0.7, 80, 7.5, dt);
    springStep(a.earR, a.lean * -0.7, 95, 8.5, dt);
    springStep(a.ant,  a.lean * -1.1, 60, 6.5, dt);

    // --- tail wag: amplitude/frequency follow mood and motion ---
    var happy    = st.stats.happiness > 70;
    var wagAmpT  = sleeping ? 1.5 : dragging ? 4 : moving ? 16 : (happy ? 11 : 6);
    var wagFreqT = moving ? 10 : (happy ? 6 : 3.2);
    a.wagAmp  += (wagAmpT  - a.wagAmp)  * Math.min(1, dt * 3);
    a.wagFreq += (wagFreqT - a.wagFreq) * Math.min(1, dt * 3);
    a.wagPh   += a.wagFreq * dt;
    var tailRot = Math.sin(a.wagPh) * a.wagAmp - sit * 6;

    // --- legs: diagonal pairs while trotting, loose dangle while carried ---
    var legTargetA, legTargetB;
    if (dragging) {
      var dangle = Math.sin(a.t * 3.2) * 6 - a.lean * 0.5;
      legTargetA = 9 + dangle;
      legTargetB = 3 - dangle;
    } else {
      var legAmp = 24 * clamp(spd / 75, 0, 1);
      legTargetA = stride * legAmp;
      legTargetB = -stride * legAmp;
    }
    a.legA += (legTargetA - a.legA) * Math.min(1, dt * 16);
    a.legB += (legTargetB - a.legB) * Math.min(1, dt * 16);

    // --- head: counter-tilts the lean, nods with stride, droops asleep ---
    var headRotT = -a.lean * 0.5 +
                   (moving ? Math.sin(a.phase) * 1.6 : Math.sin(a.t * 0.9) * 1.2);
    if (sleeping) headRotT = 11;
    if (eating)   headRotT = 9 + Math.sin(a.t * 9) * 5;
    a.headRot += (headRotT - a.headRot) * Math.min(1, dt * 7);
    var headY = sit * 1 + breathe + (eating ? 1 : 0);

    // --- apply bone transforms (all pivots in 32-grid sprite space,
    //     angles snapped to coarse steps, translations to whole pixels) ---
    setT(rig.flip, 'translate(16 0) scale(' + flip + ' 1) translate(-16 0)');
    setT(rig.root, 'translate(0 ' + qp(a.bob + sit * 0.5) + ')' +
                   ' rotate(' + qa(a.lean, 3) + ' 16 29)');

    setT(rig.body, 'translate(0 ' + qp(sit * 1 + breathe) + ')');

    setT(rig.head, 'translate(0 ' + qp(headY) + ')' +
                   ' rotate(' + qa(a.headRot, 3) + ' 16 18)');
    setT(rig.earL, 'rotate(' + qa(a.earL.a - sit * 2, 5) + ' 6 6)');
    setT(rig.earR, 'rotate(' + qa(a.earR.a + sit * 2, 5) + ' 26 6)');
    setT(rig.ant,  'rotate(' + qa(a.ant.a, 5) + ' 16 3)');
    setT(rig.tail, 'rotate(' + qa(tailRot, 6) + ' 26 20)');

    // sitting: body settles down a pixel and the haunches splay outward
    setT(rig.legFL, 'rotate(' + qa(a.legA, 8) + ' 12 23)');
    setT(rig.legFR, 'rotate(' + qa(a.legB, 8) + ' 20 23)');
    setT(rig.legBL, 'rotate(' + qa(a.legB * 0.85 - 12 * sit, 8) + ' 7 23)');
    setT(rig.legBR, 'rotate(' + qa(a.legA * 0.85 + 12 * sit, 8) + ' 25 23)');
  }

  // ── Position helpers ──────────────────────────────────────────────────────
  function clampX(x) { return Math.max(0, Math.min(x, window.innerWidth  - W)); }
  function clampY(y) { return Math.max(0, Math.min(y, window.innerHeight - H)); }

  function moveTo(x, y) {
    st.x = clampX(x);
    st.y = clampY(y);
    // Internal position is continuous; rendering snaps to a 2px grid for
    // chunky retro movement (like tile-stepped overworld sprites)
    charEl.style.left = (Math.round(st.x / 2) * 2) + 'px';
    charEl.style.top  = (Math.round(st.y / 2) * 2) + 'px';
    if (!menuEl.hidden) repositionMenu();
  }

  function repositionMenu() {
    var mw = menuEl.offsetWidth || 180;
    var mx = st.x + W / 2 - mw / 2;
    // Keep menu inside viewport
    mx = Math.max(8, Math.min(mx, window.innerWidth - mw - 8));
    menuEl.style.left = mx + 'px';
    var mh = menuEl.offsetHeight || 46;
    var my = st.y - mh - 8;
    if (my < 8) my = st.y + FOOT + 10; // no room above → show below
    menuEl.style.top  = my + 'px';
  }

  // ── Facing ────────────────────────────────────────────────────────────────
  function setFacing(dir) {
    st.facing = dir;
    if (dir === 'left') charEl.classList.add('facing-left');
    else                charEl.classList.remove('facing-left');
  }

  // ── Mode / state machine ──────────────────────────────────────────────────
  function setMode(mode) {
    charEl.classList.remove(
      'zenzo--walking', 'zenzo--sleeping', 'zenzo--dragging',
      'zenzo--happy', 'zenzo--landing'
    );
    st.mode = mode;
    if (mode !== 'walking')  st.speed = 0;
    if (mode === 'walking')  charEl.classList.add('zenzo--walking');
    if (mode === 'sleeping') charEl.classList.add('zenzo--sleeping');
    if (mode === 'dragging') charEl.classList.add('zenzo--dragging');
  }

  // ── RAF loop ──────────────────────────────────────────────────────────────
  var lastWalkSparkleTs = 0;

  function tick(ts) {
    var dt = Math.min((ts - lastTs) / 1000, 0.1);
    lastTs = ts;

    if (!document.hidden) {
      decayStats(dt);

      if (st.mode === 'walking') {
        var dx = st.targetX - st.x;
        var dy = st.targetY - st.y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 2.5) {
          st.speed = 0;
          setMode('idle');
          scheduleWander();
        } else {
          // Ease in/out of the trot: accelerate from rest, brake on approach
          var desired = Math.min(WALK_SPEED, 26 + dist * 2.2);
          st.speed += clamp(desired - st.speed, -520 * dt, 300 * dt);
          var step = Math.min(st.speed * dt, dist);
          var ratio = step / dist;
          setFacing(dx < 0 ? 'left' : 'right');
          moveTo(st.x + dx * ratio, st.y + dy * ratio);
          st.stats.energy = Math.max(0, st.stats.energy - 0.8 * dt);

          // Spawn a walking sparkle dust every ~280ms (skip if reduced motion)
          if (!st.reducedMotion && ts - lastWalkSparkleTs > 280) {
            spawnWalkSparkle();
            lastWalkSparkleTs = ts;
          }
        }
      }

      if (st.mode === 'perched') pinToPerch();

      updateRig(dt);

      // Keep active chat bubble glued above Zenzo as he moves
      if (activeBubble) {
        activeBubble.style.left = (st.x + W / 2) + 'px';
        activeBubble.style.top  = (st.y - 10) + 'px';
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    lastTs = performance.now();
    rafId  = requestAnimationFrame(tick);
  }

  // ── Stats decay ───────────────────────────────────────────────────────────
  function decayStats(dt) {
    st.stats.hunger    = Math.min(100, st.stats.hunger    + 0.18 * dt); // ~10/min
    st.stats.happiness = Math.max(0,   st.stats.happiness - 0.05 * dt); // ~3/min
    updateMoodClasses();
  }

  function updateMoodClasses() {
    charEl.classList.toggle('zenzo--hungry', st.stats.hunger    > 70);
    charEl.classList.toggle('zenzo--sad',    st.stats.happiness < 30);
    charEl.classList.toggle('zenzo--tired',  st.stats.energy    < 20);
  }

  // ── Wander AI ─────────────────────────────────────────────────────────────
  function scheduleWander() {
    if (st.reducedMotion) return;
    clearTimeout(st.idleTimerId);
    var delay = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
    st.idleTimerId = setTimeout(function () {
      if (st.mode !== 'idle') return;
      if (st.stats.energy < 20) { doSleep(); return; }
      pickWanderTarget();
    }, delay);
  }

  function pickWanderTarget() {
    var margin = 60;
    var floorBias = window.innerHeight * 0.55; // prefer lower half
    st.targetX = margin + Math.random() * (window.innerWidth  - W - margin * 2);
    st.targetY = floorBias + Math.random() * (window.innerHeight - H - floorBias - margin);
    setFacing(st.targetX > st.x ? 'right' : 'left');
    setMode('walking');
  }

  // ── Edge entry ────────────────────────────────────────────────────────────
  function enterFromEdge() {
    if (hasEntered) return;
    hasEntered = true;
    clearTimeout(entryTimerId);

    // Read exit info from the previous page for directional + Y continuity
    var exitPage = null, exitY = -1;
    try {
      exitPage = sessionStorage.getItem('zenzo:exitPage');
      exitY    = parseInt(sessionStorage.getItem('zenzo:exitY') || '-1', 10);
      sessionStorage.removeItem('zenzo:exitPage');
      sessionStorage.removeItem('zenzo:exitY');
    } catch (e) {}

    var currentPage = getCurrentPageKey();
    var currentIdx  = PAGE_ORDER[currentPage] !== undefined ? PAGE_ORDER[currentPage] : -1;
    var exitIdx     = (exitPage && PAGE_ORDER[exitPage] !== undefined) ? PAGE_ORDER[exitPage] : -1;

    // Determine entry edge: enter from the side where the previous page sat
    // e.g. came from About (idx 1) → Projects (idx 3): About is LEFT → enter from LEFT
    var fromRight;
    if (exitIdx < 0 || currentIdx < 0 || exitIdx === currentIdx) {
      fromRight = Math.random() < 0.5;
    } else {
      fromRight = exitIdx > currentIdx; // previous page was right of current → enter from right
    }

    // Land destination — prefer saved Y for horizontal continuity
    var margin = 80;
    var destX  = clampX(window.innerWidth * 0.25 + Math.random() * window.innerWidth * 0.5 - W / 2);
    var destY  = (exitY >= 0 && exitY < window.innerHeight - H)
      ? clampY(exitY)
      : clampY(window.innerHeight * 0.55 + Math.random() * (window.innerHeight * 0.3 - H));

    if (st.reducedMotion) {
      st.x = destX;
      st.y = destY;
      anim.hasPrev = false; // don't register the teleport as velocity
      charEl.style.left       = st.x + 'px';
      charEl.style.top        = st.y + 'px';
      charEl.style.transition = 'opacity 0.4s ease';
      charEl.style.opacity    = '1';
      setTimeout(function () { charEl.style.transition = ''; }, 500);
      setMode('idle');
    } else {
      // Walk in horizontally at the saved Y so it looks continuous across pages
      st.x = fromRight ? window.innerWidth + 20 : -(W + 20);
      st.y = destY;
      anim.hasPrev = false; // don't register the teleport as velocity
      charEl.style.left    = st.x + 'px';
      charEl.style.top     = st.y + 'px';
      charEl.style.opacity = '1';
      setFacing(fromRight ? 'left' : 'right');
      st.targetX = destX;
      st.targetY = destY;
      setMode('walking');
    }

    setTimeout(showHint, 3000);
    scheduleBubble(); // start chat bubbles once Zenzo is active
  }

  // Public: trigger entry on the current page immediately (and flag next page too)
  function callZenzo() {
    if (!hasEntered) {
      clearTimeout(entryTimerId);
      enterFromEdge();
    }
    try { sessionStorage.setItem('zenzo:called', '1'); } catch (e) {}
  }

  // ── Summon: double-click (desktop) + double-tap (touch) ───────────────────
  var lastSummonTs = 0;

  function summonTo(clientX, clientY, target) {
    if (target && (charEl.contains(target) || menuEl.contains(target))) return;
    // Don't hijack taps meant for interactive elements
    if (target && target.closest &&
        target.closest('a, button, input, textarea, select, [role="button"]')) return;

    // Dedupe: native dblclick and the touch double-tap detector can both
    // fire for the same gesture on some browsers
    var now = Date.now();
    if (now - lastSummonTs < 500) return;
    lastSummonTs = now;

    var tx = clampX(clientX - W / 2);
    var ty = clampY(clientY - FOOT);

    spawnCallRipple(clientX, clientY);

    if (!hasEntered) {
      // Trigger immediate entry aimed at the call point
      hasEntered = true;
      clearTimeout(entryTimerId);
      var fromRight = clientX > window.innerWidth / 2;
      st.x = fromRight ? window.innerWidth + 20 : -(W + 20);
      st.y = clampY(clientY - H * 0.5);
      anim.hasPrev = false; // don't register the teleport as velocity
      charEl.style.left    = st.x + 'px';
      charEl.style.top     = st.y + 'px';
      charEl.style.opacity = '1';
      setFacing(fromRight ? 'left' : 'right');
      setTimeout(showHint, 3000);
      scheduleBubble();
    } else {
      detachPerch();
      clearTimeout(st.idleTimerId);
      hideMenu();
    }

    st.targetX = tx;
    st.targetY = ty;
    setFacing(tx > st.x ? 'right' : 'left');
    setMode('walking');
  }

  function initDoubleClick() {
    document.addEventListener('dblclick', function (e) {
      summonTo(e.clientX, e.clientY, e.target);
    });

    // Touch screens: dblclick is unreliable (double-tap may zoom instead),
    // so detect two quick taps near the same spot ourselves
    var lastTapTs = 0, lastTapX = 0, lastTapY = 0;
    document.addEventListener('touchend', function (e) {
      if (e.touches.length > 0) return; // multi-touch gesture in progress
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      var now = Date.now();
      var isDouble = (now - lastTapTs) < 400 &&
                     Math.abs(t.clientX - lastTapX) < 48 &&
                     Math.abs(t.clientY - lastTapY) < 48;
      lastTapTs = now; lastTapX = t.clientX; lastTapY = t.clientY;
      if (isDouble) {
        lastTapTs = 0; // a triple tap shouldn't summon twice
        summonTo(t.clientX, t.clientY, e.target);
      }
    }, { passive: true });
  }

  function spawnCallRipple(x, y) {
    var el = document.createElement('div');
    el.className = 'zenzo-call-ripple';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    document.body.appendChild(el);
    setTimeout(function () { if (document.body.contains(el)) document.body.removeChild(el); }, 700);
  }

  // ── Chat bubbles ───────────────────────────────────────────────────────────
  function selectBubbleMessage() {
    var pool = [].concat(MESSAGES.idle);
    if (st.stats.hunger    > 65) pool = pool.concat(MESSAGES.hungry);
    if (st.stats.happiness < 35) pool = pool.concat(MESSAGES.sad);
    if (st.stats.energy    < 25) pool = pool.concat(MESSAGES.tired);
    if (st.stats.happiness > 70 && st.stats.hunger < 50) pool = pool.concat(MESSAGES.happy);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function showBubble() {
    if (isHidden() || !hasEntered) { scheduleBubble(); return; }
    if (st.mode === 'eating' || st.mode === 'dragging' || st.mode === 'sleeping') { scheduleBubble(); return; }

    // Dismiss any existing bubble
    if (activeBubble && worldEl.contains(activeBubble)) worldEl.removeChild(activeBubble);

    var text = selectBubbleMessage();
    var bubble = document.createElement('div');
    bubble.className = 'zenzo-bubble';
    bubble.textContent = text;
    bubble.style.left = (st.x + W / 2) + 'px';
    bubble.style.top  = (st.y - 10) + 'px';
    worldEl.appendChild(bubble);
    activeBubble = bubble;

    var duration = Math.max(2200, 1800 + text.length * 55);
    setTimeout(function () {
      bubble.classList.add('zenzo-bubble--hide');
      setTimeout(function () {
        if (worldEl.contains(bubble)) worldEl.removeChild(bubble);
        if (activeBubble === bubble) activeBubble = null;
      }, 380);
    }, duration);

    scheduleBubble();
  }

  function scheduleBubble() {
    clearTimeout(bubbleTimerId);
    bubbleTimerId = setTimeout(showBubble, 15000 + Math.random() * 20000);
  }

  // ── Drag ──────────────────────────────────────────────────────────────────
  function initDrag() {
    var startClientX, startClientY, offsetX, offsetY, dragging = false, didMove = false;

    charEl.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      didMove  = false;
      startClientX = e.clientX;
      startClientY = e.clientY;
      offsetX = e.clientX - st.x;
      offsetY = e.clientY - st.y;

      clearTimeout(st.idleTimerId);
      detachPerch();
      setMode('dragging');
      charEl.setPointerCapture(e.pointerId);
    });

    charEl.addEventListener('pointermove', function (e) {
      if (!dragging) return;

      if (Math.abs(e.clientX - startClientX) > 5 || Math.abs(e.clientY - startClientY) > 5) {
        didMove = true;
      }

      moveTo(e.clientX - offsetX, e.clientY - offsetY);
      highlightDropTarget();
    });

    charEl.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      clearDropHighlight();

      if (!didMove) {
        // Long-press already opened the action menu — don't also pet
        if (longPressFired) {
          longPressFired = false;
          setMode('idle');
          scheduleWander();
          return;
        }
        // Treat as click/tap → pet
        doPet();
        setMode('idle');
        scheduleWander();
        return;
      }

      var candidate = getDropCandidate();
      if (candidate) {
        attachPerch(candidate);
      } else {
        // Gravity: snap to visible floor
        var floorY = Math.min(st.y, window.innerHeight - H - 16);
        moveTo(st.x, floorY);
        setMode('idle');  // clear dragging class BEFORE playLand so land anim isn't cancelled
        playLand();
        scheduleWander();
      }
    });

    // Cancel drag on pointer cancel
    charEl.addEventListener('pointercancel', function () {
      if (!dragging) return;
      dragging = false;
      clearDropHighlight();
      setMode('idle');
      scheduleWander();
    });
  }

  function getDropCandidate() {
    var footX = st.x + W / 2;
    var footY = st.y + FOOT;
    charEl.style.display = 'none';
    var hit = document.elementFromPoint(footX, footY);
    charEl.style.display = '';
    if (!hit || hit === charEl || hit === worldEl) return null;
    // Walk up a few levels to find a perchable ancestor
    var el = hit;
    for (var i = 0; i < 5 && el; i++) {
      try { if (el.matches && el.matches(PERCH_SELECTORS)) return el; } catch (e) {}
      el = el.parentElement;
    }
    return null;
  }

  function highlightDropTarget() {
    clearDropHighlight();
    var candidate = getDropCandidate();
    if (candidate) candidate.classList.add('zenzo-drop-target');
  }

  function clearDropHighlight() {
    document.querySelectorAll('.zenzo-drop-target').forEach(function (el) {
      el.classList.remove('zenzo-drop-target');
    });
  }

  // ── Perching ──────────────────────────────────────────────────────────────
  function attachPerch(el) {
    st.perchedEl = el;
    charEl.classList.remove('zenzo--walking', 'zenzo--dragging', 'zenzo--happy');
    st.mode = 'perched';
    pinToPerch();
    playLand();

    scrollCb = function () { pinToPerch(); };
    window.addEventListener('scroll', scrollCb, { passive: true });
    window.addEventListener('resize', scrollCb, { passive: true });

    perchedObserver = new ResizeObserver(function () { pinToPerch(); });
    perchedObserver.observe(el);
  }

  function pinToPerch() {
    if (!st.perchedEl) return;
    var rect = st.perchedEl.getBoundingClientRect();
    // Detach if element left viewport
    if (rect.bottom < -20 || rect.top > window.innerHeight + 20) {
      detachPerch();
      setMode('idle');
      scheduleWander();
      return;
    }
    var px = rect.left + rect.width / 2 - W / 2;
    var py = rect.top  - FOOT + 4; // slight overlap so feet look planted
    moveTo(px, py);
  }

  function detachPerch() {
    if (!st.perchedEl) return;
    st.perchedEl = null;
    if (scrollCb) {
      window.removeEventListener('scroll', scrollCb);
      window.removeEventListener('resize', scrollCb);
      scrollCb = null;
    }
    if (perchedObserver) { perchedObserver.disconnect(); perchedObserver = null; }
  }

  function playLand() {
    kickRig(0.8);                   // impact ripples through ears / antenna / tail
    charEl.classList.remove('zenzo--landing');
    void charEl.offsetWidth; // reflow to restart animation
    charEl.classList.add('zenzo--landing');
    setTimeout(function () { charEl.classList.remove('zenzo--landing'); }, 380);
  }

  // ── SVG assets for actions (pixel-art, same palette as the sprite) ──────
  // Food bowl with chunky kibble pixels
  var BOWL_SVG =
    '<svg viewBox="0 0 16 12" width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true">' +
      // kibble pieces (warm browns)
      '<rect x="4" y="2" width="2" height="2" fill="#c47734"/>' +
      '<rect x="7" y="1" width="2" height="2" fill="#a55d24"/>' +
      '<rect x="10" y="2" width="2" height="2" fill="#c47734"/>' +
      '<rect x="4" y="2" width="1" height="1" fill="#e8a55e"/>' +
      // bowl outline + body
      '<path d="M1 4 L15 4 L15 8 L14 8 L14 10 L12 10 L12 11 L4 11 L4 10 L2 10 L2 8 L1 8 Z" fill="#222034"/>' +
      '<path d="M2 5 L14 5 L14 8 L13 8 L13 9 L12 9 L12 10 L4 10 L4 9 L3 9 L3 8 L2 8 Z" fill="#aebccd"/>' +
      '<rect x="2" y="5" width="12" height="1" fill="#dbe3ee"/>' +
      // teal accent stripe
      '<rect x="3" y="7" width="10" height="1" fill="#2bb3b3"/>' +
    '</svg>';

  // Pixel pokeball-style play ball
  var BALL_SVG =
    '<svg viewBox="0 0 12 12" width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true">' +
      // stepped circle outline
      '<path d="M4 0 L8 0 L8 1 L10 1 L10 2 L11 2 L11 4 L12 4 L12 8 L11 8 L11 10 L10 10 L10 11 L8 11 L8 12 L4 12 L4 11 L2 11 L2 10 L1 10 L1 8 L0 8 L0 4 L1 4 L1 2 L2 2 L2 1 L4 1 Z" fill="#222034"/>' +
      // red top hemisphere
      '<rect x="4" y="1" width="4" height="1" fill="#e84a4a"/>' +
      '<rect x="2" y="2" width="8" height="2" fill="#e84a4a"/>' +
      '<rect x="1" y="4" width="10" height="1" fill="#e84a4a"/>' +
      '<rect x="3" y="2" width="2" height="1" fill="#ff8e8e"/>' +
      // center band
      '<rect x="1" y="5" width="10" height="2" fill="#222034"/>' +
      // white bottom hemisphere
      '<rect x="1" y="7" width="10" height="1" fill="#ffffff"/>' +
      '<rect x="2" y="8" width="8" height="2" fill="#ffffff"/>' +
      '<rect x="4" y="10" width="4" height="1" fill="#dbe3ee"/>' +
      // center button
      '<rect x="4" y="4" width="4" height="4" fill="#222034"/>' +
      '<rect x="5" y="5" width="2" height="2" fill="#ffffff"/>' +
    '</svg>';

  // ── Actions ───────────────────────────────────────────────────────────────
  function doPet() {
    st.stats.happiness = Math.min(100, st.stats.happiness + 6);
    kickRig(1);                     // ears flap + tail wags hard via spring impulse
    spawnHearts(3);                 // 3 cyan hearts staggered above head
    charEl.classList.remove('zenzo--happy');
    void charEl.offsetWidth;
    charEl.classList.add('zenzo--happy');
    setTimeout(function () { charEl.classList.remove('zenzo--happy'); }, 550);
    updateMoodClasses();
  }

  function doFeed() {
    if (st.mode === 'sleeping') return;
    hideMenu();

    var BOWL_W = 56, BOWL_H = 46;
    var bowlOffsetX = st.facing === 'right' ? W + 14 : -(BOWL_W + 14);
    var bx = clampX(st.x + bowlOffsetX);
    var by = Math.min(st.y + H * 0.55, window.innerHeight - BOWL_H - 4);

    var bowl = document.createElement('div');
    bowl.className = 'zenzo-food-bowl';
    bowl.innerHTML = BOWL_SVG;
    bowl.style.cssText =
      'left:' + bx + 'px;top:' + by + 'px;' +
      'width:' + BOWL_W + 'px;height:' + BOWL_H + 'px;';
    toysEl.appendChild(bowl);

    // Walk toward bowl
    st.targetX = bx - (st.facing === 'right' ? -10 : -(W - BOWL_W - 10));
    if (st.facing === 'right') st.targetX = bx - W * 0.6;
    else                       st.targetX = bx + BOWL_W - W * 0.4;
    st.targetY = by - H * 0.45;
    setFacing(bx > st.x ? 'right' : 'left');
    setMode('walking');

    // After a moment, show eating animation (head bob)
    setTimeout(function () {
      charEl.classList.add('zenzo--eating');
    }, 700);

    setTimeout(function () {
      // Bowl fades out
      bowl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      bowl.style.opacity = '0';
      bowl.style.transform = 'scale(0.6)';
      setTimeout(function () {
        if (toysEl.contains(bowl)) toysEl.removeChild(bowl);
      }, 350);

      charEl.classList.remove('zenzo--eating');
      st.stats.hunger    = Math.max(0,   st.stats.hunger    - 35);
      st.stats.happiness = Math.min(100, st.stats.happiness + 5);
      spawnHearts(1);
      spawnParticle('sparkle');
      setMode('idle');
      scheduleWander();
      updateMoodClasses();
    }, 2400);
  }

  function doPlay() {
    if (st.mode === 'sleeping') return;
    hideMenu();

    var BALL_SIZE = 26;
    var ball = document.createElement('div');
    ball.className = 'zenzo-ball';
    ball.innerHTML = BALL_SVG;
    ball.style.cssText =
      'left:' + (st.x + W / 2 - BALL_SIZE / 2) + 'px;' +
      'top:'  + (st.y + H * 0.25) + 'px;' +
      'width:' + BALL_SIZE + 'px;height:' + BALL_SIZE + 'px;';
    toysEl.appendChild(ball);

    st.playThrowMode = true;

    var onThrow = function (e) {
      if (!st.playThrowMode) return;
      st.playThrowMode = false;
      document.removeEventListener('click', onThrow, true);

      var tx = e.clientX;
      var ty = e.clientY;

      // Ball spins and bounces toward target
      ball.style.transition =
        'left 0.55s cubic-bezier(0.16,1,0.3,1), ' +
        'top 0.55s cubic-bezier(0.34,1.56,0.64,1), ' +
        'transform 0.55s linear';
      ball.style.left = (tx - BALL_SIZE / 2) + 'px';
      ball.style.top  = (ty - BALL_SIZE / 2) + 'px';
      ball.style.transform = 'rotate(540deg)';

      st.targetX = clampX(tx - W / 2);
      st.targetY = clampY(ty - FOOT);
      setFacing(tx > st.x ? 'right' : 'left');
      setMode('walking');

      setTimeout(function () {
        // Ball fades on pickup
        ball.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        ball.style.opacity = '0';
        ball.style.transform = 'scale(0.5) rotate(720deg)';
        setTimeout(function () {
          if (toysEl.contains(ball)) toysEl.removeChild(ball);
        }, 350);

        st.stats.happiness = Math.min(100, st.stats.happiness + 12);
        st.stats.energy    = Math.max(0,   st.stats.energy    - 12);
        spawnHearts(2);
        spawnParticle('sparkle');
        setMode('idle');
        scheduleWander();
        updateMoodClasses();
      }, 1800);
    };

    // Give 100ms buffer so the click that triggered play doesn't count
    setTimeout(function () {
      document.addEventListener('click', onThrow, true);
    }, 120);
  }

  function doSleep() {
    if (st.mode === 'sleeping') return;
    hideMenu();
    clearTimeout(st.idleTimerId);

    // Walk to nearest bottom corner
    var corners = [
      { x: 20,                            y: window.innerHeight - H - 20 },
      { x: window.innerWidth - W - 20,    y: window.innerHeight - H - 20 },
    ];
    var nearest = corners.reduce(function (a, b) {
      return Math.hypot(a.x - st.x, a.y - st.y) < Math.hypot(b.x - st.x, b.y - st.y) ? a : b;
    });

    st.targetX = nearest.x;
    st.targetY = nearest.y;
    setFacing(nearest.x < st.x ? 'left' : 'right');
    setMode('walking');

    var walked = false;
    var checkArrival = setInterval(function () {
      if (st.mode !== 'walking') { clearInterval(checkArrival); return; }
      var dist = Math.hypot(nearest.x - st.x, nearest.y - st.y);
      if (dist < 8 && !walked) {
        walked = true;
        clearInterval(checkArrival);
        startSleeping();
      }
    }, 100);

    // Fallback: force sleep after 3s regardless
    setTimeout(function () {
      clearInterval(checkArrival);
      if (!walked) startSleeping();
    }, 3000);
  }

  function startSleeping() {
    setMode('sleeping');
    spawnSleepZ();

    var energyTick = setInterval(function () {
      if (st.mode !== 'sleeping') { clearInterval(energyTick); return; }
      st.stats.energy = Math.min(100, st.stats.energy + 3);
      updateMoodClasses();
    }, 400);

    setTimeout(function () {
      clearInterval(energyTick);
      if (st.mode === 'sleeping') {
        setMode('idle');
        scheduleWander();
      }
    }, 7000);
  }

  // ── Particles (pixel-art) ─────────────────────────────────────────────────
  // Classic 8-bit heart
  var HEART_SVG =
    '<svg viewBox="0 0 7 6" width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true">' +
      '<rect x="1" y="0" width="2" height="1" fill="#f2607a"/>' +
      '<rect x="4" y="0" width="2" height="1" fill="#f2607a"/>' +
      '<rect x="0" y="1" width="7" height="2" fill="#f2607a"/>' +
      '<rect x="1" y="3" width="5" height="1" fill="#f2607a"/>' +
      '<rect x="2" y="4" width="3" height="1" fill="#f2607a"/>' +
      '<rect x="3" y="5" width="1" height="1" fill="#f2607a"/>' +
      '<rect x="1" y="1" width="1" height="1" fill="#ffaebc"/>' +
    '</svg>';

  // Pixel plus-sign sparkle
  var SPARKLE_SVG =
    '<svg viewBox="0 0 5 5" width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true">' +
      '<rect x="2" y="0" width="1" height="5" fill="#3ee6e6"/>' +
      '<rect x="0" y="2" width="5" height="1" fill="#3ee6e6"/>' +
      '<rect x="2" y="2" width="1" height="1" fill="#b8fbfb"/>' +
    '</svg>';

  function spawnParticle(type) {
    var container = charEl.querySelector('.zenzo__particles');
    var p = document.createElement('div');
    var animation = type === 'heart' ? 'zenzo-heart' : 'zenzo-sparkle';
    var size = type === 'heart' ? (15 + Math.random() * 6) : (12 + Math.random() * 5);
    p.innerHTML = type === 'heart' ? HEART_SVG : SPARKLE_SVG;
    p.style.cssText =
      'position:absolute;top:0;left:' + (25 + Math.random() * 30) + '%;' +
      'width:'  + size + 'px;' +
      'height:' + size + 'px;' +
      'pointer-events:none;' +
      'animation:' + animation + ' 1s steps(6) forwards;';
    container.appendChild(p);
    setTimeout(function () { if (container.contains(p)) container.removeChild(p); }, 1100);
  }

  // Spawn multiple hearts at once for a richer pet animation
  function spawnHearts(count) {
    for (var i = 0; i < count; i++) {
      (function (delay) {
        setTimeout(function () { spawnParticle('heart'); }, delay);
      })(i * 90);
    }
  }

  // Walking dust — small sparkle puff that fades behind/below Zenzo
  function spawnWalkSparkle() {
    var sparkle = document.createElement('div');
    var size = 6 + Math.random() * 4;
    var offsetX = (Math.random() - 0.5) * 20; // ±10px around feet center
    var x = st.x + W / 2 + offsetX;
    var y = st.y + H * 0.92;
    sparkle.innerHTML = SPARKLE_SVG;
    sparkle.style.cssText =
      'position:fixed;left:' + (x - size / 2) + 'px;top:' + y + 'px;' +
      'width:'  + size + 'px;' +
      'height:' + size + 'px;' +
      'pointer-events:none;opacity:0.7;' +
      'animation:zenzo-walk-dust 0.7s steps(5) forwards;';
    toysEl.appendChild(sparkle);
    setTimeout(function () { if (toysEl.contains(sparkle)) toysEl.removeChild(sparkle); }, 800);
  }

  function spawnSleepZ() {
    if (st.mode !== 'sleeping') return;
    var container = charEl.querySelector('.zenzo__particles');
    var z = document.createElement('div');
    z.textContent = 'z';
    var size = 10 + Math.random() * 7;
    z.style.cssText =
      'position:absolute;top:4px;left:' + (20 + Math.random() * 40) + '%;' +
      'font-family:"JetBrains Mono",monospace;font-size:' + size + 'px;' +
      'color:#00c8c8;font-weight:700;pointer-events:none;' +
      'animation:zenzo-sleep-z ' + (0.9 + Math.random() * 0.5) + 's steps(6) forwards;';
    container.appendChild(z);
    setTimeout(function () { if (container.contains(z)) container.removeChild(z); }, 1500);

    if (st.mode === 'sleeping') {
      setTimeout(spawnSleepZ, 500 + Math.random() * 500);
    }
  }

  // ── Hover menu ────────────────────────────────────────────────────────────
  var hoverTimer = null, menuGrace = null;

  function initHoverMenu() {
    charEl.addEventListener('pointerenter', function () {
      clearTimeout(menuGrace);
      hoverTimer = setTimeout(showMenu, 480);
    });

    charEl.addEventListener('pointerleave', function () {
      clearTimeout(hoverTimer);
      menuGrace = setTimeout(function () {
        if (!isPointerOverMenu()) hideMenu();
      }, 220);
    });

    menuEl.addEventListener('pointerleave', function () {
      menuGrace = setTimeout(function () {
        if (!isPointerOverChar()) hideMenu();
      }, 220);
    });

    menuEl.addEventListener('pointerenter', function () {
      clearTimeout(menuGrace);
    });

    menuEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      if (action === 'pet')   { doPet(); hideMenu(); }
      if (action === 'feed')  doFeed();
      if (action === 'play')  doPlay();
      if (action === 'sleep') doSleep();
    });
  }

  // Touch long-press to open menu
  var touchTimer = null, longPressFired = false;
  function initTouchMenu() {
    charEl.addEventListener('touchstart', function (e) {
      longPressFired = false;
      touchTimer = setTimeout(function () {
        longPressFired = true;
        showMenu();
      }, 500);
    }, { passive: true });

    // Long-press must open Zenzo's menu, not the browser context menu
    charEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    charEl.addEventListener('touchend',   function () { clearTimeout(touchTimer); });
    charEl.addEventListener('touchmove',  function () { clearTimeout(touchTimer); });
    charEl.addEventListener('touchcancel',function () { clearTimeout(touchTimer); });
  }

  var pointerOverMenu = false, pointerOverChar = false;
  function isPointerOverMenu() { return pointerOverMenu; }
  function isPointerOverChar() { return pointerOverChar; }

  function initPointerTracking() {
    charEl.addEventListener('pointerenter', function () { pointerOverChar = true;  });
    charEl.addEventListener('pointerleave', function () { pointerOverChar = false; });
    menuEl.addEventListener('pointerenter', function () { pointerOverMenu = true;  });
    menuEl.addEventListener('pointerleave', function () { pointerOverMenu = false; });
  }

  function showMenu() {
    menuEl.hidden = false;
    menuEl.style.position = 'absolute';
    repositionMenu();
  }

  function hideMenu() {
    menuEl.hidden = true;
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  function initKeyboard() {
    charEl.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); doPet(); }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); doFeed(); }
      else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); doPlay(); }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); doSleep(); }
      else if (e.key === 'Escape') {
        st.playThrowMode = false;
        hideMenu();
        setMode('idle');
        scheduleWander();
      }
    });
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  function saveStats() {
    try {
      localStorage.setItem('zenzo:stats',    JSON.stringify(st.stats));
      localStorage.setItem('zenzo:lastTick', String(Date.now()));
      // Exit info lets the next page pick the correct entry edge + Y continuity
      sessionStorage.setItem('zenzo:exitPage', getCurrentPageKey());
      sessionStorage.setItem('zenzo:exitY',    String(Math.round(st.y)));
    } catch (err) {}
  }

  function loadStats() {
    try {
      var saved = JSON.parse(localStorage.getItem('zenzo:stats') || 'null');
      if (saved) st.stats = Object.assign(st.stats, saved);

      // Apply offline decay based on elapsed real time
      var lastTick = parseInt(localStorage.getItem('zenzo:lastTick') || '0', 10);
      if (lastTick) {
        var offMins = (Date.now() - lastTick) / 60000;
        st.stats.hunger    = Math.min(100, st.stats.hunger    + offMins * 10);
        st.stats.happiness = Math.max(0,   st.stats.happiness - offMins * 3);
      }
    } catch (err) {}
  }

  // ── Hide toggle ───────────────────────────────────────────────────────────
  function isHidden() {
    return localStorage.getItem('zenzo:hidden') === 'true';
  }

  function toggleHidden() {
    var nowHidden = !isHidden();
    if (nowHidden) {
      localStorage.setItem('zenzo:hidden', 'true');
      worldEl.style.display = 'none';
    } else {
      localStorage.removeItem('zenzo:hidden');
      worldEl.style.display = '';
      // Friendly bounce on reappear
      charEl.classList.add('zenzo--happy');
      setTimeout(function () { charEl.classList.remove('zenzo--happy'); }, 550);
    }
    updateToggleBtn();
  }

  function updateToggleBtn() {
    var btn = document.getElementById('zenzo-btn');
    if (!btn) return;
    var hidden = isHidden();
    btn.setAttribute('aria-pressed', String(!hidden));
    btn.title       = hidden ? 'Show Zenzo' : 'Hide Zenzo';
    btn.style.opacity = hidden ? '0.4' : '1';
  }

  // ── First-visit hint ──────────────────────────────────────────────────────
  function showHint() {
    if (sessionStorage.getItem('zenzo:hinted')) return;
    sessionStorage.setItem('zenzo:hinted', '1');

    var hint = document.createElement('div');
    hint.id = 'zenzo-hint';
    hint.textContent = window.matchMedia('(pointer: coarse)').matches
      ? 'Tap Zenzo to pet • press & hold for actions • drag to move'
      : 'Drag Zenzo anywhere • hover to interact • drop on elements to perch';
    document.body.appendChild(hint);

    setTimeout(function () {
      hint.classList.add('fade-out');
      setTimeout(function () {
        if (document.body.contains(hint)) document.body.removeChild(hint);
      }, 600);
    }, 4500);
  }

  // ── Idle personality events ───────────────────────────────────────────────
  function scheduleIdleEvents() {
    // Occasionally look toward the cursor (future enhancement hook)
    // Occasionally yawn / sit pose (future)
    // For v1: the wander AI + sleep handle personality
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    inject();
    initRig();
    loadStats();

    // Start hidden off-screen — enterFromEdge() makes Zenzo visible
    st.x = -(W + 20);
    st.y = clampY(window.innerHeight * 0.7);
    charEl.style.left    = st.x + 'px';
    charEl.style.top     = st.y + 'px';
    charEl.style.opacity = '0';

    setFacing('right');
    updateMoodClasses();

    // Apply hidden state from localStorage
    if (isHidden()) worldEl.style.display = 'none';

    // Wire up Zenzo toggle button (all pages)
    var zenzoBtn = document.getElementById('zenzo-btn');
    if (zenzoBtn) {
      zenzoBtn.addEventListener('click', toggleHidden);
      updateToggleBtn();
    }

    // Detect reduced motion
    st.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Interactions
    initDrag();
    initDoubleClick();
    initHoverMenu();
    initTouchMenu();
    initPointerTracking();
    initKeyboard();

    // Save stats on page leave (position is no longer persisted)
    window.addEventListener('pagehide', saveStats);

    // Pause RAF when tab hidden (battery friendly)
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !rafId) startLoop();
    });

    // Start AI loop
    startLoop();

    // Determine entry delay: immediate if "called" from another page, else 3-5s
    var called = false;
    try { called = sessionStorage.getItem('zenzo:called') === '1'; sessionStorage.removeItem('zenzo:called'); } catch (e) {}

    var delay = called ? 300 : (3000 + Math.random() * 2000);
    entryTimerId = setTimeout(enterFromEdge, delay);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    init:         init,
    toggleHidden: toggleHidden,
    isHidden:     isHidden,
    callZenzo:    callZenzo,   // trigger immediate entry (and flag next page)
    doPet:        doPet,
    doFeed:       doFeed,
    doPlay:       doPlay,
    doSleep:      doSleep,
    reset: function () {
      localStorage.removeItem('zenzo:stats');
      localStorage.removeItem('zenzo:hidden');
      localStorage.removeItem('zenzo:lastTick');
      sessionStorage.removeItem('zenzo:called');
      sessionStorage.removeItem('zenzo:hinted');
      location.reload();
    },
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  window.ZenzoManager.init();
});
