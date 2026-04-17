/**
 * skills.js — Progress bar fill animation on scroll.
 * Depends on: ThemeManager (main.js), initReveal (animations.js)
 */

(function () {
  function initProgressBars() {
    var rows = document.querySelectorAll('.skill-row');
    if (!rows.length) return;

    var barObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var fill = entry.target.querySelector('.progress-bar__fill');
          if (fill) {
            fill.style.width = (fill.dataset.percent || '0') + '%';
          }
          barObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    rows.forEach(function (row) { barObserver.observe(row); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.ThemeManager.init('theme-btn');
    window.ThemeManager.updateIcons();
    window.initNavActive();
    window.initHamburger();
    window.initReveal();
    initProgressBars();
  });
})();
