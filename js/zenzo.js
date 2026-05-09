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
  var W = 82;            // character width  (px) — matches CSS
  var H = 82;            // character height (px)
  var FOOT = H * 0.94;   // distance from top to feet (SVG legs end at ~97% height)
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
    targetX: 0, targetY: 0,
    perchedEl: null,
    stats: { hunger: 25, happiness: 85, energy: 100 },
    reducedMotion: false,
    playThrowMode: false,
    idleTimerId: null,
  };

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var worldEl, charEl, menuEl, toysEl;
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

    // Inline SVG — every body part is a separate CSS-animated element.
    // Render order (SVG painter's model): tail → back legs → body →
    // front legs → head group → antenna (topmost).
    var svg = [
      '<svg class="zenzo__svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',

      // ── TAIL (behind everything) — long curling sweep ──────────────────
      '<g class="zsv-tail">',
        '<path d="M 68 70 C 90 65 100 48 90 36 C 84 28 74 32 74 41 C 74 46 80 47 81 42"',
              ' fill="none" stroke="white" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>',
        '<path d="M 68 70 C 90 65 100 48 90 36 C 84 28 74 32 74 41 C 74 46 80 47 81 42"',
              ' fill="none" stroke="#ececec" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>',
      '</g>',

      // ── BACK LEGS (behind body) — small rounded nubs ───────────────────
      '<g class="zsv-leg-bl">',
        '<ellipse cx="29" cy="86" rx="7.5" ry="9" fill="#d8d8d8"/>',
      '</g>',
      '<g class="zsv-leg-br">',
        '<ellipse cx="71" cy="86" rx="7.5" ry="9" fill="#d8d8d8"/>',
      '</g>',

      // ── BODY — round, with multi-layer chest glow ─────────────────────
      '<g class="zsv-body">',
        // soft outer body glow
        '<ellipse cx="50" cy="68" rx="24" ry="18" fill="#00cccc" opacity="0.06"/>',
        // main torso
        '<ellipse cx="50" cy="68" rx="22" ry="17" fill="white"/>',
        // top highlight
        '<ellipse cx="46" cy="61" rx="11" ry="6.5" fill="rgba(255,255,255,0.55)"/>',
        // chest core — multi-layer glow
        '<circle cx="50" cy="69" r="13" fill="#00dada" opacity="0.12"/>',
        '<circle cx="50" cy="69" r="9"  fill="#00dada" opacity="0.22"/>',
        '<circle class="zsv-core" cx="50" cy="69" r="5.5" fill="#5becec"/>',
        // bright inner spot
        '<circle cx="49" cy="68" r="2.2" fill="#d0f5f5" opacity="0.95"/>',
      '</g>',

      // ── FRONT LEGS (in front of body) — rounded nubs, slightly larger ──
      '<g class="zsv-leg-fl">',
        '<ellipse cx="38" cy="89" rx="8.5" ry="10" fill="white"/>',
        // teal cuff accent on front-left leg
        '<ellipse cx="38" cy="89" rx="8.5" ry="2.5" fill="rgba(0,210,210,0.45)"/>',
      '</g>',
      '<g class="zsv-leg-fr">',
        '<ellipse cx="62" cy="89" rx="8.5" ry="10" fill="white"/>',
      '</g>',

      // ── HEAD GROUP ─────────────────────────────────────────────────────
      '<g class="zsv-head">',

        // LEFT EAR — teardrop, droopy
        '<g class="zsv-ear-l">',
          '<path d="M 28 24 Q 12 28 14 50 Q 18 56 23 51 Q 28 41 30 30 Z" fill="white"/>',
          // ear inner shadow
          '<path d="M 24 30 Q 18 38 19 47" fill="none" stroke="#e8e8e8" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>',
        '</g>',

        // RIGHT EAR — teardrop, droopy
        '<g class="zsv-ear-r">',
          '<path d="M 72 24 Q 88 28 86 50 Q 82 56 77 51 Q 72 41 70 30 Z" fill="white"/>',
          '<path d="M 76 30 Q 82 38 81 47" fill="none" stroke="#e8e8e8" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>',
        '</g>',

        // HEAD SHAPE — slightly oval bubble helmet
        '<ellipse cx="50" cy="36" rx="25.5" ry="24" fill="white"/>',
        // soft top highlight
        '<ellipse cx="42" cy="26" rx="11" ry="7.5" fill="rgba(255,255,255,0.45)"/>',

        // VISOR — rounded RECTANGLE (matches reference exactly)
        '<rect class="zsv-visor" x="30" y="22" width="40" height="28" rx="12" fill="#0a0a0a"/>',
        // visor specular highlight (top-left gleam)
        '<ellipse cx="38" cy="28" rx="7" ry="3.5" fill="rgba(255,255,255,0.12)" transform="rotate(-15,38,28)"/>',
        '<ellipse cx="38" cy="28" rx="3" ry="1.6" fill="rgba(255,255,255,0.35)" transform="rotate(-15,38,28)"/>',

        // EYES — happy crescents with cyan glow halos
        '<g class="zsv-eyes">',
          // soft glow halos behind eyes
          '<ellipse cx="41" cy="34" rx="6.5" ry="3.5" fill="#5becec" opacity="0.2"/>',
          '<ellipse cx="59" cy="34" rx="6.5" ry="3.5" fill="#5becec" opacity="0.2"/>',
          // upper crescent arcs (smile shape)
          '<path d="M 36 34 Q 41 27 46 34" fill="none" stroke="#5becec" stroke-width="3.5" stroke-linecap="round"/>',
          '<path d="M 54 34 Q 59 27 64 34" fill="none" stroke="#5becec" stroke-width="3.5" stroke-linecap="round"/>',
          // bright inner glow on each eye
          '<path d="M 38 33 Q 41 30 44 33" fill="none" stroke="#d0f5f5" stroke-width="1.2" stroke-linecap="round" opacity="0.85"/>',
          '<path d="M 56 33 Q 59 30 62 33" fill="none" stroke="#d0f5f5" stroke-width="1.2" stroke-linecap="round" opacity="0.85"/>',
        '</g>',

        // BLINK COVER — opacity=0 normally, animates during blink
        '<g class="zsv-blink">',
          '<rect x="33" y="29" width="15" height="9" rx="4.5" fill="#0a0a0a"/>',
          '<rect x="52" y="29" width="15" height="9" rx="4.5" fill="#0a0a0a"/>',
        '</g>',

        // CHEEK BLUSH (subtle rosy spots)
        '<ellipse cx="32" cy="46" rx="4" ry="2.5" fill="rgba(255,150,150,0.22)"/>',
        '<ellipse cx="68" cy="46" rx="4" ry="2.5" fill="rgba(255,150,150,0.22)"/>',

      '</g>',

      // ── ANTENNA (topmost layer) ────────────────────────────────────────
      '<g class="zsv-antenna">',
        // thin stick
        '<line x1="50" y1="13" x2="55" y2="3" stroke="white" stroke-width="2.5" stroke-linecap="round"/>',
        // small mid bauble
        '<circle cx="53" cy="8" r="2.5" fill="white"/>',
        // outer glow halo (large soft)
        '<circle class="zsv-antenna-glow-ring" cx="56" cy="2" r="9" fill="#5becec" opacity="0.25"/>',
        // mid glow
        '<circle cx="56" cy="2" r="6.5" fill="#5becec" opacity="0.4"/>',
        // glowing orb
        '<circle class="zsv-antenna-ball" cx="56" cy="2" r="4.5" fill="#5becec"/>',
        // bright inner spot
        '<circle cx="55" cy="1" r="1.6" fill="#d0f5f5"/>',
        // sparkle 1 (left)
        '<g class="zsv-sparkle-1" transform="translate(38,8)">',
          '<path d="M0,-4 L.85,-.85 L4,0 L.85,.85 L0,4 L-.85,.85 L-4,0 L-.85,-.85 Z" fill="#5becec" opacity="0.9"/>',
        '</g>',
        // sparkle 2 (right)
        '<g class="zsv-sparkle-2" transform="translate(70,5)">',
          '<path d="M0,-3 L.6,-.6 L3,0 L.6,.6 L0,3 L-.6,.6 L-3,0 L-.6,-.6 Z" fill="#5becec" opacity="0.7"/>',
        '</g>',
      '</g>',

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

  // ── Position helpers ──────────────────────────────────────────────────────
  function clampX(x) { return Math.max(0, Math.min(x, window.innerWidth  - W)); }
  function clampY(y) { return Math.max(0, Math.min(y, window.innerHeight - H)); }

  function moveTo(x, y) {
    st.x = clampX(x);
    st.y = clampY(y);
    charEl.style.left = st.x + 'px';
    charEl.style.top  = st.y + 'px';
    if (!menuEl.hidden) repositionMenu();
  }

  function repositionMenu() {
    var mw = menuEl.offsetWidth || 180;
    var mx = st.x + W / 2 - mw / 2;
    // Keep menu inside viewport
    mx = Math.max(8, Math.min(mx, window.innerWidth - mw - 8));
    menuEl.style.left = mx + 'px';
    menuEl.style.top  = (st.y - 54) + 'px';
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

        if (dist < 3) {
          setMode('idle');
          scheduleWander();
        } else {
          var step = Math.min(WALK_SPEED * dt, dist);
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

  // ── Double-click to summon ─────────────────────────────────────────────────
  function initDoubleClick() {
    document.addEventListener('dblclick', function (e) {
      if (charEl.contains(e.target) || menuEl.contains(e.target)) return;

      var tx = clampX(e.clientX - W / 2);
      var ty = clampY(e.clientY - FOOT);

      spawnCallRipple(e.clientX, e.clientY);

      if (!hasEntered) {
        // Trigger immediate entry aimed at the click point
        hasEntered = true;
        clearTimeout(entryTimerId);
        var fromRight = e.clientX > window.innerWidth / 2;
        st.x = fromRight ? window.innerWidth + 20 : -(W + 20);
        st.y = clampY(e.clientY - H * 0.5);
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
    });
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
        // Treat as click → pet
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
    charEl.classList.remove('zenzo--landing');
    void charEl.offsetWidth; // reflow to restart animation
    charEl.classList.add('zenzo--landing');
    setTimeout(function () { charEl.classList.remove('zenzo--landing'); }, 380);
  }

  // ── SVG assets for actions ────────────────────────────────────────────────
  // Food bowl with visible kibble pieces
  var BOWL_SVG =
    '<svg viewBox="0 0 60 50" width="100%" height="100%" aria-hidden="true">' +
      // ground shadow
      '<ellipse cx="30" cy="46" rx="22" ry="2.5" fill="rgba(0,0,0,0.25)"/>' +
      // bowl outer body
      '<path d="M 8 26 Q 8 46 30 46 Q 52 46 52 26 Z" fill="#c4c4c4"/>' +
      '<path d="M 8 26 Q 8 46 30 46 Q 52 46 52 26 Z" fill="none" stroke="#909090" stroke-width="1"/>' +
      // bowl rim shadow
      '<ellipse cx="30" cy="26" rx="22" ry="6" fill="#909090"/>' +
      '<ellipse cx="30" cy="25" rx="20" ry="5" fill="#5a5a5a"/>' +
      // kibble pieces (warm browns)
      '<ellipse cx="22" cy="22" rx="4" ry="3.2" fill="#c47734"/>' +
      '<ellipse cx="32" cy="20" rx="3.5" ry="2.8" fill="#a55d24"/>' +
      '<ellipse cx="38" cy="23" rx="4.2" ry="3" fill="#c47734"/>' +
      '<ellipse cx="28" cy="24" rx="3.2" ry="2.5" fill="#8a4a18"/>' +
      // kibble highlights
      '<ellipse cx="21" cy="21" rx="1.2" ry="0.8" fill="rgba(255,220,180,0.7)"/>' +
      '<ellipse cx="37" cy="22" rx="1.3" ry="0.8" fill="rgba(255,220,180,0.7)"/>' +
    '</svg>';

  // Cute cyan-and-white striped ball
  var BALL_SVG =
    '<svg viewBox="0 0 30 30" width="100%" height="100%" aria-hidden="true">' +
      // shadow
      '<ellipse cx="15" cy="28" rx="10" ry="1.5" fill="rgba(0,0,0,0.25)"/>' +
      // ball body
      '<circle cx="15" cy="14" r="12" fill="white" stroke="#bbb" stroke-width="0.5"/>' +
      // cyan stripe across the ball
      '<path d="M 4 16 Q 15 9 26 16" fill="none" stroke="#5becec" stroke-width="3.5" stroke-linecap="round"/>' +
      // highlight
      '<ellipse cx="11" cy="10" rx="3.5" ry="2.5" fill="rgba(255,255,255,0.7)"/>' +
      '<ellipse cx="11" cy="10" rx="1.5" ry="1" fill="rgba(255,255,255,0.95)"/>' +
    '</svg>';

  // ── Actions ───────────────────────────────────────────────────────────────
  function doPet() {
    st.stats.happiness = Math.min(100, st.stats.happiness + 6);
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

  // ── Particles ─────────────────────────────────────────────────────────────
  // Cyan SVG heart matching the reference design
  var HEART_SVG =
    '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#5becec" aria-hidden="true">' +
      '<path d="M12 21s-7-4.5-9-9c-1.5-3.6 1.1-7 4.5-7 2 0 3.7 1 4.5 3 .8-2 2.5-3 4.5-3 3.4 0 6 3.4 4.5 7-2 4.5-9 9-9 9z"/>' +
    '</svg>';

  // Cyan SVG sparkle (4-pointed star)
  var SPARKLE_SVG =
    '<svg viewBox="-10 -10 20 20" width="100%" height="100%" aria-hidden="true">' +
      '<path d="M0,-9 L1.8,-1.8 L9,0 L1.8,1.8 L0,9 L-1.8,1.8 L-9,0 L-1.8,-1.8 Z" fill="#5becec"/>' +
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
      'filter:drop-shadow(0 0 4px rgba(91,236,236,0.6));' +
      'animation:' + animation + ' 1s ease-out forwards;';
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
      'animation:zenzo-walk-dust 0.7s ease-out forwards;';
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
      'animation:zenzo-sleep-z ' + (0.9 + Math.random() * 0.5) + 's ease-out forwards;';
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
  var touchTimer = null;
  function initTouchMenu() {
    charEl.addEventListener('touchstart', function (e) {
      touchTimer = setTimeout(function () {
        showMenu();
      }, 500);
    }, { passive: true });

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
    hint.textContent = 'Drag Zenzo anywhere • hover to interact • drop on elements to perch';
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
