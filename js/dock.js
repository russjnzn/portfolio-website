/**
 * dock.js — Dock navigation, click and touch handling.
 * CSS handles all hover/scale effects. No JS magnification.
 * Only loaded on index.html.
 */

window.initDock = function (dockId, contactModalId) {
  var dock = document.getElementById(dockId);
  if (!dock) return;

  var items = Array.from(dock.querySelectorAll('.dock__item'));

  items.forEach(function (item) {
    /* ------------------------------------------------------------------
       Touch: activate on touchend to avoid scroll conflicts
       ------------------------------------------------------------------ */
    item.addEventListener('touchstart', function () {}, { passive: true });
    item.addEventListener('touchend', function (e) {
      e.preventDefault();
      handleItemActivate(item, contactModalId);
    });

    /* ------------------------------------------------------------------
       Click (mouse)
       ------------------------------------------------------------------ */
    item.addEventListener('click', function () {
      handleItemActivate(item, contactModalId);
    });

    /* ------------------------------------------------------------------
       Keyboard: Enter / Space
       ------------------------------------------------------------------ */
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleItemActivate(item, contactModalId);
      }
    });
  });
};

function handleItemActivate(item, contactModalId) {
  var target = item.dataset.target;
  if (!target) return;

  if (target === 'contact') {
    window.ModalManager.open(contactModalId || 'contact-modal');
  } else {
    // Signal to the destination page that we arrived from the dock
    sessionStorage.setItem('navFromDock', '1');
    window.location.href = target;
  }
}
