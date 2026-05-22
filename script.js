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

async function initialize() {
  await loadAllPages();
  initializeEventListeners();
  setupGameModalListeners();
  setupGameCardListeners();
  setupCommentsHandler();
  setupBackgroundBridge();
  updateUI();
  setTimeout(() => revealPage(0), 100);
}

// Start the app
initialize();

// ═══════════════════════════════════════════════════════════════
// BACKGROUND BRIDGE — Mouse forwarding + Control Panel for Page 1
// ═══════════════════════════════════════════════════════════════

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

  /* ── Helper: get iframe contentWindow safely ── */
  function sendMsgToFrame(frameId, data) {
    const frame = document.getElementById(frameId);
    try {
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage(data, '*');
      }
    } catch (_) {}
  }

  function sendMsg(data) {
    sendMsgToFrame('p1-bg-frame', data);
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
        if (e.target.closest('.game-card, .game-card-placeholder, .swipe-hint, .page-num, .corner-tag, .hero-title-ihk, .hero-desc, .status-indicator')) return;
        
        const frame = document.getElementById('p2-bg-frame');
        if (!frame) return;
        const rect = frame.getBoundingClientRect();
        sendMsgToFrame('p2-bg-frame', { type: 'click', x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    });
  }

  /* ── Panel show/hide on page change ── */
  function updatePanelVisibility() {
    if (state.current === 0) {
      wrap.classList.add('bg-panel-visible');
    } else {
      wrap.classList.remove('bg-panel-visible');
      panel.classList.remove('open'); // close panel when leaving page 1
    }
  }

  // Override finalizeTransition to hook visibility update
  const _origFinalizeTransition = window._bgBridgeFinalizeHooked;
  if (!_origFinalizeTransition) {
    window._bgBridgeFinalizeHooked = true;
    // Poll state.current changes to update visibility and performance state
    let lastPage = -1;
    function checkPageChange() {
      if (state.current !== lastPage) {
        if (state.current === 0) {
          sendMsgToFrame('p1-bg-frame', { type: 'resume' });
          sendMsgToFrame('p2-bg-frame', { type: 'pause' });
        } else if (state.current === 1) {
          sendMsgToFrame('p1-bg-frame', { type: 'pause' });
          sendMsgToFrame('p2-bg-frame', { type: 'resume' });
        } else {
          sendMsgToFrame('p1-bg-frame', { type: 'pause' });
          sendMsgToFrame('p2-bg-frame', { type: 'pause' });
        }
        
        lastPage = state.current;
        updatePanelVisibility();
      }
      requestAnimationFrame(checkPageChange);
    }
    checkPageChange();
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
