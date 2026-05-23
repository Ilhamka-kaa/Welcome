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
  DRAG_OPACITY_EASING: 1.0,
  DRAG_SCALE_EASING: 0.06,
};

let state = {
  current: 0,
  animating: false,
  drag: null,
  touchStart: null,
  wheelTimeout: null,
  openingActive: true, // Block navigation during intro opening animation
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
  if (state.openingActive || state.animating || toIdx === state.current || !isValidPageIndex(toIdx)) return;

  state.animating = true;

  const fromPage = pages[state.current];
  const toPage = pages[toIdx];

  // Resume target background early
  handleBackgroundTransitionStart(state.current, toIdx);

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

  // Control background animation pause/resume states on transition completion
  handleBackgroundTransitionComplete(toIdx);
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
  if (state.openingActive || state.animating) return;

  const x = getClientX(e);
  const dir = side === 'right' ? +1 : -1;
  const target = state.current + dir;

  if (!isValidPageIndex(target)) return;

  state.drag = { side, startX: x, dir, target, progress: 0 };

  document.body.style.userSelect = 'none';
  cursorEl.classList.add('small');
  cursorRingEl.classList.add('big');

  // Resume target background early so it animates while transitioning
  handleBackgroundTransitionStart(state.current, target);

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
  fromPage.style.opacity = '0';
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

    // Control background animation pause/resume states on transition completion
    handleBackgroundTransitionComplete(target);
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

    // Since the transition was cancelled, keep current page active and pause target background
    handleBackgroundTransitionComplete(state.current);
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
      // Light page → dark dots
      d.style.background = i === state.current
        ? 'rgba(10,10,10,.7)'
        : 'rgba(10,10,10,.18)';
      d.style.borderColor = i === state.current
        ? '#0a0a0a'
        : 'rgba(10,10,10,.25)';
    } else {
      // Dark pages → yellow dots
      d.style.background = i === state.current
        ? '#ffeb3b'
        : 'rgba(255,235,59,.18)';
      d.style.borderColor = i === state.current
        ? '#ffeb3b'
        : 'rgba(255,235,59,.35)';
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
    ? 'rgba(10,10,10,.35)'
    : '#ffeb3b';
  scrollLine.style.boxShadow = isDarkPage
    ? 'none'
    : '0 0 8px rgba(255,235,59,.3)';
}

/**
 * Update arrow pills styling and position
 */
function updateArrows() {
  const isDarkPage = state.current === 2;
  const strokeColor = isDarkPage ? 'rgba(10,10,10,.5)' : 'rgba(255,235,59,.7)';
  const bgColor = isDarkPage ? 'rgba(10,10,10,.06)' : 'rgba(255,235,59,.08)';
  const borderColor = isDarkPage ? 'rgba(10,10,10,.15)' : 'rgba(255,235,59,.3)';

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
 * Helper to check if event target is currently scrollable and not at its boundary
 */
function isInsideScrollable(e) {
  let el = e.target;
  if (el && el.nodeType === 3) el = el.parentNode; // safe check for text nodes
  while (el && el !== document.body && el !== document.documentElement) {
    // Block transition if user is scrolling inside form controls
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') {
      return true;
    }

    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;

    const hasScrollableY = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
    const hasScrollableX = (overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth;

    if (hasScrollableY || hasScrollableX) {
      // If it's a nested scrollable element (not the main page-content), block transitions completely
      if (!el.classList.contains('page-content')) {
        return true;
      }

      // For the main page-content, only block if we are not at the scroll boundaries
      if (hasScrollableY && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const atTop = el.scrollTop <= 0 && e.deltaY < 0;
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1 && e.deltaY > 0;
        if (!atTop && !atBottom) {
          return true;
        }
      }
      if (hasScrollableX && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const atLeft = el.scrollLeft <= 0 && e.deltaX < 0;
        const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaX > 0;
        if (!atLeft && !atRight) {
          return true;
        }
      }
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Setup touch swipe listeners
 */
function setupTouchSwipeListeners() {
  document.addEventListener('touchstart', (e) => {
    const targetEl = e.target.nodeType === 3 ? e.target.parentNode : e.target;
    // Ignore swipes starting inside form controls or button elements (safely using closest)
    if (targetEl && typeof targetEl.closest === 'function' && targetEl.closest('input, textarea, select, button')) {
      state.touchStart = null;
      return;
    }

    // Ignore swipes starting inside nested scrollable containers (e.g. comments list)
    let el = targetEl;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.classList.contains('page-content')) {
        break;
      }
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;
      const hasScrollableY = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
      const hasScrollableX = (overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
      if (hasScrollableY || hasScrollableX) {
        state.touchStart = null;
        return;
      }
      el = el.parentElement;
    }

    if (!state.animating) {
      state.touchStart = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (state.drag || state.touchStart === null) return;

    const dx = e.changedTouches[0].clientX - state.touchStart.x;
    const dy = e.changedTouches[0].clientY - state.touchStart.y;
    state.touchStart = null;

    // Only swipe if the gesture is primarily horizontal (dx > dy) and exceeds threshold
    if (Math.abs(dx) > CONFIG.TOUCH_SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
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
    if (state.openingActive || state.wheelTimeout || state.animating) return;

    // Ignore wheel navigation if scrolling inside active scrollable containers
    if (isInsideScrollable(e)) return;

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
/**
 * Setup brand logo click listener (scroll back to home page)
 */
function setupBrandLogoListeners() {
  document.addEventListener('click', (e) => {
    const brandLogo = e.target.closest('.brand-logo');
    if (brandLogo) {
      e.preventDefault();
      goToPage(0);
    }
  });
}

function initializeEventListeners() {
  setupDragZoneListeners();
  setupDragListeners();
  setupTouchSwipeListeners();
  setupKeyboardListeners();
  setupWheelListeners();
  setupDotListeners();
  setupCursorTracking();
  setupBrandLogoListeners();
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
// GAME MODAL HANDLER
// ═══════════════════════════════════════════════════════════════

/**
 * Setup game card listeners
 */
function setupGameCardListeners() {
  // Wait for page2 content to be loaded, then setup game cards
  setTimeout(() => {
    const gameCards = document.querySelectorAll('.game-card');
    gameCards.forEach(card => {
      card.addEventListener('click', () => {
        const gameFile = card.getAttribute('data-game');
        const gameTitle = card.querySelector('.game-title').textContent;
        openGameModal(gameFile, gameTitle);
      });
    });
  }, 100);
}

/**
 * Open game modal with fullscreen game
 */
function openGameModal(gameFile, gameTitle) {
  const modal = document.getElementById('gameModal');
  const modalContent = document.getElementById('gameModalContent');
  const modalTitle = document.getElementById('gameModalTitle');

  // Update title
  modalTitle.textContent = gameTitle;

  // Clear previous content
  modalContent.innerHTML = '';

  // Create iframe for the game
  const iframe = document.createElement('iframe');
  iframe.className = 'game-modal-frame';
  iframe.src = `game/${gameFile}`;
  iframe.allow = 'fullscreen; accelerometer; gyroscope';

  modalContent.appendChild(iframe);

  // Show modal
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Hide custom cursor and show default cursor for game
  cursorEl.style.display = 'none';
  cursorRingEl.style.display = 'none';
  document.body.style.cursor = 'auto';
}

/**
 * Close game modal
 */
function closeGameModal() {
  const modal = document.getElementById('gameModal');
  modal.classList.remove('active');
  document.getElementById('gameModalContent').innerHTML = '';
  document.body.style.overflow = '';

  // Restore custom cursor
  if (!('ontouchstart' in window)) {
    cursorEl.style.display = 'block';
    cursorRingEl.style.display = 'block';
    document.body.style.cursor = 'none';
  }
}

/**
 * Setup game modal event listeners
 */
function setupGameModalListeners() {
  const closeBtn = document.getElementById('gameModalClose');
  const modal = document.getElementById('gameModal');

  // Close button
  closeBtn.addEventListener('click', closeGameModal);

  // Close on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeGameModal();
    }
  });

  // Close on modal background click (optional - only if clicking outside content)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeGameModal();
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// COMMENTS HANDLER (Page 3)
// ═══════════════════════════════════════════════════════════════

/**
 * Setup comments handling for Page 3 (Contact & Feedback)
 */
function setupCommentsHandler() {
  const form = document.getElementById('comment-form');
  const commentsList = document.getElementById('comments-list');
  const countEl = document.getElementById('comment-count');

  if (!form || !commentsList) return;

  const STORAGE_KEY = 'ihk_portfolio_comments';

  // Load comments from localStorage
  let comments = [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      comments = JSON.parse(stored);
      if (comments.length > 5) {
        comments = comments.slice(-5);
      }
    }
  } catch (e) {
    console.error('Error loading comments:', e);
  }

  // Populate with some starter default comments if empty
  if (comments.length === 0) {
    comments = [
      {
        id: 1,
        author: 'SYSTEM_BOT',
        text: 'Welcome to the comment section! Send a transmission.',
        time: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
      },
      {
        id: 2,
        author: 'ANON_DEV',
        text: 'This website is extremely brutal. Love the custom cursor and page transitions!',
        time: new Date(Date.now() - 1800000).toISOString() // 30 mins ago
      }
    ];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
    } catch (_) {}
  }

  function renderComments() {
    commentsList.innerHTML = '';
    
    // Sort comments: newest first
    const sortedComments = [...comments].sort((a, b) => new Date(b.time) - new Date(a.time));
    
    if (countEl) {
      countEl.textContent = sortedComments.length;
    }

    if (sortedComments.length === 0) {
      commentsList.innerHTML = '<div class="no-comments-msg">No transmission received. Be the first to comment.</div>';
      return;
    }

    sortedComments.forEach(comment => {
      const card = document.createElement('div');
      card.className = 'comment-card';

      const meta = document.createElement('div');
      meta.className = 'comment-meta';

      const author = document.createElement('span');
      author.className = 'comment-author-name';
      author.textContent = comment.author;

      const time = document.createElement('span');
      time.className = 'comment-time';
      time.textContent = formatCommentTime(comment.time);

      meta.appendChild(author);
      meta.appendChild(time);

      const body = document.createElement('div');
      body.className = 'comment-body';
      body.textContent = comment.text;

      card.appendChild(meta);
      card.appendChild(body);
      commentsList.appendChild(card);
    });
  }

  function formatCommentTime(isoString) {
    try {
      const date = new Date(isoString);
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${hours}:${mins} | ${date.getDate()} ${months[date.getMonth()]}`;
    } catch (e) {
      return 'JUST NOW';
    }
  }

  // Handle Form Submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const authorInput = document.getElementById('comment-author');
    const textInput = document.getElementById('comment-text');

    if (!authorInput || !textInput) return;

    const newComment = {
      id: Date.now(),
      author: authorInput.value.trim() || 'ANONYMOUS',
      text: textInput.value.trim(),
      time: new Date().toISOString()
    };

    comments.push(newComment);
    
    // Keep only the latest 5 comments
    if (comments.length > 5) {
      comments = comments.slice(-5);
    }
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }

    renderComments();

    // Reset inputs
    authorInput.value = '';
    textInput.value = '';

    // Submit effect on the button
    const btn = form.querySelector('.comment-submit-btn span');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '[ SENT SUCCESSFUL ]';
      btn.style.color = '#76ff03'; // neon green
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.color = '';
      }, 1500);
    }
  });

  renderComments();
}

// ═══════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// WEBSITE OPENING SCREEN TRANSITION
// ═══════════════════════════════════════════════════════════════

function initOpeningAnimation() {
  const overlay = document.getElementById('opening-overlay');
  if (!overlay) return;
  const welcomeContainer = document.getElementById('welcome-container');
  const canvas = document.getElementById('intro-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let openingState = 'welcome';
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  const gridCols = 16;
  const gridRows = 10;
  let cellW = width / gridCols;
  let cellH = height / gridRows;

  const revealed = Array(gridCols).fill().map(() => Array(gridRows).fill(false));

  const handleResize = () => {
    if (openingState === 'done') return;
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    cellW = width / gridCols;
    cellH = height / gridRows;
  };
  window.addEventListener('resize', handleResize);

  const tetrominoes = [
    { shape: [[1]], color: '#00E5FF' }, // Cyan
    { shape: [[1]], color: '#FFA726' }, // Gold
    { shape: [[1]], color: '#FF3333' }, // Red
    { shape: [[1]], color: '#4CAF50' }, // Green
    { shape: [[1]], color: '#E91E63' }, // Pink
    { shape: [[1]], color: '#FF5722' }, // Orange
    { shape: [[1]], color: '#9C27B0' }  // Purple
  ];

  const fallingBlocks = [];
  const particles = [];
  let availableCols = [];
  let cascadeInterval = null;
  let animationFrameId = null;

  class Block {
    constructor(tetromino, col) {
      this.shape = tetromino.shape;
      this.color = tetromino.color;
      this.col = col;
      this.width = this.shape[0].length;
      this.height = this.shape.length;
      this.y = -this.height * cellH;
      this.speed = Math.random() * 3 + 6;
      this.landed = false;
      
      this.nodes = [];
      for (let r = 0; r < this.height; r++) {
        for (let c = 0; c < this.width; c++) {
          if (this.shape[r][c]) {
            const cellX = c * cellW;
            const cellY = r * cellH;
            for (let i = 0; i < 3; i++) {
              this.nodes.push({
                c: c,
                r: r,
                rx: cellX + Math.random() * cellW,
                ry: cellY + Math.random() * cellH,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4
              });
            }
          }
        }
      }
    }

    update() {
      if (this.landed) return;

      const oldStartRow = Math.floor(this.y / cellH);
      this.y += this.speed;
      const newStartRow = Math.floor(this.y / cellH);

      for (let startRow = Math.max(0, oldStartRow); startRow <= newStartRow; startRow++) {
        for (let r = 0; r < this.height; r++) {
          for (let c = 0; c < this.width; c++) {
            if (this.shape[r][c]) {
              const gridCol = this.col + c;
              const gridRow = startRow + r;
              if (gridCol >= 0 && gridCol < gridCols && gridRow >= 0 && gridRow < gridRows) {
                revealed[gridCol][gridRow] = true;
              }
            }
          }
        }
      }

      this.nodes.forEach(node => {
        node.rx += node.vx;
        node.ry += node.vy;
        const cellX = node.c * cellW;
        const cellY = node.r * cellH;
        if (node.rx < cellX || node.rx > cellX + cellW) node.vx *= -1;
        if (node.ry < cellY || node.ry > cellY + cellH) node.vy *= -1;
      });

      if (this.y + this.height * cellH >= height) {
        this.y = height - this.height * cellH;
        this.landed = true;
        this.onLand();
      }
    }

    onLand() {
      const currentX = this.col * cellW;
      for (let i = 0; i < 12; i++) {
        particles.push(new Particle(
          currentX + Math.random() * (this.width * cellW),
          this.y + (this.height * cellH) - Math.random() * 5,
          this.color
        ));
      }

      const finalRow = Math.floor(this.y / cellH);
      for (let r = 0; r < this.height; r++) {
        for (let c = 0; c < this.width; c++) {
          const gridCol = this.col + c;
          const gridRow = finalRow + r;
          if (gridCol >= 0 && gridCol < gridCols && gridRow >= 0 && gridRow < gridRows) {
            if (this.shape[r][c]) {
              revealed[gridCol][gridRow] = true;
            }
          }
        }
      }
    }

    draw() {
      ctx.save();
      const currentX = this.col * cellW;

      for (let r = 0; r < this.height; r++) {
        for (let c = 0; c < this.width; c++) {
          if (this.shape[r][c]) {
            const cx = currentX + c * cellW;
            const cy = this.y + r * cellH;

            ctx.fillStyle = 'rgba(12, 12, 16, 0.9)';
            ctx.fillRect(cx, cy, cellW, cellH);

            ctx.save();
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1;
            ctx.strokeRect(cx, cy, cellW, cellH);
            ctx.restore();
          }
        }
      }

      ctx.save();
      ctx.translate(currentX, this.y);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 0.5;
      
      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const n1 = this.nodes[i];
          const n2 = this.nodes[j];
          const dx = n1.rx - n2.rx;
          const dy = n1.ry - n2.ry;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < cellW * 1.3) {
            ctx.strokeStyle = `rgba(${hexToRgb(this.color)}, ${0.25 * (1 - dist / (cellW * 1.3))})`;
            ctx.beginPath();
            ctx.moveTo(n1.rx, n1.ry);
            ctx.lineTo(n2.rx, n2.ry);
            ctx.stroke();
          }
        }
      }

      this.nodes.forEach(node => {
        ctx.fillStyle = this.color;
        ctx.fillRect(node.rx - 1, node.ry - 1, 2, 2);
      });
      ctx.restore();
      ctx.restore();
    }
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
  }

  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 8;
      this.vy = (Math.random() - 1.5) * 6;
      this.length = Math.random() * 8 + 4;
      this.color = color;
      this.alpha = 1;
      this.gravity = 0.15;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      this.alpha -= 0.03;
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const dx = (this.vx / speed) * this.length;
      const dy = (this.vy / speed) * this.length;
      
      ctx.beginPath();
      ctx.moveTo(this.x - dx, this.y - dy);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  function startCascade() {
    cascadeInterval = setInterval(() => {
      if (openingState !== 'cascade') return;

      if (availableCols.length > 0) {
        const randIdx = Math.floor(Math.random() * availableCols.length);
        const col = availableCols.splice(randIdx, 1)[0];
        
        const tet = tetrominoes[Math.floor(Math.random() * tetrominoes.length)];
        fallingBlocks.push(new Block(tet, col));
      }

      if (availableCols.length === 0 && fallingBlocks.length === 0) {
        openingState = 'wipe';
        clearInterval(cascadeInterval);
        setTimeout(completeTransition, 400);
      }
    }, 160);
  }

  function completeTransition() {
    openingState = 'done';
    state.openingActive = false; // Allow page navigation now that intro is done
    document.body.classList.remove('opening-active');
    overlay.style.opacity = '0';
    
    setTimeout(() => {
      overlay.remove();
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      
      if (!('ontouchstart' in window)) {
        const cursorEl = document.getElementById('cur');
        const cursorRingEl = document.getElementById('cur-ring');
        if (cursorEl) cursorEl.style.display = 'block';
        if (cursorRingEl) cursorRingEl.style.display = 'block';
        document.body.style.cursor = 'none';
      }

      revealPage(0);
    }, 800);
  }

  function triggerStart() {
    if (openingState !== 'welcome') return;

    document.body.classList.remove('opening-welcome');

    welcomeContainer.style.opacity = '0';
    welcomeContainer.style.transform = 'translate(-50%, -50%) scale(0.95)';

    availableCols = Array.from({ length: gridCols }, (_, i) => i);
    openingState = 'cascade';
    startCascade();
  }

  let progress = 0;
  const loaderText = document.getElementById('loader-text');
  const progressFill = document.getElementById('progress-fill');
  const welcomeTextEl = document.getElementById('welcome-text');
  const cubeInner = document.getElementById('cube-inner');
  const cubeCore = document.getElementById('cube-core');

  function updateLoader() {
    if (progress < 100) {
      progress += Math.random() * 1.1 + 0.45;
      if (progress > 100) progress = 100;
      
      if (loaderText) loaderText.textContent = String(Math.floor(progress)).padStart(2, '0') + '%';
      if (progressFill) progressFill.style.width = progress + '%';

      if (cubeInner && cubeCore) {
        const glowVal = 0.15 + (progress / 100) * 0.75;
        cubeInner.style.setProperty('--inner-glow', glowVal);
        cubeCore.style.setProperty('--inner-glow', glowVal);
      }
      
      requestAnimationFrame(updateLoader);
    } else {
      if (progressFill) progressFill.style.width = '100%';
      if (loaderText) loaderText.textContent = '100%';

      if (cubeInner && cubeCore) {
        cubeInner.style.setProperty('--inner-glow', '0.9');
        cubeCore.style.setProperty('--inner-glow', '0.9');
      }
      
      if (welcomeTextEl) welcomeTextEl.classList.add('active');
      
      setTimeout(() => {
        triggerStart();
      }, 850);
    }
  }

  setTimeout(updateLoader, 200);

  const handleSkip = () => {
    if (progress < 100) {
      progress = 100;
    }
  };

  const handleKeyDown = (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      handleSkip();
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  overlay.addEventListener('click', handleSkip);

  function animate() {
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.fillStyle = '#0A0A0C';
    for (let c = 0; c < gridCols; c++) {
      for (let r = 0; r < gridRows; r++) {
        if (!revealed[c][r]) {
          const x = c * cellW;
          const y = r * cellH;
          ctx.fillRect(x - 0.5, y - 0.5, cellW + 1, cellH + 1);
        }
      }
    }

    ctx.shadowColor = 'rgba(255, 167, 38, 0.5)';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 1.5;
    
    for (let c = 0; c < gridCols; c++) {
      for (let r = 0; r < gridRows; r++) {
        if (!revealed[c][r]) {
          const x = c * cellW;
          const y = r * cellH;

          if (c > 0 && revealed[c - 1][r]) {
            ctx.strokeStyle = '#FFA726';
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cellH); ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)';
            ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 2, y + cellH); ctx.stroke();
          }
          if (c < gridCols - 1 && revealed[c + 1][r]) {
            ctx.strokeStyle = '#FFA726';
            ctx.beginPath(); ctx.moveTo(x + cellW, y); ctx.lineTo(x + cellW, y + cellH); ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)';
            ctx.beginPath(); ctx.moveTo(x + cellW - 2, y); ctx.lineTo(x + cellW - 2, y + cellH); ctx.stroke();
          }
          if (r > 0 && revealed[c][r - 1]) {
            ctx.strokeStyle = '#FFA726';
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cellW, y); ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)';
            ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + cellW, y + 2); ctx.stroke();
          }
          if (r < gridRows - 1 && revealed[c][r + 1]) {
            ctx.strokeStyle = '#FFA726';
            ctx.beginPath(); ctx.moveTo(x, y + cellH); ctx.lineTo(x + cellW, y + cellH); ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)';
            ctx.beginPath(); ctx.moveTo(x, y + cellH - 2); ctx.lineTo(x + cellW, y + cellH - 2); ctx.stroke();
          }
        }
      }
    }
    ctx.restore();

    if (openingState === 'cascade' || openingState === 'wipe') {
      for (let i = fallingBlocks.length - 1; i >= 0; i--) {
        const block = fallingBlocks[i];
        block.update();
        block.draw();
        if (block.landed) {
          fallingBlocks.splice(i, 1);
        }
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update();
      p.draw();
      if (p.alpha <= 0) {
        particles.splice(i, 1);
      }
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  animate();
}

async function initialize() {
  const cursorEl = document.getElementById('cur');
  const cursorRingEl = document.getElementById('cur-ring');
  if (cursorEl) cursorEl.style.display = 'none';
  if (cursorRingEl) cursorRingEl.style.display = 'none';
  document.body.style.cursor = 'default';

  await loadAllPages();
  initializeEventListeners();
  setupGameModalListeners();
  setupGameCardListeners();
  setupCommentsHandler();
  setupBackgroundBridge();
  updateUI();

  // Pause/resume backgrounds correctly on start (page 1 running, page 2 paused)
  handleBackgroundTransitionComplete(0);

  initOpeningAnimation();
}

// Start the app
initialize();

// ═══════════════════════════════════════════════════════════════
// BACKGROUND BRIDGE — Mouse forwarding + Control Panel for Page 1
// ═══════════════════════════════════════════════════════════════

/**
 * Send postMessage to background iframe safely
 */
function sendMsgToBgFrame(frameId, data) {
  const frame = document.getElementById(frameId);
  try {
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage(data, '*');
    }
  } catch (_) {}
}

/**
 * Control background animation pause/resume states
 */
function setBackgroundRunning(pageIdx, isRunning) {
  const frameId = pageIdx === 0 ? 'p1-bg-frame' : (pageIdx === 1 ? 'p2-bg-frame' : null);
  if (!frameId) return;
  sendMsgToBgFrame(frameId, { type: isRunning ? 'resume' : 'pause' });
}

/**
 * Handle background transition start (resume target background early)
 */
function handleBackgroundTransitionStart(fromIdx, toIdx) {
  setBackgroundRunning(toIdx, true);
}

/**
 * Handle background transition completion (pause all backgrounds except currentIdx)
 */
function handleBackgroundTransitionComplete(currentIdx) {
  for (let i = 0; i < CONFIG.TOTAL_PAGES; i++) {
    if (i === currentIdx) {
      setBackgroundRunning(i, true);
    } else {
      setBackgroundRunning(i, false);
    }
  }
  updatePanelVisibility();
}

/**
 * Update background settings panel visibility based on active page
 */
function updatePanelVisibility() {
  const wrap = document.getElementById('bg-panel-wrap');
  const panel = document.getElementById('bgPanel');
  if (!wrap) return;

  if (state.current === 0) {
    wrap.classList.add('bg-panel-visible');
  } else {
    wrap.classList.remove('bg-panel-visible');
    if (panel) panel.classList.remove('open');
  }
}

function setupBackgroundBridge() {
  const wrap         = document.getElementById('bg-panel-wrap');
  const toggleBtn    = document.getElementById('bg-panel-toggle');
  const panel        = document.getElementById('bgPanel');
  const closeBtn     = document.getElementById('bgPanelClose');
  const colorInput   = document.getElementById('bgColor');
  const speedInput   = document.getElementById('bgSpeed');
  const speedVal     = document.getElementById('bgSpeedVal');
  const connectInput = document.getElementById('bgConnect');
  const connectVal   = document.getElementById('bgConnectVal');
  const radiusInput  = document.getElementById('bgRadius');
  const radiusVal    = document.getElementById('bgRadiusVal');
  const resetBtn     = document.getElementById('bgReset');

  if (!wrap) return; // panel not in DOM yet

  function sendMsg(data) {
    sendMsgToBgFrame('p1-bg-frame', data);
  }

  /* ── Mouse forwarding: stage → iframe ── */
  const stage = document.getElementById('stage');
  if (stage) {
    stage.addEventListener('pointermove', (e) => {
      if (state.current !== 0) return; // only for page 1
      const frame = document.getElementById('p1-bg-frame');
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      sendMsg({ type: 'mousemove', x: e.clientX - rect.left, y: e.clientY - rect.top });
    }, { passive: true });

    stage.addEventListener('pointerleave', () => {
      if (state.current === 0) {
        sendMsg({ type: 'mouseleave' });
      }
    });

    stage.addEventListener('click', (e) => {
      if (state.current === 0) {
        // Don't spawn particles when clicking on UI elements
        if (e.target.closest('.page-content, .industrial-corner, #bg-panel-wrap')) return;
        const frame = document.getElementById('p1-bg-frame');
        if (!frame) return;
        const rect = frame.getBoundingClientRect();
        sendMsg({ type: 'click', x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else if (state.current === 1) {
        // Page 2 interactive grid click
        // Don't trigger cell explosion when clicking on cards, placeholders, tags, or page navigation elements
        if (e.target.closest('.brand-logo, .game-card, .game-card-placeholder, .swipe-hint, .page-num, .corner-tag, .hero-title-ihk, .hero-desc, .status-indicator')) return;
        
        const frame = document.getElementById('p2-bg-frame');
        if (!frame) return;
        const rect = frame.getBoundingClientRect();
        sendMsgToBgFrame('p2-bg-frame', { type: 'click', x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    });
  }

  /* ── Toggle panel open/close ── */
  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('open');
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.remove('open');
  });

  /* ── Control inputs → postMessage to iframe ── */
  colorInput.addEventListener('input', (e) => {
    sendMsg({ type: 'settings', color: e.target.value });
  });

  speedInput.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value).toFixed(1);
    speedVal.textContent = v;
    sendMsg({ type: 'settings', speed: parseFloat(v) });
  });

  connectInput.addEventListener('input', (e) => {
    connectVal.textContent = e.target.value;
    sendMsg({ type: 'settings', connectionDistance: parseInt(e.target.value) });
  });

  radiusInput.addEventListener('input', (e) => {
    radiusVal.textContent = e.target.value;
    sendMsg({ type: 'settings', mouseRadius: parseInt(e.target.value) });
  });

  resetBtn.addEventListener('click', () => {
    sendMsg({ type: 'reset' });
  });

  // Set initial visibility (starts on page 0 = page 1)
  updatePanelVisibility();
}
