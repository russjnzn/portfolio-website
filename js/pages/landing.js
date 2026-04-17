/**
 * landing.js — Landing page entrance sequence and typewriter.
 * Depends on: ThemeManager (main.js), ModalManager (main.js), initDock (dock.js)
 */

(function () {
  /* ------------------------------------------------------------------
     Utility: sleep
     ------------------------------------------------------------------ */
  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* ------------------------------------------------------------------
     Typewriter
     ------------------------------------------------------------------ */
  var ROLES = ['Data Enthusiast', 'Data Scientist', 'Machine Learning Engineer'];
  var roleIndex = 0;
  var charIndex = 0;
  var isDeleting = false;
  var typewriterEl = document.getElementById('typewriter-text');
  var cursorEl = document.querySelector('.typewriter-cursor');
  var typewriterStarted = false;

  function type() {
    if (!typewriterEl) return;
    var current = ROLES[roleIndex];

    if (isDeleting) {
      // Deleting — pause cursor blink
      if (cursorEl) cursorEl.classList.add('typewriter-cursor--typing');
      charIndex--;
      typewriterEl.textContent = current.slice(0, charIndex);
      if (charIndex <= 0) {
        isDeleting = false;
        roleIndex = (roleIndex + 1) % ROLES.length;
        // Pause before typing next word
        if (cursorEl) cursorEl.classList.remove('typewriter-cursor--typing');
        setTimeout(type, 100);
        return;
      }
      setTimeout(type, 28);
    } else {
      // Typing
      if (cursorEl) cursorEl.classList.add('typewriter-cursor--typing');
      charIndex++;
      typewriterEl.textContent = current.slice(0, charIndex);
      if (charIndex >= current.length) {
        isDeleting = true;
        if (cursorEl) cursorEl.classList.remove('typewriter-cursor--typing');
        // Hold the completed word before erasing
        setTimeout(type, 1000);
        return;
      }
      setTimeout(type, 62);
    }
  }

  function startTypewriter() {
    if (typewriterStarted) return;
    typewriterStarted = true;
    charIndex = 0;
    isDeleting = false;
    type();
  }

  /* ------------------------------------------------------------------
     Name reveal — split text into per-character spans
     ------------------------------------------------------------------ */
    function revealName() {
      var nameEl = document.getElementById('name');
      if (!nameEl) return;

      var text = nameEl.textContent.trim();
      nameEl.textContent = '';

      var spans = [];
      for (var i = 0; i < text.length; i++) {
        var span = document.createElement('span');

        if (text[i] === ' ') {
          span.className = 'landing-name__char landing-name__char--space';
          span.innerHTML = '&nbsp;';
        } else {
          span.className = 'landing-name__char';
          span.textContent = text[i];
        }

        nameEl.appendChild(span);
        spans.push(span);
      }

      // ✅ Reveal container ONLY when ready
      nameEl.style.opacity = '1';

      // Then animate characters
      requestAnimationFrame(() => {
        spans.forEach((span, i) => {
          setTimeout(() => {
            span.classList.add('landing-name__char--visible');
          }, i * 28);
        });
      });
    }

  /* ------------------------------------------------------------------
     Entrance sequence
     ------------------------------------------------------------------ */
  async function runEntrance() {
    // 1. Hold the loader (1.4s)
    await sleep(1400);

    // 2. Exit the loader
    var loader = document.getElementById('loader');
    if (loader) {
      loader.classList.add('loader--exit');
      loader.addEventListener('transitionend', function () {
        loader.style.display = 'none';
      }, { once: true });
    }
    await sleep(320);

    // 3. Reveal name letter by letter (28ms stagger, ~27 chars ≈ 756ms, then settle)
    revealName();
    await sleep(27 * 29 + 400);

    // 4. Fade roles in, start typewriter cycling
    var rolesEl = document.getElementById('roles');
    if (rolesEl) rolesEl.classList.add('landing-roles--visible');
    await sleep(180);
    startTypewriter();

    // 5. Let one full word mostly type before transitioning (~1.4s)
    await sleep(7400);

    // 6. Stop typewriter, fade out center hero
    typewriterStopped = true;
    var heroEl = document.getElementById('hero');
    if (heroEl) heroEl.classList.add('landing-hero--exit');

    // 7. Show chat widget simultaneously
    var chatWidget = document.getElementById('chat-widget');
    if (chatWidget) chatWidget.classList.add('chat-widget--visible');

    // 8. Show dock container (slight delay so hero exit is underway)
    await sleep(200);
    var dock = document.getElementById('dock');
    if (dock) {
      dock.classList.remove('dock--hidden');
      dock.classList.add('dock--visible');

      // 9. Stagger dock items left to right — all appear within 1 second
      var items = Array.from(dock.querySelectorAll('.dock__item'));
      var totalMs = 1000;
      var stagger = totalMs / items.length; // 200ms each for 5 items

      items.forEach(function (item, i) {
        setTimeout(function () {
          item.style.transitionDelay = '0ms'; // reset for hover to work immediately
          item.classList.add('dock__item--visible');
          // Clean up transitionDelay after entrance finishes so hover is instant
          setTimeout(function () {
            item.style.transitionDelay = '';
          }, 420);
        }, i * stagger);
      });
    }
  }

  /* ------------------------------------------------------------------
     Copy to clipboard helper (for contact modal email)
     ------------------------------------------------------------------ */
  function initCopyEmail() {
    var emailRow = document.getElementById('modal-email-row');
    var hint = document.getElementById('modal-email-hint');
    if (!emailRow) return;
    emailRow.addEventListener('click', function () {
      var email = emailRow.dataset.email || '';
      navigator.clipboard.writeText(email).then(function () {
        if (hint) {
          hint.textContent = 'Copied!';
          setTimeout(function () { hint.textContent = 'Click to copy'; }, 2000);
        }
      }).catch(function () {
        window.location.href = 'mailto:' + email;
      });
    });
  }

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {
    // Theme toggle
    window.ThemeManager.init('theme-btn');
    window.ThemeManager.updateIcons();

    // Mark theme icon button
    var themeBtn = document.getElementById('theme-btn');
    if (themeBtn) themeBtn.setAttribute('data-theme-icon', '');

    // Dock
    window.initDock('dock', 'contact-modal');

    // Modal close buttons
    document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.ModalManager.close(btn.dataset.closeModal);
      });
    });

    // Copy email
    initCopyEmail();

    // Chat widget
    initChat();

    // Run entrance
    runEntrance();
  });

  /* ------------------------------------------------------------------
     AI Chat Widget
     ------------------------------------------------------------------ */
  var CHAT_API = window.CHAT_API_URL || 'http://localhost:8000/api/chat';
  var chatHistory = [];
  var chatOpen    = false;
  var chatBusy    = false;

  function initChat() {
    var widget    = document.getElementById('chat-widget');
    var panel     = document.getElementById('chat-panel');
    var inputWrap = document.getElementById('chat-input-wrap');
    var input     = document.getElementById('chat-input');
    var sendBtn   = document.getElementById('chat-send');
    var closeBtn  = document.getElementById('chat-close');
    var messages  = document.getElementById('chat-messages');
    var typing    = document.getElementById('chat-typing');

    if (!widget || !panel || !input) return;

    /* Open when clicking anywhere on the pill (but not already open) */
    inputWrap.addEventListener('click', function () {
      if (!chatOpen) openPanel();
    });

    /* Also open when input receives focus */
    input.addEventListener('focus', function () {
      if (!chatOpen) openPanel();
    });

    /* Show/hide send button as user types */
    input.addEventListener('input', function () {
      if (input.value.trim()) {
        sendBtn.classList.add('chat-send-btn--active');
      } else {
        sendBtn.classList.remove('chat-send-btn--active');
      }
    });

    /* Send on Enter */
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    });

    /* Send on button click */
    sendBtn.addEventListener('click', doSend);

    /* Close via × button */
    closeBtn.addEventListener('click', closePanel);

    /* Escape key closes */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && chatOpen) closePanel();
    });

    function openPanel() {
      chatOpen = true;
      panel.classList.add('chat-panel--open');
      panel.setAttribute('aria-hidden', 'false');
      widget.classList.add('chat-widget--open');
      setTimeout(function () { input.focus(); }, 40);
    }

    function closePanel() {
      chatOpen = false;
      panel.classList.remove('chat-panel--open');
      panel.setAttribute('aria-hidden', 'true');
      widget.classList.remove('chat-widget--open');
      input.blur();
    }

    function doSend() {
      var msg = input.value.trim();
      if (!msg || chatBusy) return;

      input.value = '';
      sendBtn.classList.remove('chat-send-btn--active');

      appendBubble('user', msg);

      /* History sent = turns before this message; then we push user msg */
      var historySnapshot = chatHistory.slice();
      chatHistory.push({ role: 'user', content: msg });

      showTyping();
      chatBusy = true;

      fetch(CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: historySnapshot }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          hideTyping();
          chatBusy = false;
          appendBubble('assistant', data.reply);
          chatHistory.push({ role: 'assistant', content: data.reply });
        })
        .catch(function () {
          hideTyping();
          chatBusy = false;
          appendBubble('assistant', 'Sorry, I had trouble connecting. Please try again in a moment.');
        });
    }

    function appendBubble(role, text) {
      /* Insert before the typing indicator so dots always stay last */
      var div = document.createElement('div');
      div.className = 'chat-msg chat-msg--' + role;

      if (role === 'assistant') {
        var avatar = document.createElement('img');
        avatar.src = 'assets/images/profile_pic.png';
        avatar.alt = 'Russel';
        avatar.className = 'chat-msg__avatar';
        avatar.setAttribute('aria-hidden', 'true');
        div.appendChild(avatar);
      }

      var bubble = document.createElement('div');
      bubble.className = 'chat-msg__bubble';
      bubble.textContent = text;
      div.appendChild(bubble);
      messages.insertBefore(div, typing);
      messages.scrollTop = messages.scrollHeight;
    }

    function showTyping() {
      typing.classList.add('chat-typing--visible');
      typing.setAttribute('aria-hidden', 'false');
      messages.scrollTop = messages.scrollHeight;
    }

    function hideTyping() {
      typing.classList.remove('chat-typing--visible');
      typing.setAttribute('aria-hidden', 'true');
    }
  }

})();
