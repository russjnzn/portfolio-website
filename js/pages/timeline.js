/**
 * timeline.js — Education/Experience toggle + scroll-triggered entry reveal.
 * Depends on: ThemeManager (main.js), initReveal (animations.js)
 */

(function () {
  var activeFilters = new Set(['education', 'experience']);

  function renderTimeline() {
    var entries = document.querySelectorAll('.timeline-entry[data-type]');
    var visibleCount = 0;

    entries.forEach(function (entry) {
      var isVisible = activeFilters.has(entry.dataset.type);
      entry.style.display = isVisible ? '' : 'none';
      if (isVisible) visibleCount++;
    });

    // Show empty state if nothing visible
    var empty = document.getElementById('timeline-empty');
    if (empty) {
      empty.classList.toggle('timeline-empty--visible', visibleCount === 0);
    }

    // Re-run reveal observer on newly visible entries
    if (window.initReveal) window.initReveal();
  }

  function initToggles() {
    var buttons = document.querySelectorAll('.toggle-btn[data-filter]');

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filter = btn.dataset.filter;

        if (activeFilters.has(filter)) {
          // Don't allow deactivating the last active filter
          if (activeFilters.size <= 1) return;
          activeFilters.delete(filter);
          btn.classList.remove('toggle-btn--active');
        } else {
          activeFilters.add(filter);
          btn.classList.add('toggle-btn--active');
        }

        renderTimeline();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.ThemeManager.init('theme-btn');
    window.ThemeManager.updateIcons();
    window.initNavActive();
    window.initHamburger();

    initToggles();
    renderTimeline();
  });
})();
