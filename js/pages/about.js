/**
 * about.js — About page initialization, testimonial auto-play slider.
 * Depends on: ThemeManager (main.js), initReveal (animations.js)
 */

(function () {

  /* ------------------------------------------------------------------
     Testimonial auto-play slider
     ------------------------------------------------------------------ */
  function initTestimonialSlider() {
    var track   = document.getElementById('testimonials-track');
    var dotsCon = document.getElementById('testimonials-dots');
    if (!track) return;

    var slides = Array.from(track.querySelectorAll('.testimonial-card'));
    var dots   = dotsCon ? Array.from(dotsCon.querySelectorAll('.testimonials-dot')) : [];
    var total  = slides.length;
    var current = 0;
    var timer;
    var INTERVAL = 4500;   /* ms between auto-advances */
    var PAUSE_MS = 8000;   /* pause this long after manual dot click */

    function goTo(n) {
      current = (n + total) % total;
      track.style.transform = 'translateX(-' + current * 100 + '%)';

      dots.forEach(function (d, i) {
        d.classList.toggle('testimonials-dot--active', i === current);
      });
    }

    function startTimer(delay) {
      clearInterval(timer);
      timer = setInterval(function () {
        goTo(current + 1);
      }, delay || INTERVAL);
    }

    /* Dot clicks — jump to that slide and restart the timer with a longer pause */
    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        goTo(parseInt(dot.dataset.slide, 10));
        startTimer(PAUSE_MS);
      });
    });

    /* Pause on hover, resume on leave */
    var sliderEl = track.parentElement;
    if (sliderEl) {
      sliderEl.addEventListener('mouseenter', function () { clearInterval(timer); });
      sliderEl.addEventListener('mouseleave', function () { startTimer(); });
    }

    /* Kick off */
    goTo(0);
    startTimer();
  }

  /* ------------------------------------------------------------------
     Gallery — clone-based infinite loop
     ------------------------------------------------------------------ */
  function initGallery() {
    var track    = document.getElementById('gallery-track');
    var viewport = document.getElementById('gallery-viewport');
    var btnPrev  = document.getElementById('gallery-prev');
    var btnNext  = document.getElementById('gallery-next');
    if (!track || !viewport) return;

    var origImgs = Array.from(track.querySelectorAll('.gallery-img'));
    var total    = origImgs.length;
    if (total === 0) return;

    var CLONE_N = 3;   /* clones prepended + appended */

    /* Build clone sets */
    var prependClones = origImgs.slice(-CLONE_N).map(function (el) {
      return el.cloneNode(true);
    });
    var appendClones = origImgs.slice(0, CLONE_N).map(function (el) {
      return el.cloneNode(true);
    });

    /* Insert clones */
    prependClones.forEach(function (cl) { track.insertBefore(cl, track.firstChild); });
    appendClones.forEach(function (cl) { track.appendChild(cl); });

    /* All items (clones + real) */
    var allImgs  = Array.from(track.querySelectorAll('.gallery-img'));
    var offset   = CLONE_N;   /* start at first real image */
    var isAnim   = false;

    function itemWidth() {
      /* gap between items + item width */
      if (allImgs.length < 2) return allImgs[0].offsetWidth + 12;
      return allImgs[1].getBoundingClientRect().left - allImgs[0].getBoundingClientRect().left;
    }

    function jumpTo(n, animate) {
      if (!animate) {
        track.style.transition = 'none';
      } else {
        track.style.transition = '';
      }
      offset = n;
      track.style.transform = 'translateX(-' + (offset * itemWidth()) + 'px)';
    }

    function advance(dir) {
      if (isAnim) return;
      isAnim = true;
      jumpTo(offset + dir, true);
    }

    track.addEventListener('transitionend', function () {
      /* Silently jump to real equivalent when entering clone zone */
      if (offset >= CLONE_N + total) {
        jumpTo(CLONE_N, false);
      } else if (offset < CLONE_N) {
        jumpTo(CLONE_N + total - 1, false);
      }
      isAnim = false;
    });

    if (btnPrev) {
      btnPrev.addEventListener('click', function () { advance(-1); });
    }
    if (btnNext) {
      btnNext.addEventListener('click', function () { advance(1); });
    }

    /* Initial position (no animation) */
    jumpTo(CLONE_N, false);

    /* Recalculate on resize */
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        jumpTo(offset, false);
      }, 100);
    });
  }

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {
    window.ThemeManager.init('theme-btn');
    window.ThemeManager.updateIcons();
    window.initNavActive();
    window.initHamburger();
    window.initReveal();

    initTestimonialSlider();
    initGallery();
  });

})();
