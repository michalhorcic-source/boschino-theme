console.log('custom.js loaded');

/* ===============================
   1) Desktop šipky pro collection-list
   =============================== */
(function () {
  function initCollectionCarouselArrows() {
    if (!window.matchMedia('(min-width: 990px)').matches) return;

    document.querySelectorAll('.collection-list').forEach((section) => {
      const scroller = section.querySelector('.grid');
      if (!scroller) return;

      if (section.classList.contains('gm-cc-wrap')) return;
      section.classList.add('gm-cc-wrap');

      const prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'gm-cc-btn prev';
      prev.setAttribute('aria-label', 'Předchozí');
      prev.textContent = '‹';

      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'gm-cc-btn next';
      next.setAttribute('aria-label', 'Další');
      next.textContent = '›';

      section.appendChild(prev);
      section.appendChild(next);

      function step() {
        const first = scroller.querySelector('.grid__item, .collection-list__item');
        if (!first) return 320;
        const rect = first.getBoundingClientRect();
        return Math.max(280, Math.round(rect.width + 20));
      }

      function update() {
        const maxScroll = scroller.scrollWidth - scroller.clientWidth;
        const x = scroller.scrollLeft;

        const noOverflow = maxScroll <= 2;
        prev.style.display = noOverflow ? 'none' : '';
        next.style.display = noOverflow ? 'none' : '';

        prev.disabled = x <= 2;
        next.disabled = x >= maxScroll - 2;
      }

      prev.addEventListener('click', () => scroller.scrollBy({ left: -step(), behavior: 'smooth' }));
      next.addEventListener('click', () => scroller.scrollBy({ left: step(), behavior: 'smooth' }));

      scroller.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update, { passive: true });
      update();
    });
  }

  document.addEventListener('DOMContentLoaded', initCollectionCarouselArrows);
  document.addEventListener('shopify:section:load', initCollectionCarouselArrows);
  window.addEventListener('resize', initCollectionCarouselArrows, { passive: true });
})();

/* ===============================
   2) Infinite autoscroll pro .boschino-subcats
   - NEOBALUJE děti (nerozbije CSS)
   - klonuje položky přímo (A + A)
   - plynule dokola, ručně ovladatelné
   =============================== */
(function () {
  function unwrapIfNeeded(strip) {
    // pokud tam z minula zůstal wrapper .boschino-subcats__track, odbalíme ho
    const track = strip.querySelector(':scope > .boschino-subcats__track');
    if (!track) return;

    const originals = Array.from(track.childNodes);
    strip.innerHTML = '';
    originals.forEach((n) => strip.appendChild(n));
  }

  function initOne(strip) {
    if (strip.dataset.boschinoAutoscrollInit === '1') return;
    strip.dataset.boschinoAutoscrollInit = '1';

    unwrapIfNeeded(strip);

    // původní děti (jen elementy)
    const originalItems = Array.from(strip.children);

    // když není co scrollovat, neřešíme
    if (originalItems.length < 2) return;

    // ZABRÁNÍME dvojitému klonování při reloadu
    // (pokud tam už jsou klony, smažeme je)
    originalItems.forEach((el) => {
      if (el.dataset && el.dataset.boschinoClone === '1') el.remove();
    });

    // znovu si načteme čisté originály
    const cleanOriginals = Array.from(strip.children);

    // klonujeme všechny originály jako druhou kopii (A + A)
    const frag = document.createDocumentFragment();
    cleanOriginals.forEach((el) => {
      const c = el.cloneNode(true);
      c.dataset.boschinoClone = '1';
      frag.appendChild(c);
    });
    strip.appendChild(frag);

    // důležité: nevypínat overflow ani nic co by schovalo scroll bar
    // ale scroll-snap často dělá zaseky → vypnout (jen typ)
    strip.style.setProperty('scroll-snap-type', 'none', 'important');

    // změříme šířku „jedné“ sady A (po layoutu)
    let originalWidth = 0;

    const isMobile = window.matchMedia('(max-width: 989px)').matches;
    const SPEED_PX_PER_SEC = isMobile ? 35 : 55; // rychlost v px/s
    const PAUSE_MS = 2000;

    let pausedUntil = 0;
    let rafId = null;
    let lastTs = 0;

    function pause(extra = 0) {
      pausedUntil = Date.now() + PAUSE_MS + extra;
    }

    function measure() {
      // šířka jedné sady = scrollWidth / 2 (protože máme A + A)
      const w = strip.scrollWidth / 2;
      // ochrana proti nesmyslným hodnotám
      if (w > 0) originalWidth = w;
    }

    // změřit po vykreslení
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        measure();
        // když to vyjde blbě (obrázky se dočítají), zkus ještě jednou
        setTimeout(measure, 400);
        setTimeout(measure, 1200);
      });
    });

    function loop(ts) {
      rafId = requestAnimationFrame(loop);

      if (document.hidden) return;
      if (Date.now() < pausedUntil) {
        lastTs = ts;
        return;
      }

      if (!originalWidth || originalWidth < 10) return;

      const dt = lastTs ? (ts - lastTs) / 1000 : 0;
      lastTs = ts;

      // když dt je obří (tab byl uspán), nedělej skok
      if (dt > 0.2) return;

      strip.scrollLeft += SPEED_PX_PER_SEC * dt;

      // seamless wrap: jakmile přejedeme přes jednu sadu, ubereme originalWidth
      if (strip.scrollLeft >= originalWidth) {
        strip.scrollLeft -= originalWidth;
      }
      // (kdyby někdo ručně posunul úplně doleva)
      if (strip.scrollLeft < 0) {
        strip.scrollLeft += originalWidth;
      }
    }

    function start() {
      if (rafId) return;
      lastTs = 0;
      rafId = requestAnimationFrame(loop);
    }

    function stop() {
      if (!rafId) return;
      cancelAnimationFrame(rafId);
      rafId = null;
      lastTs = 0;
    }

    // ======= USER INTERACTIONS =======
    // wheel (PC): jen pauza, ruční scroll funguje
    strip.addEventListener('wheel', () => pause(400), { passive: true });

    // myš / touch drag: pauza při gesta startu, po konci pokračovat
    strip.addEventListener(
      'pointerdown',
      () => {
        pause(800);
      },
      { passive: true }
    );

    strip.addEventListener(
      'pointerup',
      () => {
        pause(800);
      },
      { passive: true }
    );

    strip.addEventListener(
      'pointercancel',
      () => {
        pause(800);
      },
      { passive: true }
    );

    strip.addEventListener('touchstart', () => pause(800), { passive: true });
    strip.addEventListener('touchend', () => pause(800), { passive: true });
    strip.addEventListener('touchcancel', () => pause(800), { passive: true });

    // když se vrátíš do tabu, restart
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        pause(400);
        stop();
        setTimeout(start, 250);
      }
    });

    // resize / otočení: znovu změř a pokračuj
    window.addEventListener(
      'resize',
      () => {
        pause(600);
        measure();
      },
      { passive: true }
    );

    window.addEventListener('orientationchange', () => {
      pause(800);
      setTimeout(measure, 250);
    });

    console.log('[autoscroll] init', {
      isMobile,
      items: cleanOriginals.length,
      scrollWidth: strip.scrollWidth,
    });

    start();
  }

  function initAutoScroll() {
    // autoscroll jen pro carousel, nikdy pro grid (#boschinoSubcats / .boschino-subcats--grid)
    document
      .querySelectorAll('.boschino-subcats:not(.boschino-subcats--grid):not(#boschinoSubcats)')
      .forEach((strip) => initOne(strip));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoScroll);
  } else {
    initAutoScroll();
  }

  document.addEventListener('shopify:section:load', initAutoScroll);

  // Shopify někdy dopočítá layout později (obrázky) → zkusíme init znovu, ale díky datasetu se nespustí 2×
  setTimeout(initAutoScroll, 800);
  setTimeout(initAutoScroll, 2000);
})();
(function () {
  function initBoschinoSubcatsToggle(root = document) {
    const grids = Array.from(root.querySelectorAll('.boschino-subcats--grid'));
    if (!grids.length) return;

    const isDesktop = () => window.matchMedia('(min-width: 990px)').matches;

    // Kolik karet se má zobrazit ve sbaleném stavu
    // Desktop: 2 řady po 6 = 12
    // Mobile: 2 řady po 2 = 4 (uprav si dle svého gridu)
    const getCollapsedLimit = () => (isDesktop() ? 12 : 4);

    grids.forEach((grid) => {
      const sectionRoot = grid.closest('.shopify-section') || grid.parentElement || document;

      // tlačítko hledáme "u stejného gridu" (nejbližší actions blok za gridem)
      const actions = sectionRoot.querySelector('.boschino-subcats__actions');
      const btn = actions ? actions.querySelector('.boschino-subcats__btn') : null;

      if (!btn) return;

      // počet kategorií
      const items = grid.querySelectorAll(':scope > li').length;
      const limit = getCollapsedLimit();

      // když je kategorií málo → zobraz vše a skryj tlačítko
      if (items <= limit) {
        grid.dataset.collapsed = 'false';
        actions.style.display = 'none';
        return;
      }

      // jinak tlačítko necháme
      actions.style.display = '';

      // default stav
      if (!grid.dataset.collapsed) grid.dataset.collapsed = 'true';

      const setLabel = () => {
        const isCollapsed = grid.dataset.collapsed === 'true';
        btn.textContent = isCollapsed ? 'Zobrazit další kategorie' : 'Skrýt kategorie';
      };

      // prevence dvojitého bindu (per grid)
      if (btn.dataset.boundFor === grid.id) {
        setLabel();
        return;
      }
      // když grid nemá id, vytvoříme stabilní
      if (!grid.id) {
        grid.id = `boschinoSubcats-${Math.random().toString(16).slice(2)}`;
      }
      btn.dataset.boundFor = grid.id;

      setLabel();

      btn.addEventListener('click', () => {
        const isCollapsed = grid.dataset.collapsed === 'true';
        grid.dataset.collapsed = isCollapsed ? 'false' : 'true';
        setLabel();

        // při sbalení vrať pohled na začátek gridu
        if (!isCollapsed) {
          grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      // když se mění breakpoint (mobile/desktop), přepočítat “málo kategorií”
      // a případně schovat/ukázat tlačítko
      const onResize = () => {
        const newLimit = getCollapsedLimit();
        if (items <= newLimit) {
          grid.dataset.collapsed = 'false';
          actions.style.display = 'none';
        } else {
          actions.style.display = '';
          setLabel();
        }
      };

      // ať to nepřibinduješ víckrát
      if (btn.dataset.resizeBound !== '1') {
        btn.dataset.resizeBound = '1';
        window.addEventListener('resize', onResize, { passive: true });
      }
    });
  }

  // první load
  document.addEventListener('DOMContentLoaded', () => initBoschinoSubcatsToggle(document));

  // Shopify section reload (theme editor, ajax)
  document.addEventListener('shopify:section:load', (e) => initBoschinoSubcatsToggle(e.target));
})();
