/* ================================================================
   MODULAR TRANSITION ENGINE — Separated & Optimized
   
   Features:
   • Modular function architecture (Single Responsibility)
   • Smooth easing interpolation
   • Optimized drag performance
   • Clean event delegation
   ================================================================ */

// ═══════════════════════════════════════════════════════════════
// CONFIG & STATE
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  TOTAL_PAGES: 3,
  ANIMATION_DURATION: 820,
  SNAP_BACK_DURATION: 520,
  DRAG_THRESHOLD: 0.22,
  DRAG_ZONE_WIDTH: 0.6,
  TOUCH_SWIPE_THRESHOLD: 55,
  REVEAL_DELAY_START: 80,
  REVEAL_DELAY_STEP: 52,
  CURSOR_EASING: 0.11,
  DRAG_OPACITY_EASING: 0.45,
  DRAG_SCALE_EASING: 0.06,
};

let state = {
  current: 0,
  animating: false,
  drag: null,
  touchStart: null,
  wheelTimeout: null,
};

// ═══════════════════════════════════════════════════════════════
// DOM ELEMENTS (CACHED)
// ═══════════════════════════════════════════════════════════════
const pages = [
  document.getElementById('p1'),
  document.getElementById('p2'),
  document.getElementById('p3')
];
const dots = document.querySelectorAll('.dot');
const scrollLine = document.getElementById('scroll-line');
const cursorEl = document.getElementById('cur');
const cursorRingEl = document.getElementById('cur-ring');
const dragZoneLeft = document.getElementById('dz-left');
const dragZoneRight = document.getElementById('dz-right');

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Clear all transition classes from a page element
 */
function clearPageClasses(el) {
  el.classList.remove('is-current', 'hidden', 'enter-from-right', 'enter-from-left', 'exit-to-back', 'animating');
}

/**
 * Get touch/mouse position from event
 */
function getClientX(e) {
  return e.touches ? e.touches[0].clientX : e.clientX;
}

/**
 * Check if page index is valid
 */
function isValidPageIndex(idx) {
  return idx >= 0 && idx < CONFIG.TOTAL_PAGES;
}

/**
 * Get direction between two pages
 */
function getDirection(from, to) {
  return to > from ? +1 : -1;
}

// ═══════════════════════════════════════════════════════════════
// TRANSITION CORE
// ═══════════════════════════════════════════════════════════════

/**
 * Main transition function with animation
 */
function transitionToPage(toIdx, direction) {
  if (state.animating || toIdx === state.current || !isValidPageIndex(toIdx)) return;
  
  state.animating = true;

  const fromPage = pages[state.current];
  const toPage = pages[toIdx];

  // Prepare pages
  prepareIncomingPage(toPage, direction);
  prepareOutgoingPage(fromPage);

  // Trigger animation
  triggerAnimation(toPage, fromPage);

  // Cleanup after animation
  setTimeout(() => finalizeTransition(toIdx), CONFIG.ANIMATION_DURATION);
}

/**
 * Prepare incoming page positioning
 */
function prepareIncomingPage(el, dir) {
  clearPageClasses(el);
  const inClass = dir > 0 ? 'enter-from-right' : 'enter-from-left';
  el.classList.add(inClass);
}

/**
 * Prepare outgoing page state
 */
function prepareOutgoingPage(el) {
  clearPageClasses(el);
  el.classList.add('exit-to-back');
}

/**
 * Trigger animation with proper reflow
 */
function triggerAnimation(toPage, fromPage) {
  toPage.getBoundingClientRect(); // Force reflow

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toPage.classList.add('animating');
      fromPage.classList.add('animating');
    });
  });
}

/**
 * Finalize transition after animation completes
 */
function finalizeTransition(toIdx) {
  const fromPage = pages[state.current];
  const toPage = pages[toIdx];

  clearPageClasses(toPage);
  toPage.classList.add('is-current');

  clearPageClasses(fromPage);
  fromPage.classList.add('hidden');

  state.current = toIdx;
  state.animating = false;

  revealPage(state.current);
  updateUI();
}

/**
 * Navigate to specific page
 */
function goToPage(pageIdx) {
  if (pageIdx === state.current || !isValidPageIndex(pageIdx)) return;
  const dir = getDirection(state.current, pageIdx);
  transitionToPage(pageIdx, dir);
}

/**
 * Navigate forward
 */
function nextPage() {
  if (!state.animating) transitionToPage(state.current + 1, +1);
}

/**
 * Navigate backward
 */
function prevPage() {
  if (!state.animating) transitionToPage(state.current - 1, -1);
}

// ═══════════════════════════════════════════════════════════════
// DRAG HANDLING
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize drag operation
 */
function startDragOperation(e, side) {
  if (state.animating) return;

  const x = getClientX(e);
  const dir = side === 'right' ? +1 : -1;
  const target = state.current + dir;

  if (!isValidPageIndex(target)) return;

  state.drag = { side, startX: x, dir, target, progress: 0 };

  document.body.style.userSelect = 'none';
  cursorEl.classList.add('small');
  cursorRingEl.classList.add('big');

  setupDragPagePositions(target, dir);
}

/**
 * Position pages for drag operation
 */
function setupDragPagePositions(targetIdx, dir) {
  const toPage = pages[targetIdx];
  const fromPage = pages[state.current];

  clearPageClasses(toPage);
  toPage.style.transition = 'none';
  toPage.style.transform = dir > 0 
    ? 'translateX(100%) scale(0.96)' 
    : 'translateX(-100%) scale(0.96)';
  toPage.style.opacity = '1';
  toPage.style.zIndex = '12';
  toPage.style.pointerEvents = 'none';

  fromPage.style.transition = 'none';
  fromPage.style.transform = 'translateX(0) scale(1)';
  fromPage.style.opacity = '1';
  fromPage.style.zIndex = '10';
}

/**
 * Update drag progress in real-time
 */
function updateDragProgress(e) {
  if (!state.drag) return;

  const x = getClientX(e);
  const dx = x - state.drag.startX;
  const W = window.innerWidth;

  // Calculate progress (0-1)
  const rawProgress = state.drag.dir > 0
    ? Math.max(0, Math.min(1, -dx / (W * CONFIG.DRAG_ZONE_WIDTH)))
    : Math.max(0, Math.min(1, dx / (W * CONFIG.DRAG_ZONE_WIDTH)));

  state.drag.progress = rawProgress;
  updateDragPageTransforms(rawProgress);
}

/**
 * Apply smooth transforms during drag
 */
function updateDragPageTransforms(progress) {
  const p = progress;
  const toPage = pages[state.drag.target];
  const fromPage = pages[state.current];

  // Incoming page: translate + scale
  const inX = state.drag.dir > 0
    ? (1 - p) * 100
    : -(1 - p) * 100;
  const inScale = 0.96 + p * 0.04;
  toPage.style.transform = `translateX(${inX}%) scale(${inScale})`;

  // Outgoing page: scale + opacity + dimmer
  const outScale = 1 - p * CONFIG.DRAG_SCALE_EASING;
  const outOpacity = 1 - p * CONFIG.DRAG_OPACITY_EASING;
  fromPage.style.transform = `translateX(0) scale(${outScale})`;
  fromPage.style.opacity = String(outOpacity);
  fromPage.querySelector('.page-dimmer').style.background = `rgba(0,0,0,${p * 0.28})`;
}

/**
 * Complete or cancel drag operation
 */
function endDragOperation(e) {
  if (!state.drag) return;

  const shouldCommit = state.drag.progress >= CONFIG.DRAG_THRESHOLD;
  
  document.body.style.userSelect = '';
  cursorEl.classList.remove('small');
  cursorRingEl.classList.remove('big');

  if (shouldCommit) {
    commitDragTransition();
  } else {
    snapBackFromDrag();
  }
}

/**
 * Commit the drag transition
 */
function commitDragTransition() {
  const toPage = pages[state.drag.target];
  const fromPage = pages[state.current];
  const target = state.drag.target;

  const transitionCSS = `transform var(--dur) var(--ease), opacity var(--dur) var(--ease)`;

  toPage.style.transition = transitionCSS;
  toPage.style.transform = 'translateX(0) scale(1)';

  fromPage.style.transition = transitionCSS;
  fromPage.style.transform = 'translateX(0) scale(0.94)';
  fromPage.style.opacity = '0.55';
  fromPage.querySelector('.page-dimmer').style.transition = transitionCSS;
  fromPage.querySelector('.page-dimmer').style.background = 'rgba(0,0,0,.28)';

  state.drag = null;
  state.animating = true;

  setTimeout(() => {
    state.current = target;
    resetPagesToFinalState();
    state.animating = false;
    revealPage(state.current);
    updateUI();
  }, CONFIG.ANIMATION_DURATION);
}

/**
 * Snap back from incomplete drag
 */
function snapBackFromDrag() {
  const toPage = pages[state.drag.target];
  const fromPage = pages[state.current];

  const transitionCSS = `transform var(--dur) var(--ease), opacity var(--dur) var(--ease)`;

  toPage.style.transition = transitionCSS;
  toPage.style.transform = state.drag.dir > 0 
    ? 'translateX(100%) scale(0.96)' 
    : 'translateX(-100%) scale(0.96)';
  toPage.style.opacity = '0';

  fromPage.style.transition = transitionCSS;
  fromPage.style.transform = 'translateX(0) scale(1)';
  fromPage.style.opacity = '1';
  fromPage.querySelector('.page-dimmer').style.transition = 'background 0.4s';
  fromPage.querySelector('.page-dimmer').style.background = 'rgba(0,0,0,0)';

  state.drag = null;

  setTimeout(() => {
    resetPagesToFinalState();
  }, CONFIG.SNAP_BACK_DURATION);
}

/**
 * Reset all pages to their final state
 */
function resetPagesToFinalState() {
  pages.forEach((p, i) => {
    p.removeAttribute('style');
    clearPageClasses(p);
    p.classList.add(i === state.current ? 'is-current' : 'hidden');
    p.querySelector('.page-dimmer').style.background = '';
    p.querySelector('.page-dimmer').style.transition = '';
  });
}

// ═══════════════════════════════════════════════════════════════
// UI UPDATES (Modular)
// ═══════════════════════════════════════════════════════════════

/**
 * Main UI update orchestrator
 */
function updateUI() {
  updateProgressDots();
  updateScrollLine();
  updateArrows();
  updateDragZones();
}

/**
 * Update progress dots styling based on current page
 */
function updateProgressDots() {
  const isDarkPage = state.current === 2;

  dots.forEach((d, i) => {
    d.classList.toggle('active', i === state.current);

    if (isDarkPage) {
      d.style.background = i === state.current 
        ? 'rgba(0,0,0,.65)' 
        : 'rgba(0,0,0,.18)';
    } else {
      d.style.background = i === state.current 
        ? 'rgba(255,255,255,.9)' 
        : 'rgba(255,255,255,.28)';
    }
  });
}

/**
 * Update scroll line position and color
 */
function updateScrollLine() {
  const isDarkPage = state.current === 2;
  const progress = (state.current / (CONFIG.TOTAL_PAGES - 1)) * 100;

  scrollLine.style.width = progress + '%';
  scrollLine.style.background = isDarkPage 
    ? 'rgba(0,0,0,.28)' 
    : 'rgba(255,255,255,.4)';
}

/**
 * Update arrow pills styling and position
 */
function updateArrows() {
  const isDarkPage = state.current === 2;
  const strokeColor = isDarkPage ? 'rgba(0,0,0,.5)' : 'white';
  const bgColor = isDarkPage ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.09)';
  const borderColor = isDarkPage ? 'rgba(0,0,0,.11)' : 'rgba(255,255,255,.15)';

  document.querySelector('#ap-left svg').style.stroke = strokeColor;
  document.querySelector('#ap-right svg').style.stroke = strokeColor;

  document.querySelectorAll('.arrow-pill').forEach(pill => {
    pill.style.background = bgColor;
    pill.style.borderColor = borderColor;
  });
}

/**
 * Update drag zone visibility
 */
function updateDragZones() {
  const isFirstPage = state.current === 0;
  const isLastPage = state.current === CONFIG.TOTAL_PAGES - 1;

  dragZoneLeft.style.opacity = isFirstPage ? '0' : '1';
  dragZoneLeft.style.pointerEvents = isFirstPage ? 'none' : 'auto';

  dragZoneRight.style.opacity = isLastPage ? '0' : '1';
  dragZoneRight.style.pointerEvents = isLastPage ? 'none' : 'auto';
}

// ═══════════════════════════════════════════════════════════════
// REVEAL ANIMATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Reveal content elements with staggered animation
 */
function revealPage(pageIdx) {
  const revealElements = pages[pageIdx].querySelectorAll('.reveal');

  revealElements.forEach((el, i) => {
    el.classList.remove('shown');

    const delay = CONFIG.REVEAL_DELAY_START + i * CONFIG.REVEAL_DELAY_STEP;
    setTimeout(() => {
      el.classList.add('shown');
    }, delay);
  });
}

// ═══════════════════════════════════════════════════════════════
// CURSOR TRACKING (Smooth Easing)
// ═══════════════════════════════════════════════════════════════

let cursorState = { mx: 0, my: 0, rx: 0, ry: 0 };

/**
 * Track mouse movement for custom cursor
 */
function trackMouseMove(e) {
  cursorState.mx = e.clientX;
  cursorState.my = e.clientY;
  cursorEl.style.left = cursorState.mx + 'px';
  cursorEl.style.top = cursorState.my + 'px';
}

/**
 * Smooth cursor ring animation loop with easing
 */
function animateCursorRing() {
  cursorState.rx += (cursorState.mx - cursorState.rx) * CONFIG.CURSOR_EASING;
  cursorState.ry += (cursorState.my - cursorState.ry) * CONFIG.CURSOR_EASING;
  
  cursorRingEl.style.left = cursorState.rx + 'px';
  cursorRingEl.style.top = cursorState.ry + 'px';
  
  requestAnimationFrame(animateCursorRing);
}

/**
 * Hide custom cursor on touch devices
 */
function hideCursorOnTouchDevices() {
  if ('ontouchstart' in window) {
    cursorEl.style.display = 'none';
    cursorRingEl.style.display = 'none';
    document.body.style.cursor = 'default';
  }
}

// ═══════════════════════════════════════════════════════════════
// EVENT LISTENERS (Organized)
// ═══════════════════════════════════════════════════════════════

/**
 * Setup drag zone listeners
 */
function setupDragZoneListeners() {
  [
    { element: dragZoneLeft, side: 'left' },
    { element: dragZoneRight, side: 'right' }
  ].forEach(({ element, side }) => {
    element.addEventListener('mousedown', (e) => startDragOperation(e, side));
    element.addEventListener('touchstart', (e) => startDragOperation(e, side), { passive: true });
    element.addEventListener('click', () => {
      if (!state.drag && !state.animating) {
        side === 'right' ? nextPage() : prevPage();
      }
    });
  });
}

/**
 * Setup document drag listeners
 */
function setupDragListeners() {
  document.addEventListener('mousemove', updateDragProgress);
  document.addEventListener('touchmove', updateDragProgress, { passive: true });
  document.addEventListener('mouseup', endDragOperation);
  document.addEventListener('touchend', endDragOperation);
}

/**
 * Setup touch swipe listeners
 */
function setupTouchSwipeListeners() {
  document.addEventListener('touchstart', (e) => {
    if (!state.animating) {
      state.touchStart = e.touches[0].clientX;
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (state.drag || state.touchStart === null) return;

    const dx = e.changedTouches[0].clientX - state.touchStart;
    state.touchStart = null;

    if (Math.abs(dx) > CONFIG.TOUCH_SWIPE_THRESHOLD) {
      dx < 0 ? nextPage() : prevPage();
    }
  });
}

/**
 * Setup keyboard navigation
 */
function setupKeyboardListeners() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextPage();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevPage();
  });
}

/**
 * Setup mouse wheel navigation
 */
function setupWheelListeners() {
  document.addEventListener('wheel', (e) => {
    if (state.wheelTimeout || state.animating) return;

    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

    if (delta > 35) {
      nextPage();
    } else if (delta < -35) {
      prevPage();
    }

    state.wheelTimeout = setTimeout(() => {
      state.wheelTimeout = null;
    }, 700);
  });
}

/**
 * Setup dot navigation
 */
function setupDotListeners() {
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      if (i !== state.current) goToPage(i);
    });
  });
}

/**
 * Setup cursor tracking
 */
function setupCursorTracking() {
  document.addEventListener('mousemove', trackMouseMove);
  animateCursorRing();
  hideCursorOnTouchDevices();
}

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
  setupDragZoneListeners();
  setupDragListeners();
  setupTouchSwipeListeners();
  setupKeyboardListeners();
  setupWheelListeners();
  setupDotListeners();
  setupCursorTracking();
}

// ═══════════════════════════════════════════════════════════════
// CONTENT LOADER
// ═══════════════════════════════════════════════════════════════

/**
 * Load page content from separate HTML files
 */
async function loadPageContent(pageIdx) {
  const pageFile = `pages/page${pageIdx + 1}.html`;
  
  try {
    const response = await fetch(pageFile);
    if (!response.ok) throw new Error(`Failed to load ${pageFile}`);
    
    const html = await response.text();
    pages[pageIdx].innerHTML = html;
  } catch (error) {
    console.error(`Error loading ${pageFile}:`, error);
    pages[pageIdx].innerHTML = `<div class="page-content"><p>Error loading page content</p></div>`;
  }
}

/**
 * Load all page contents
 */
async function loadAllPages() {
  const loadPromises = pages.map((_, idx) => loadPageContent(idx));
  await Promise.all(loadPromises);
}

// ═══════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════

async function initialize() {
  await loadAllPages();
  initializeEventListeners();
  updateUI();
  setTimeout(() => revealPage(0), 100);
}

// Start the app
initialize();
