/**
 * projects.js — Playing-card deck with real card flip + enlarge.
 *
 * The card itself flies to centre and flips — no separate modal.
 *
 * card element     → position (left/top) + z-index  [hit area lives here]
 * card__inner      → transform: translate rotate scale rotateY  [all motion]
 *
 * All 4 functions always appear in the same order so the browser can
 * interpolate each independently across every state transition.
 *
 * Depends on: ThemeManager (main.js)
 */

(function () {

  /* ------------------------------------------------------------------
     Constants
     ------------------------------------------------------------------ */
  var CARD_W = 200;
  var CARD_H = 280;
  var EASE   = 'cubic-bezier(0.16, 1, 0.3, 1)';

  /* ------------------------------------------------------------------
     Project data
     ------------------------------------------------------------------ */
  var CARDS = [
    {
      id: '1',
      name: 'Customer Churn',
      category: 'Supervised ML • Classification',
      icon: 'assets/icons/icon.png',
      desc: 'Built ensemble churn prediction model (XGBoost, LightGBM) with SHAP interpretability, achieving 0.89 F1-score on minority class and delivering actionable retention insights for business stakeholders.',
      img: 'https://placehold.co/400x160/1a1a1a/008080?text=ChurnShield',
      link: '#',
      linkLabel: 'View Repo',
    },
    {
      id: '2',
      name: 'Sentiment Analysis',
      category: 'NLP • Deep Learning • Transformers',
      icon: 'assets/icons/icon.png',
      desc: 'Fine-tuned DistilBERT on 50K+ reviews for 5-class sentiment classification, achieving 15% F1-score improvement over TF-IDF baseline with MLflow experiment tracking.',
      img: 'https://placehold.co/400x160/1a1a1a/008080?text=SentimentLens',
      link: '#',
      linkLabel: 'View Repo',
    },
    {
      id: '3',
      name: 'ML Deployment',
      category: 'MLOps • API Development • CI/CD',
      icon: 'assets/icons/icon.png',
      desc: 'Deployed FastAPI prediction service with Docker, GitHub Actions CI/CD, and Streamlit demo, serving real-time predictions at 50ms p95 latency with full monitoring and testing.',
      img: 'https://placehold.co/400x160/1a1a1a/008080?text=PricePulse',
      link: '#',
      linkLabel: 'View Repo',
    },
    {
      id: '4',
      name: 'RAG Q&A',
      category: 'LLM • GenAI • Retrieval Systems',
      icon: 'assets/icons/icon.png',
      desc: 'Built RAG system with semantic search (sentence-transformers + ChromaDB) over 500+ documents, achieving 85% answer faithfulness with measurable improvements over keyword search.',
      img: 'https://placehold.co/400x160/1a1a1a/008080?text=VisualQuery',
      link: '#',
      linkLabel: 'View Repo',
    },
    {
      id: '5',
      name: 'Power BI Dashboard',
      category: 'Data Visualization',
      icon: 'assets/icons/icon.png',
      desc: 'Interactive Streamlit app visualizing 30 years of Philippine climate data. Includes trend analysis, anomaly detection, and multi-variable forecasting.',
      img: 'https://placehold.co/400x160/1a1a1a/008080?text=ClimateWatch',
      link: '#',
      linkLabel: 'Visit App',
    },
    {
      id: '6',
      name: 'Mental State Recognition',
      category: 'Deep Learning • Healthcare • LSTM' ,
      icon: 'assets/icons/icon.png',
      desc: 'Developed CNN-BiLSTM model for depression detection from speech using DAIC-WoZ database and MFCC features, demonstrating deep learning\'s potential for accessible mental health screening.',
      img: 'https://placehold.co/400x160/1a1a1a/008080?text=RecoEngine',
      link: '#',
      linkLabel: 'View Repo',
    },
  ];

  /* ------------------------------------------------------------------
     Deck fan layout
     tx/ty are baked into card element's left/top (not inner transform)
     so each card has its own hit area — fixing the click-through bug.
     Wider spread (±120px) gives ~50px uniquely clickable strip per card.
     z: higher = visually in front (rightmost card is on top).
     ------------------------------------------------------------------ */
  var DECK_T = [
    { tx: -120, ty: 45, rot: -20, z: 1 },
    { tx:  -72, ty: 20, rot: -12, z: 2 },
    { tx:  -24, ty:  4, rot:  -4, z: 3 },
    { tx:   24, ty:  4, rot:   4, z: 4 },
    { tx:   72, ty: 20, rot:  12, z: 5 },
    { tx:  120, ty: 45, rot:  20, z: 6 },
  ];

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */
  var state      = 'deck';   // 'deck' | 'spread'
  var cardEls    = [];
  var activeCard = null;

  /* ------------------------------------------------------------------
     Transform helper — 4 consistent functions, always in same order:
       translate(x,y)  rotate(zDeg)  scale(s)  rotateY(yDeg)
     ------------------------------------------------------------------ */
  function tf(tx, ty, rot, s, ry) {
    return (
      'translate('  + tx.toFixed(1)  + 'px, ' + ty.toFixed(1)  + 'px) ' +
      'rotate('     + rot.toFixed(2) + 'deg) ' +
      'scale('      + s.toFixed(4)   + ') '   +
      'rotateY('    + ry.toFixed(1)  + 'deg)'
    );
  }

  /* ------------------------------------------------------------------
     Icon renderer — returns <img> for image paths, text otherwise
     ------------------------------------------------------------------ */
  function renderIcon(icon, cls) {
    var isImg = /\.(png|jpe?g|gif|svg|webp)$/i.test(icon);
    if (isImg) {
      return '<img src="' + icon + '" alt="" class="' + cls + '-img" aria-hidden="true" />';
    }
    return icon;
  }

  /* ------------------------------------------------------------------
     Build card DOM — front face + back face
     ------------------------------------------------------------------ */
  function buildCard(data) {
    var el = document.createElement('div');
    el.className = 'card';
    el.dataset.cardId = data.id;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', data.name + ' — click to flip open');

    el.innerHTML =
      '<div class="card__inner">' +

        /* ── FRONT FACE (white / dark-mode card) ───────────────── */
        '<div class="card__face">' +
          '<div class="card__corner card__corner--tl" aria-hidden="true">' +
            '<span class="card__corner-icon">' + renderIcon(data.icon, 'card__corner-icon') + '</span>' +
          '</div>' +
          '<div class="card__cat card__cat--left"  aria-hidden="true">' + data.category + '</div>' +
          '<div class="card__center">' +
            '<span class="card__icon" aria-hidden="true">' + renderIcon(data.icon, 'card__icon') + '</span>' +
            '<span class="card__title">' + data.name + '</span>' +
          '</div>' +
          '<div class="card__cat card__cat--right" aria-hidden="true">' + data.category + '</div>' +
          '<div class="card__corner card__corner--br" aria-hidden="true">' +
            '<span class="card__corner-icon">' + renderIcon(data.icon, 'card__corner-icon') + '</span>' +
          '</div>' +
        '</div>' +

        /* ── BACK FACE (pre-rotated 180°, shows on flip) ───────── */
        '<div class="card__back-face">' +
          '<button class="card__back-close" aria-label="Close ' + data.name + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">' +
              '<path d="M18 6 6 18M6 6l12 12"/>' +
            '</svg>' +
          '</button>' +
          '<div class="card__back-header">' +
            '<span class="card__back-emoji" aria-hidden="true">' + renderIcon(data.icon, 'card__back-emoji') + '</span>' +
            '<span class="card__back-cat">' + data.category + '</span>' +
          '</div>' +
          '<h2 class="card__back-name">' + data.name + '</h2>' +
          '<img class="card__back-img" src="' + data.img + '" alt="' + data.name + ' preview" loading="lazy" />' +
          '<p class="card__back-desc">' + data.desc + '</p>' +
          '<a class="card__back-btn" href="' + data.link + '" target="_blank" rel="noopener noreferrer">' +
            data.linkLabel + ' →' +
          '</a>' +
        '</div>' +

      '</div>';

    return el;
  }

  /* ------------------------------------------------------------------
     Deck entrance — phase 1: stack, phase 2: fan
     Cards drop in one-by-one to a centre stack, then spread to the fan.
     ------------------------------------------------------------------ */
  function runDeckEntrance() {
    var baseX = window.innerWidth  / 2 - CARD_W / 2;
    var baseY = window.innerHeight / 2 - CARD_H / 2;

    /* ── Setup: all cards hidden, centred, slightly above ── */
    cardEls.forEach(function (card, i) {
      var inner = card.querySelector('.card__inner');
      card.style.transition  = 'none';
      card.style.opacity     = '0';
      card.style.left        = baseX + 'px';
      card.style.top         = baseY + 'px';
      card.style.zIndex      = DECK_T[i].z;
      inner.style.transition = 'none';
      inner.style.transform  = tf(0, -22, 0, 0.88, 0);
    });

    /* ── Phase 1: each card drops into the stack ── */
    var STACK_STAGGER = 55;   // ms between each card appearing
    var STACK_DUR     = 260;  // ms for drop animation

    cardEls.forEach(function (card, i) {
      var inner = card.querySelector('.card__inner');
      setTimeout(function () {
        card.style.transition  = 'opacity 220ms ease';
        inner.style.transition = 'transform ' + STACK_DUR + 'ms ' + EASE;
        card.style.opacity     = '1';
        inner.style.transform  = tf(0, 0, 0, 1, 0);
      }, 100 + i * STACK_STAGGER);
    });

    /* ── Phase 2: fan out from the stack ── */
    // Starts after the last card has finished landing + a beat pause
    var fanStart    = 100 + (cardEls.length - 1) * STACK_STAGGER + STACK_DUR + 150;
    var FAN_STAGGER = 48;
    var FAN_DUR     = 400;

    cardEls.forEach(function (card, i) {
      var t     = DECK_T[i];
      var inner = card.querySelector('.card__inner');
      setTimeout(function () {
        // Move card element to its fan position (tx/ty in left/top)
        card.style.transition  = 'left ' + FAN_DUR + 'ms ' + EASE +
                                 ', top '  + FAN_DUR + 'ms ' + EASE;
        card.style.left  = (baseX + t.tx) + 'px';
        card.style.top   = (baseY + t.ty) + 'px';
        // Rotate inner to fan tilt
        inner.style.transition = 'transform ' + FAN_DUR + 'ms ' + EASE;
        inner.style.transform  = tf(0, 0, t.rot, 1, 0);
      }, fanStart + i * FAN_STAGGER);
    });
  }

  /* ------------------------------------------------------------------
     Set deck layout (instant or animated collect)
     animate=false → instant snap (e.g. after resize)
     animate=true  → staggered collect from spread
     ------------------------------------------------------------------ */
  function setDeckMode(animate) {
    state = 'deck';
    var baseX = window.innerWidth  / 2 - CARD_W / 2;
    var baseY = window.innerHeight / 2 - CARD_H / 2;

    var DUR     = animate ? 400 : 0;
    var STAGGER = animate ? 55  : 0;

    cardEls.forEach(function (card, i) {
      var t     = DECK_T[i];
      var inner = card.querySelector('.card__inner');
      setTimeout(function () {
        card.style.transition  = DUR ? 'left ' + DUR + 'ms ' + EASE + ', top ' + DUR + 'ms ' + EASE : 'none';
        inner.style.transition = DUR ? 'transform ' + DUR + 'ms ' + EASE : 'none';
        card.style.left   = (baseX + t.tx) + 'px';
        card.style.top    = (baseY + t.ty) + 'px';
        card.style.zIndex = t.z;
        inner.style.transform = tf(0, 0, t.rot, 1, 0);
        card.classList.remove('card--active');
      }, i * STAGGER);
    });

    refreshSpreadBtn();
  }

  /* ------------------------------------------------------------------
     Set spread layout — deal cards one by one to the grid
     ------------------------------------------------------------------ */
  function setSpreadMode() {
    state = 'spread';

    var vw    = window.innerWidth;
    var vh    = window.innerHeight;
    var cols  = vw < 700 ? 2 : 3;
    var gapX  = 24;
    var gapY  = 28;
    var gridW = cols * CARD_W + (cols - 1) * gapX;
    var rows  = Math.ceil(CARDS.length / cols);
    var gridH = rows * CARD_H + (rows - 1) * gapY;
    var sx    = (vw - gridW) / 2;
    var sy    = Math.max(60, (vh - gridH) / 2);

    var DEAL_DUR     = 420;
    var DEAL_STAGGER = 70;  // ms between each card being "dealt"

    cardEls.forEach(function (card, i) {
      var col   = i % cols;
      var row   = Math.floor(i / cols);
      var inner = card.querySelector('.card__inner');

      setTimeout(function () {
        card.style.transition  = 'left ' + DEAL_DUR + 'ms ' + EASE +
                                 ', top '  + DEAL_DUR + 'ms ' + EASE;
        inner.style.transition = 'transform ' + DEAL_DUR + 'ms ' + EASE;
        card.style.left        = (sx + col * (CARD_W + gapX)) + 'px';
        card.style.top         = (sy + row * (CARD_H + gapY)) + 'px';
        card.style.zIndex      = 1;
        inner.style.transform  = tf(0, 0, 0, 1, 0);
        card.classList.remove('card--active');
      }, i * DEAL_STAGGER);
    });

    refreshSpreadBtn();
  }

  /* ------------------------------------------------------------------
     Enlarge a card — fly to viewport centre and flip 180°
     ------------------------------------------------------------------ */
  function enlargeCard(card) {
    if (activeCard) collapseCard(false);

    activeCard = card;
    card.classList.add('card--active');
    card.style.zIndex = 100;

    var vw = window.innerWidth;
    var vh = window.innerHeight;

    var S = Math.min(
      (vh * 0.65) / CARD_H,
      (vw * 0.46) / CARD_W,
      2.4
    );

    /*
     * card element's left/top holds the actual screen position.
     * dx/dy = distance from card centre to viewport centre.
     *
     * Deck card (left = baseX + tx):
     *   cx = baseX + tx + CARD_W/2 = vw/2 + tx   →  dx = -tx
     *
     * Spread card (left = gridX):
     *   dx = vw/2 - (gridX + CARD_W/2)
     */
    var dx = vw / 2 - (parseFloat(card.style.left) + CARD_W / 2);
    var dy = vh / 2 - (parseFloat(card.style.top)  + CARD_H / 2);

    var inner = card.querySelector('.card__inner');
    inner.style.transition = 'transform 680ms ' + EASE;
    inner.style.transform  = tf(dx, dy, 0, S, 180);

    var bd = document.getElementById('card-backdrop');
    if (bd) bd.classList.add('card-backdrop--visible');
  }

  /* ------------------------------------------------------------------
     Collapse — flip back and return to deck/spread position
     ------------------------------------------------------------------ */
  function collapseCard(animate) {
    if (!activeCard) return;
    var card = activeCard;
    var i    = cardEls.indexOf(card);
    activeCard = null;

    card.classList.remove('card--active');

    var inner = card.querySelector('.card__inner');
    var dur   = (animate === false) ? 0 : 500;
    inner.style.transition = dur ? 'transform ' + dur + 'ms ' + EASE : 'none';

    if (state === 'deck') {
      var t = DECK_T[i];
      inner.style.transform = tf(0, 0, t.rot, 1, 0);
      card.style.zIndex = t.z;
    } else {
      inner.style.transform = tf(0, 0, 0, 1, 0);
      card.style.zIndex = 1;
    }

    var bd = document.getElementById('card-backdrop');
    if (bd) bd.classList.remove('card-backdrop--visible');
  }

  /* ------------------------------------------------------------------
     Spread button label
     ------------------------------------------------------------------ */
  var SVG_SPREAD =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<rect x="3" y="3" width="7" height="7" rx="1"/>' +
    '<rect x="14" y="3" width="7" height="7" rx="1"/>' +
    '<rect x="3" y="14" width="7" height="7" rx="1"/>' +
    '<rect x="14" y="14" width="7" height="7" rx="1"/>' +
    '</svg>';

  var SVG_COLLAPSE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M8 3H5a2 2 0 0 0-2 2v3"/>' +
    '<path d="M21 8V5a2 2 0 0 0-2-2h-3"/>' +
    '<path d="M3 16v3a2 2 0 0 0 2 2h3"/>' +
    '<path d="M16 21h3a2 2 0 0 0 2-2v-3"/>' +
    '</svg>';

  function refreshSpreadBtn() {
    var btn = document.getElementById('spread-btn');
    if (!btn) return;
    if (state === 'spread') {
      btn.innerHTML = SVG_COLLAPSE + 'Collapse';
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.innerHTML = SVG_SPREAD + 'Spread All';
      btn.setAttribute('aria-pressed', 'false');
    }
  }

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {
    window.ThemeManager.init('theme-btn');
    window.ThemeManager.updateIcons();

    var canvas = document.getElementById('projects-canvas');
    if (!canvas) return;

    /* Build cards and wire events */
    CARDS.forEach(function (data) {
      var card     = buildCard(data);
      var closeBtn = card.querySelector('.card__back-close');

      card.addEventListener('click', function () {
        if (card.classList.contains('card--active')) return;
        enlargeCard(card);
      });

      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (card.classList.contains('card--active')) return;
          enlargeCard(card);
        }
      });

      if (closeBtn) {
        closeBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          collapseCard(true);
        });
      }

      canvas.appendChild(card);
      cardEls.push(card);
    });

    /* Run entrance animation: stack → fan */
    runDeckEntrance();
    refreshSpreadBtn();

    /* Spread / Collapse toggle */
    var spreadBtn = document.getElementById('spread-btn');
    if (spreadBtn) {
      spreadBtn.addEventListener('click', function () {
        if (activeCard) collapseCard(false);
        if (state === 'deck') {
          setSpreadMode();
        } else {
          setDeckMode(true);
        }
      });
    }

    /* Backdrop click → collapse */
    var backdrop = document.getElementById('card-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function () {
        collapseCard(true);
      });
    }

    /* Escape → collapse */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') collapseCard(true);
    });

    /* Interaction hint */
    var hint = document.getElementById('interaction-hint');
    if (hint) {
      if (localStorage.getItem('projects-hint-seen')) {
        hint.style.display = 'none';
      } else {
        setTimeout(function () {
          hint.classList.add('interaction-hint--hidden');
          hint.addEventListener('transitionend', function () {
            hint.style.display = 'none';
            localStorage.setItem('projects-hint-seen', '1');
          }, { once: true });
        }, 4500);
      }
    }
  });

})();
