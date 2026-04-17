/**
 * main.js — Global logic. Loaded synchronously in <head> on every page.
 * Must run before first paint to prevent Flash of Wrong Theme (FOWT).
 * No defer, no async.
 */

/* --------------------------------------------------------------------------
   Theme IIFE — runs immediately, before DOM is painted
   -------------------------------------------------------------------------- */
(function () {
  var saved = localStorage.getItem('theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isDark = saved === 'dark' || (!saved && prefersDark) || !saved;
  var html = document.documentElement;

  // Remove both first to avoid duplicates on hot-reload
  html.classList.remove('dark', 'light');
  html.classList.add(isDark ? 'dark' : 'light');
})();

/* --------------------------------------------------------------------------
   ThemeManager — exposed globally for all pages to use
   -------------------------------------------------------------------------- */
window.ThemeManager = (function () {
  var SVG_SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  var SVG_MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function getCurrent() {
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
  }

  function toggle() {
    var html = document.documentElement;
    var isDark = getCurrent() === 'dark';
    html.classList.remove('dark', 'light');
    html.classList.add(isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
    updateIcons();
  }

  function updateIcons() {
    var isDark = getCurrent() === 'dark';
    document.querySelectorAll('[data-theme-icon]').forEach(function (el) {
      // In dark mode, show sun (to switch to light). In light mode, show moon (to switch to dark).
      el.innerHTML = isDark ? SVG_SUN : SVG_MOON;
    });
  }

  function init(btnId) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', toggle);
    // Set initial icon
    updateIcons();
  }

  return { getCurrent: getCurrent, toggle: toggle, init: init, updateIcons: updateIcons };
})();

/* --------------------------------------------------------------------------
   Modal manager — exposed globally
   -------------------------------------------------------------------------- */
window.ModalManager = (function () {
  function open(modalId) {
    var overlay = document.getElementById(modalId);
    if (!overlay) return;
    overlay.classList.add('modal-overlay--open');
    document.body.style.overflow = 'hidden';

    // Trap focus
    var focusable = overlay.querySelectorAll('button, a, input, [tabindex="0"]');
    if (focusable.length) focusable[0].focus();

    // Escape key closes
    function onKey(e) {
      if (e.key === 'Escape') {
        close(modalId);
        document.removeEventListener('keydown', onKey);
      }
    }
    document.addEventListener('keydown', onKey);

    // Backdrop click closes
    overlay.addEventListener('click', function onBackdrop(e) {
      if (e.target === overlay) {
        close(modalId);
        overlay.removeEventListener('click', onBackdrop);
      }
    });
  }

  function close(modalId) {
    var overlay = document.getElementById(modalId);
    if (!overlay) return;
    overlay.classList.remove('modal-overlay--open');
    document.body.style.overflow = '';
  }

  return { open: open, close: close };
})();

/* --------------------------------------------------------------------------
   Nav active link highlighter — called by sub-pages
   -------------------------------------------------------------------------- */
window.initNavActive = function () {
  var path = window.location.pathname;
  document.querySelectorAll('.navbar__link[data-page]').forEach(function (link) {
    if (path.indexOf(link.dataset.page) !== -1) {
      link.classList.add('navbar__link--active');
    }
  });
};

/* --------------------------------------------------------------------------
   Navbar dock-origin entrance — called automatically on DOMContentLoaded.
   If the user arrived from the landing dock, animates nav links in like
   dock items (staggered opacity + translateY from below).
   -------------------------------------------------------------------------- */
window.initNavbarEntrance = function () {
  if (!sessionStorage.getItem('navFromDock')) return;
  sessionStorage.removeItem('navFromDock');

  var logo  = document.querySelector('.navbar__logo');
  var links = Array.from(document.querySelectorAll('.navbar__link'));
  var all   = (logo ? [logo] : []).concat(links);

  if (!all.length) return;

  // Apply hidden state before paint
  all.forEach(function (el) { el.classList.add('navbar--dock-hidden'); });

  // Stagger reveal — same feel as dock items
  requestAnimationFrame(function () {
    all.forEach(function (el, i) {
      setTimeout(function () {
        el.classList.remove('navbar--dock-hidden');
      }, 60 + i * 70);
    });
  });
};

document.addEventListener('DOMContentLoaded', function () {
  window.initNavbarEntrance();
});

/* --------------------------------------------------------------------------
   Mobile hamburger menu
   -------------------------------------------------------------------------- */
window.initHamburger = function () {
  var btn = document.getElementById('hamburger-btn');
  var menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', function () {
    var open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
  });
};
