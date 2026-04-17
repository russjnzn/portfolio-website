/**
 * animations.js — Shared scroll-triggered reveal utility.
 * Used on: about.html, skills.html, timeline.html
 *
 * Adds class 'revealed' to elements with class 'reveal' or 'reveal-right'
 * when they enter the viewport. Fires once per element.
 * Applies stagger delay to siblings automatically.
 */

window.initReveal = function () {
  var elements = Array.from(document.querySelectorAll('.reveal, .reveal-right'));
  if (!elements.length) return;

  /* Apply stagger delay to sibling groups */
  var parents = new Set(elements.map(function (el) { return el.parentElement; }));
  parents.forEach(function (parent) {
    var siblings = Array.from(parent.querySelectorAll('.reveal, .reveal-right'));
    siblings.forEach(function (el, i) {
      el.style.transitionDelay = (i * 80) + 'ms';
    });
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px',
  });

  elements.forEach(function (el) { observer.observe(el); });
};
