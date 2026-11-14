/**
 * NUMS 2nd Year MBBS MCQs Interactive App
 * Supports:
 *  - Block 4 (GIT & Metabolism I + Genitourinary System • 699 MCQs • 42 Topics)
 *  - Block 5 (Neurosciences I & Genetics • 707 MCQs • 36 Topics)
 *  - Block 6 (Maxillofacial & Special Senses + Endocrinology • 604 MCQs • 30 Topics)
 * Total: 2,010 Clinical Scenario MCQs across 108 Topics.
 * Features:
 *  - Immediate learning feedback with Exam Pearls
 *  - Dual-Layer Persistence (IndexedDB + LocalStorage)
 *  - Backward compatibility with all legacy storage keys
 *  - Data Backup & Restore Center (Export/Import JSON)
 *  - Non-destructive sync and accidental reset protection
 */

(function () {
  'use strict';

  // Ensure data exists
  if (!window.BLOCKS_DATA || !window.BLOCKS_DATA.blocks) {
    console.error('BLOCKS_DATA is not loaded. Please ensure data.js is included.');
    return;
  }

  const { blocks } = window.BLOCKS_DATA;
  const SUPPORTED_BLOCKS = ['block4', 'block5', 'block6'];

  // Active state
  let currentBlockId = 'block4';
  let currentTopicId = null;
  let currentFilter = 'all'; // all, unattempted, wrong, correct, bookmarked
  let searchQuery = '';

  // Persistent storage caches
  const userAnswers = {
    block4: {},
    block5: {},
    block6: {}
  };

  const userBookmarks = {
    block4: new Set(),
    block5: new Set(),
    block6: new Set()
  };

  const STORAGE_PREFIX = 'nums_app_v2_';
  const STORAGE_THEME_KEY = 'nums_theme_v2';
  const SNAPSHOT_UNDO_KEY = 'nums_last_reset_snapshot_v1';
  const DB_NAME = 'NUMS_MBBS_Database_v1';
  const DB_VERSION = 1;
  let idbPromise = null;

  // Build fast lookup maps per block
  const blockMaps = {
    block4: { mcqs: new Map(), topics: new Map() },
    block5: { mcqs: new Map(), topics: new Map() },
    block6: { mcqs: new Map(), topics: new Map() }
  };

  SUPPORTED_BLOCKS.forEach(bId => {
    const bData = blocks[bId];
    if (bData) {
      bData.mcqs.forEach(m => blockMaps[bId].mcqs.set(m.id, m));
      bData.topics.forEach(t => blockMaps[bId].topics.set(t.id, t));
    }
  });

  // ==========================================
  // DUAL-LAYER DATABASE & STORAGE ENGINE
  // ==========================================

  function getIDB() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise(resolve => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve(null);
        return;
      }
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('attempts')) {
            const store = db.createObjectStore('attempts', { keyPath: 'id' });
            store.createIndex('blockId', 'blockId', { unique: false });
          }
          if (!db.objectStoreNames.contains('bookmarks')) {
            const store = db.createObjectStore('bookmarks', { keyPath: 'id' });
            store.createIndex('blockId', 'blockId', { unique: false });
          }
          if (!db.objectStoreNames.contains('snapshots')) {
            db.createObjectStore('snapshots', { keyPath: 'timestamp' });
          }
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch (err) {
        console.warn('IndexedDB initialization skipped:', err);
        resolve(null);
      }
    });
    return idbPromise;
  }

  async function idbSaveAttempt(blockId, mcqId, record) {
    const db = await getIDB();
    if (!db) return;
    try {
      const tx = db.transaction('attempts', 'readwrite');
      tx.objectStore('attempts').put({
        id: `${blockId}_${mcqId}`,
        blockId,
        mcqId: Number(mcqId),
        selected: record.selected,
        isCorrect: record.isCorrect,
        answeredAt: record.answeredAt || Date.now()
      });
    } catch (e) {
      console.warn('idbSaveAttempt failed:', e);
    }
  }

  async function idbSaveBookmark(blockId, mcqId, isBookmarked) {
    const db = await getIDB();
    if (!db) return;
    try {
      const tx = db.transaction('bookmarks', 'readwrite');
      const store = tx.objectStore('bookmarks');
      const id = `${blockId}_${mcqId}`;
      if (isBookmarked) {
        store.put({ id, blockId, mcqId: Number(mcqId), bookmarkedAt: Date.now() });
      } else {
        store.delete(id);
      }
    } catch (e) {
      console.warn('idbSaveBookmark failed:', e);
    }
  }

  // Synchronous Load with Multi-Key Fallback (guarantees existing attempts & bookmarks are never lost)
  function loadState() {
    try {
      SUPPORTED_BLOCKS.forEach(bId => {
        let savedAns = localStorage.getItem(`${STORAGE_PREFIX}${bId}_answers`);

        // Check legacy keys for Block 4
        if (!savedAns && bId === 'block4') {
          savedAns = localStorage.getItem('nums_b4_answers_v1') ||
                     localStorage.getItem('nums_block4_answers_v1') ||
                     localStorage.getItem('nums_block4_answers') ||
                     localStorage.getItem('nums_answers_v1');
        }

        if (savedAns) {
          try {
            userAnswers[bId] = JSON.parse(savedAns) || {};
            // Sync to new standard key
            localStorage.setItem(`${STORAGE_PREFIX}${bId}_answers`, JSON.stringify(userAnswers[bId]));
            if (bId === 'block4') {
              localStorage.setItem('nums_b4_answers_v1', JSON.stringify(userAnswers[bId]));
            }
          } catch (e) {
            console.error('Error parsing saved answers for', bId, e);
          }
        }

        let savedBk = localStorage.getItem(`${STORAGE_PREFIX}${bId}_bookmarks`);
        if (!savedBk && bId === 'block4') {
          savedBk = localStorage.getItem('nums_b4_bookmarks_v1') ||
                     localStorage.getItem('nums_block4_bookmarks');
        }
        if (savedBk) {
          try {
            userBookmarks[bId] = new Set(JSON.parse(savedBk));
            localStorage.setItem(`${STORAGE_PREFIX}${bId}_bookmarks`, JSON.stringify(Array.from(userBookmarks[bId])));
            if (bId === 'block4') {
              localStorage.setItem('nums_b4_bookmarks_v1', JSON.stringify(Array.from(userBookmarks[bId])));
            }
          } catch (e) {
            console.error('Error parsing bookmarks for', bId, e);
          }
        }
      });

      const savedTheme = localStorage.getItem(STORAGE_THEME_KEY) ||
                         localStorage.getItem('nums_theme_v1') || 'light';
      applyTheme(savedTheme);

      // Pre-seed progress if fresh install and preset is provided
      applyPreseededProgressIfFresh();
    } catch (e) {
      console.warn('Could not load from localStorage:', e);
    }

    // Connect & merge with IndexedDB asynchronously
    syncFromIndexedDB();
  }

  function applyPreseededProgressIfFresh() {
    if (!window.PRESEEDED_PROGRESS || !window.PRESEEDED_PROGRESS.answers) return;
    if (localStorage.getItem('nums_has_ever_initialized')) return;

    let preseeded = false;
    const data = window.PRESEEDED_PROGRESS;
    SUPPORTED_BLOCKS.forEach(bId => {
      if (data.answers && data.answers[bId] && Object.keys(data.answers[bId]).length > 0) {
        userAnswers[bId] = { ...(userAnswers[bId] || {}), ...data.answers[bId] };
        saveProgress(bId);
        Object.keys(data.answers[bId]).forEach(mcqId => {
          idbSaveAttempt(bId, mcqId, data.answers[bId][mcqId]);
        });
        preseeded = true;
      }
      if (data.bookmarks && Array.isArray(data.bookmarks[bId])) {
        data.bookmarks[bId].forEach(mcqId => {
          userBookmarks[bId].add(mcqId);
          idbSaveBookmark(bId, mcqId, true);
        });
        saveBookmarks(bId);
        preseeded = true;
      }
    });

    if (preseeded) {
      localStorage.setItem('nums_has_ever_initialized', 'true');
    }
  }

  async function syncFromIndexedDB() {
    const db = await getIDB();
    if (!db) return;
    try {
      let changed = false;
      const tx = db.transaction(['attempts', 'bookmarks'], 'readonly');
      const attStore = tx.objectStore('attempts');
      const bkStore = tx.objectStore('bookmarks');

      const allAttempts = await new Promise(resolve => {
        const r = attStore.getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => resolve([]);
      });

      const allBookmarks = await new Promise(resolve => {
        const r = bkStore.getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => resolve([]);
      });

      allAttempts.forEach(item => {
        const bId = item.blockId;
        if (userAnswers[bId]) {
          if (!userAnswers[bId][item.mcqId]) {
            userAnswers[bId][item.mcqId] = {
              selected: item.selected,
              isCorrect: item.isCorrect,
              answeredAt: item.answeredAt
            };
            changed = true;
          }
        }
      });

      allBookmarks.forEach(item => {
        const bId = item.blockId;
        if (userBookmarks[bId]) {
          if (!userBookmarks[bId].has(item.mcqId)) {
            userBookmarks[bId].add(item.mcqId);
            changed = true;
          }
        }
      });

      // Write any localStorage items to IndexedDB that weren't in IndexedDB yet
      SUPPORTED_BLOCKS.forEach(bId => {
        const ans = userAnswers[bId] || {};
        Object.keys(ans).forEach(mcqId => {
          idbSaveAttempt(bId, mcqId, ans[mcqId]);
        });
        const bks = userBookmarks[bId] || new Set();
        bks.forEach(mcqId => {
          idbSaveBookmark(bId, mcqId, true);
        });
      });

      if (changed) {
        SUPPORTED_BLOCKS.forEach(bId => {
          saveProgress(bId);
          saveBookmarks(bId);
        });
        // Refresh view
        if (window.location.hash.includes('topic')) {
          renderTopicMCQs();
        } else if (window.location.hash.startsWith('#block')) {
          showBlockDashboard(currentBlockId);
        } else {
          showHomeView();
        }
      }
    } catch (e) {
      console.warn('syncFromIndexedDB error:', e);
    }
  }

  function saveProgress(bId) {
    try {
      const json = JSON.stringify(userAnswers[bId] || {});
      localStorage.setItem(`${STORAGE_PREFIX}${bId}_answers`, json);
      if (bId === 'block4') {
        localStorage.setItem('nums_b4_answers_v1', json);
      }
    } catch (e) {
      console.warn('Could not save progress:', e);
    }
  }

  function saveBookmarks(bId) {
    try {
      const arr = Array.from(userBookmarks[bId] || []);
      const json = JSON.stringify(arr);
      localStorage.setItem(`${STORAGE_PREFIX}${bId}_bookmarks`, json);
      if (bId === 'block4') {
        localStorage.setItem('nums_b4_bookmarks_v1', json);
      }
    } catch (e) {
      console.warn('Could not save bookmarks:', e);
    }
  }

  // ==========================================
  // EXPORT & RESTORE DATA CENTER
  // ==========================================

  function getBackupPayload() {
    return {
      app: 'NUMS 2nd Year MBBS MCQs Portal',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      summary: {
        block4: {
          answered: Object.keys(userAnswers.block4 || {}).length,
          bookmarks: (userBookmarks.block4 || new Set()).size,
          total: 699
        },
        block5: {
          answered: Object.keys(userAnswers.block5 || {}).length,
          bookmarks: (userBookmarks.block5 || new Set()).size,
          total: 707
        },
        block6: {
          answered: Object.keys(userAnswers.block6 || {}).length,
          bookmarks: (userBookmarks.block6 || new Set()).size,
          total: 604
        }
      },
      answers: {
        block4: userAnswers.block4,
        block5: userAnswers.block5,
        block6: userAnswers.block6
      },
      bookmarks: {
        block4: Array.from(userBookmarks.block4),
        block5: Array.from(userBookmarks.block5),
        block6: Array.from(userBookmarks.block6)
      }
    };
  }

  function exportDatabaseBackup() {
    try {
      const payload = getBackupPayload();
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `NUMS_MBBS_Progress_Backup_${dateStr}.json`;

      // On Android native app, trigger native share sheet
      if (window.AndroidBridge && window.AndroidBridge.shareBackup) {
        window.AndroidBridge.shareBackup(JSON.stringify(payload, null, 2), filename);
        showToast('Native share opened for backup!', '📤');
        return;
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Progress backup downloaded safely!', '📥');
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to generate export file: ' + err.message);
    }
  }

  function copyDatabaseBackupToClipboard() {
    try {
      const payload = getBackupPayload();
      const text = JSON.stringify(payload, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showToast('Copied progress JSON to clipboard!', '📋');
        }).catch(() => {
          fallbackCopyText(text);
        });
      } else {
        fallbackCopyText(text);
      }
    } catch (err) {
      console.error('Copy error:', err);
      alert('Could not copy progress: ' + err.message);
    }
  }

  function fallbackCopyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      showToast('Copied progress JSON to clipboard!', '📋');
    } catch (e) {
      prompt('Copy your progress JSON below:', text);
    }
    document.body.removeChild(ta);
  }

  function importDatabaseBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || !data.answers) {
          alert('Invalid backup file. Missing answers structure.');
          return;
        }

        // Snapshot existing state before merging as a safety guard
        createSafetySnapshot('Pre-Import Snapshot');

        // Non-destructive merge
        let mergedAnswers = 0;
        let mergedBookmarks = 0;

        SUPPORTED_BLOCKS.forEach(bId => {
          if (data.answers && data.answers[bId]) {
            Object.keys(data.answers[bId]).forEach(mcqId => {
              userAnswers[bId][mcqId] = data.answers[bId][mcqId];
              idbSaveAttempt(bId, mcqId, data.answers[bId][mcqId]);
              mergedAnswers++;
            });
            saveProgress(bId);
          }

          if (data.bookmarks && Array.isArray(data.bookmarks[bId])) {
            data.bookmarks[bId].forEach(mcqId => {
              userBookmarks[bId].add(mcqId);
              idbSaveBookmark(bId, mcqId, true);
              mergedBookmarks++;
            });
            saveBookmarks(bId);
          }
        });

        updateDatabaseModalStats();
        showToast(`Restored & merged ${mergedAnswers} answers and ${mergedBookmarks} bookmarks!`, '✅');

        // Re-render
        if (window.location.hash.includes('topic')) {
          renderTopicMCQs();
        } else if (window.location.hash.startsWith('#block')) {
          showBlockDashboard(currentBlockId);
        } else {
          showHomeView();
        }
      } catch (err) {
        console.error('Import error:', err);
        alert('Failed to parse backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function createSafetySnapshot(reason) {
    try {
      const snap = {
        reason,
        timestamp: Date.now(),
        date: new Date().toISOString(),
        answers: {
          block4: { ...userAnswers.block4 },
          block5: { ...userAnswers.block5 },
          block6: { ...userAnswers.block6 }
        },
        bookmarks: {
          block4: Array.from(userBookmarks.block4),
          block5: Array.from(userBookmarks.block5),
          block6: Array.from(userBookmarks.block6)
        }
      };
      localStorage.setItem(SNAPSHOT_UNDO_KEY, JSON.stringify(snap));
      const undoSec = document.getElementById('db-undo-section');
      if (undoSec) undoSec.style.display = 'block';
    } catch (e) {
      console.warn('Could not create snapshot:', e);
    }
  }

  function undoLastReset() {
    try {
      const snapJson = localStorage.getItem(SNAPSHOT_UNDO_KEY);
      if (!snapJson) {
        alert('No previous snapshot found to restore.');
        return;
      }
      const snap = JSON.parse(snapJson);
      SUPPORTED_BLOCKS.forEach(bId => {
        userAnswers[bId] = snap.answers[bId] || {};
        userBookmarks[bId] = new Set(snap.bookmarks[bId] || []);
        saveProgress(bId);
        saveBookmarks(bId);
        Object.keys(userAnswers[bId]).forEach(mcqId => {
          idbSaveAttempt(bId, mcqId, userAnswers[bId][mcqId]);
        });
      });

      localStorage.removeItem(SNAPSHOT_UNDO_KEY);
      const undoSec = document.getElementById('db-undo-section');
      if (undoSec) undoSec.style.display = 'none';

      updateDatabaseModalStats();
      showToast('Successfully restored previous state!', '↩️');

      if (window.location.hash.includes('topic')) {
        renderTopicMCQs();
      } else if (window.location.hash.startsWith('#block')) {
        showBlockDashboard(currentBlockId);
      } else {
        showHomeView();
      }
    } catch (e) {
      alert('Error restoring snapshot: ' + e.message);
    }
  }

  // ==========================================
  // MODAL & UI NOTIFICATIONS
  // ==========================================

  function openDatabaseModal() {
    updateDatabaseModalStats();
    const modal = document.getElementById('db-modal-backdrop');
    if (modal) modal.classList.add('open');

    const undoSec = document.getElementById('db-undo-section');
    if (undoSec) {
      const hasSnap = !!localStorage.getItem(SNAPSHOT_UNDO_KEY);
      undoSec.style.display = hasSnap ? 'block' : 'none';
    }
  }

  function closeDatabaseModal() {
    const modal = document.getElementById('db-modal-backdrop');
    if (modal) modal.classList.remove('open');
  }

  function updateDatabaseModalStats() {
    SUPPORTED_BLOCKS.forEach(bId => {
      const prefix = bId === 'block4' ? 'b4' : bId === 'block5' ? 'b5' : 'b6';
      const ansCount = Object.keys(userAnswers[bId] || {}).length;
      const bkCount = (userBookmarks[bId] || new Set()).size;

      const ansEl = document.getElementById(`db-stat-${prefix}-ans`);
      const bkEl = document.getElementById(`db-stat-${prefix}-bk`);
      if (ansEl) ansEl.textContent = ansCount;
      if (bkEl) bkEl.textContent = bkCount;
    });
  }

  function showToast(message, icon = '✅') {
    const toast = document.getElementById('app-toast');
    const msgEl = document.getElementById('toast-msg');
    const iconEl = document.getElementById('toast-icon');
    if (!toast) return;

    if (msgEl) msgEl.textContent = message;
    if (iconEl) iconEl.textContent = icon;

    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  // Theme Management
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_THEME_KEY, theme);
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    if (themeIcon) themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (themeText) themeText.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';

    if (window.AndroidBridge && window.AndroidBridge.setStatusBarTheme) {
      try {
        window.AndroidBridge.setStatusBarTheme(theme === 'dark');
      } catch (e) {}
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  // ==========================================
  // ROUTER
  // ==========================================
  function router() {
    const hash = window.location.hash || '#';
    const breadcrumbEl = document.getElementById('breadcrumbs');

    // Hide all views
    document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active'));

    if (hash === '#' || hash === '#home' || hash === '') {
      showHomeView();
      if (breadcrumbEl) breadcrumbEl.innerHTML = `<span class="active">Home</span>`;
    } else if (hash === '#block4') {
      currentBlockId = 'block4';
      showBlockDashboard('block4');
      if (breadcrumbEl) {
        breadcrumbEl.innerHTML = `
          <a href="#">Home</a>
          <span class="separator">/</span>
          <span class="active">Block 4</span>
        `;
      }
    } else if (hash === '#block5') {
      currentBlockId = 'block5';
      showBlockDashboard('block5');
      if (breadcrumbEl) {
        breadcrumbEl.innerHTML = `
          <a href="#">Home</a>
          <span class="separator">/</span>
          <span class="active">Block 5</span>
        `;
      }
    } else if (hash === '#block6') {
      currentBlockId = 'block6';
      showBlockDashboard('block6');
      if (breadcrumbEl) {
        breadcrumbEl.innerHTML = `
          <a href="#">Home</a>
          <span class="separator">/</span>
          <span class="active">Block 6</span>
        `;
      }
    } else if (hash.startsWith('#block4/topic/')) {
      currentBlockId = 'block4';
      const topicId = parseInt(hash.replace('#block4/topic/', ''), 10);
      showTopicView('block4', topicId);
    } else if (hash.startsWith('#block5/topic/')) {
      currentBlockId = 'block5';
      const topicId = parseInt(hash.replace('#block5/topic/', ''), 10);
      showTopicView('block5', topicId);
    } else if (hash.startsWith('#block6/topic/')) {
      currentBlockId = 'block6';
      const topicId = parseInt(hash.replace('#block6/topic/', ''), 10);
      showTopicView('block6', topicId);
    } else if (hash.startsWith('#coming-soon/')) {
      const blockName = hash.replace('#coming-soon/', '');
      showComingSoonView(blockName);
    } else {
      showHomeView();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================
  // VIEW: HOME
  // ==========================================
  function showHomeView() {
    const el = document.getElementById('home-view');
    if (el) el.classList.add('active');

    // Update Home cards with real-time saved progress
    SUPPORTED_BLOCKS.forEach(bId => {
      const bData = blocks[bId];
      const answers = userAnswers[bId] || {};
      const prefix = bId === 'block4' ? 'b4' : bId === 'block5' ? 'b5' : 'b6';
      const pillEl = document.getElementById(`home-${prefix}-progress-pill`);

      if (bData && pillEl) {
        let answered = 0;
        let correct = 0;
        bData.mcqs.forEach(m => {
          const a = answers[m.id] || answers[String(m.id)];
          if (a) {
            answered++;
            if (a.isCorrect) correct++;
          }
        });

        if (answered > 0) {
          const pct = Math.round((answered / bData.totalMCQs) * 100);
          const acc = Math.round((correct / answered) * 100);
          pillEl.innerHTML = `
            <div style="font-size: 0.825rem; font-weight: 600; color: var(--correct); display: flex; justify-content: space-between; align-items: center;">
              <span>✅ ${answered} of ${bData.totalMCQs} completed (${pct}%)</span>
              <span>${acc}% correct</span>
            </div>
            <div class="topic-progress-bar" style="margin-top: 0.35rem; height: 5px;">
              <div class="topic-progress-fill" style="width: ${pct}%;"></div>
            </div>
          `;
        } else {
          pillEl.innerHTML = `
            <div style="font-size: 0.8rem; color: var(--text-muted);">Not started yet</div>
          `;
        }
      }
    });
  }

  // VIEW: COMING SOON (Kept as fallback)
  function showComingSoonView(blockName) {
    const el = document.getElementById('coming-soon-view');
    const titleEl = document.getElementById('coming-soon-title');
    const descEl = document.getElementById('coming-soon-desc');
    const breadcrumbEl = document.getElementById('breadcrumbs');

    const formattedName = blockName.toUpperCase();
    if (titleEl) titleEl.textContent = `${formattedName} - Coming Soon`;
    if (descEl) descEl.textContent = 'This module is currently being verified and will be available soon.';

    if (breadcrumbEl) {
      breadcrumbEl.innerHTML = `
        <a href="#">Home</a>
        <span class="separator">/</span>
        <span class="active">${formattedName}</span>
      `;
    }

    if (el) el.classList.add('active');
  }

  // ==========================================
  // VIEW: DYNAMIC BLOCK DASHBOARD
  // ==========================================
  function showBlockDashboard(blockId) {
    const el = document.getElementById('block-dashboard-view');
    if (!el) return;
    el.classList.add('active');

    const blockData = blocks[blockId];
    if (!blockData) return;

    const blockLabel = blockId === 'block4' ? 'Block 4' : blockId === 'block5' ? 'Block 5' : 'Block 6';

    // Set header details
    const titleEl = document.getElementById('block-main-title');
    const descEl = document.getElementById('block-main-desc');
    const tagEl = document.getElementById('block-syllabus-tag');

    if (titleEl) titleEl.textContent = blockData.blockTitle;
    if (descEl) descEl.textContent = `${blockData.totalMCQs} Clinical Scenario MCQs under ${blockData.totalTopics} syllabus headings from NUMS Prof & Send-up papers.`;
    if (tagEl) tagEl.textContent = `NUMS ${blockLabel} Syllabus 2026`;

    // Compute progress
    const answers = userAnswers[blockId] || {};
    let answeredCount = 0;
    let correctCount = 0;

    blockData.mcqs.forEach(m => {
      const a = answers[m.id] || answers[String(m.id)];
      if (a) {
        answeredCount++;
        if (a.isCorrect) correctCount++;
      }
    });

    const overallPct = blockData.totalMCQs > 0 ? Math.round((answeredCount / blockData.totalMCQs) * 100) : 0;
    const accuracyPct = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

    const pctEl = document.getElementById('block-overall-pct');
    const subtextEl = document.getElementById('block-overall-subtext');
    if (pctEl) pctEl.textContent = `${overallPct}%`;
    if (subtextEl) subtextEl.textContent = `${answeredCount} of ${blockData.totalMCQs} answered • ${accuracyPct}% correct`;

    // Render subject filter tabs
    const tabsContainer = document.getElementById('subject-tabs-container');
    if (tabsContainer) {
      let tabsHtml = `
        <button class="subject-tab-btn active" data-subject="all">
          <span>All Subjects</span>
          <span class="tab-badge">${blockData.totalTopics} Topics • ${blockData.totalMCQs} MCQs</span>
        </button>
      `;

      blockData.subjects.forEach(sub => {
        const icon = sub.name === 'Anatomy' ? '🦴' : sub.name === 'Physiology' ? '🫀' : '🧬';
        const subClass = `tab-${sub.name.toLowerCase()}`;
        tabsHtml += `
          <button class="subject-tab-btn ${subClass}" data-subject="${sub.name.toLowerCase()}">
            <span>${icon} ${sub.name}</span>
            <span class="tab-badge">${sub.topicsCount} Topics • ${sub.mcqCount} MCQs</span>
          </button>
        `;
      });
      tabsContainer.innerHTML = tabsHtml;

      // Attach tab click events
      tabsContainer.querySelectorAll('.subject-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          tabsContainer.querySelectorAll('.subject-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const targetSub = btn.getAttribute('data-subject');
          document.querySelectorAll('.subject-section').forEach(sec => {
            if (targetSub === 'all') {
              sec.style.display = 'block';
            } else {
              sec.style.display = sec.classList.contains(targetSub) ? 'block' : 'none';
            }
          });
        });
      });
    }

    // Render subject sections & topics
    const sectionsContainer = document.getElementById('subject-sections-container');
    if (sectionsContainer) {
      let sectionsHtml = '';

      blockData.subjects.forEach(sub => {
        const subTopics = blockData.topics.filter(t => t.subject.toLowerCase() === sub.name.toLowerCase());
        const icon = sub.name === 'Anatomy' ? '🦴' : sub.name === 'Physiology' ? '🫀' : '🧬';

        sectionsHtml += `
          <div class="subject-section ${sub.name.toLowerCase()}" id="sec-${sub.name.toLowerCase()}">
            <div class="subject-section-header">
              <div>
                <h2 class="subject-section-title">${icon} ${sub.name} (${sub.mcqCount} MCQs)</h2>
                <div class="subject-meta">${escapeHtml(sub.description)}</div>
              </div>
            </div>
            <div class="topics-grid">
              ${subTopics.map(t => {
                let topicAns = 0;
                for (let id = t.start; id <= t.end; id++) {
                  if (answers[id] || answers[String(id)]) topicAns++;
                }
                const progressPct = t.count > 0 ? Math.round((topicAns / t.count) * 100) : 0;
                const isCompleted = topicAns === t.count && t.count > 0;

                return `
                  <div class="topic-card" onclick="window.location.hash='#${blockId}/topic/${t.id}'">
                    <div class="topic-card-header">
                      <span class="topic-num">#${t.id}</span>
                      <span class="mcq-count-badge">${t.count} MCQs</span>
                    </div>
                    <div class="topic-card-title">${escapeHtml(t.name)}</div>
                    <div class="topic-card-footer">
                      <span class="topic-progress-mini ${isCompleted ? 'done' : ''}">
                        ${topicAns > 0 ? `${topicAns}/${t.count} done (${progressPct}%)` : 'Not started'}
                      </span>
                      <span style="color: var(--primary-light); font-size: 0.85rem; font-weight: 600;">Start &rarr;</span>
                    </div>
                    <div class="topic-progress-bar">
                      <div class="topic-progress-fill" style="width: ${progressPct}%;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      });

      sectionsContainer.innerHTML = sectionsHtml;
    }
  }

  // ==========================================
  // VIEW: TOPIC MCQs (SCROLLABLE LIST)
  // ==========================================
  function showTopicView(blockId, topicId) {
    const el = document.getElementById('topic-view');
    if (!el) return;
    el.classList.add('active');

    currentBlockId = blockId;
    currentTopicId = topicId;
    currentFilter = 'all';
    searchQuery = '';

    const blockData = blocks[blockId];
    if (!blockData) return;

    const topic = blockMaps[blockId].topics.get(topicId);
    if (!topic) {
      window.location.hash = `#${blockId}`;
      return;
    }

    const blockLabel = blockId === 'block4' ? 'Block 4' : blockId === 'block5' ? 'Block 5' : 'Block 6';

    // Breadcrumbs
    const breadcrumbEl = document.getElementById('breadcrumbs');
    if (breadcrumbEl) {
      breadcrumbEl.innerHTML = `
        <a href="#">Home</a>
        <span class="separator">/</span>
        <a href="#${blockId}">${blockLabel}</a>
        <span class="separator">/</span>
        <span class="separator">${escapeHtml(topic.subject)}</span>
        <span class="separator">/</span>
        <span class="active">Topic ${topic.id}</span>
      `;
    }

    // Back button in sticky bar
    const backBtn = document.getElementById('topic-back-btn');
    const backLabel = document.getElementById('topic-back-label');
    if (backBtn) backBtn.onclick = () => window.location.hash = `#${blockId}`;
    if (backLabel) backLabel.textContent = `${blockLabel} Topics`;

    // Title & Subject Badge
    const titleEl = document.getElementById('current-topic-title');
    const badgeEl = document.getElementById('topic-subject-badge');
    if (titleEl) titleEl.textContent = `${topic.id}. ${topic.name}`;
    if (badgeEl) {
      badgeEl.textContent = topic.subject;
      badgeEl.style.backgroundColor = topic.subject === 'Anatomy' ? 'var(--anatomy-bg)' :
                                      topic.subject === 'Physiology' ? 'var(--physiology-bg)' : 'var(--biochemistry-bg)';
      badgeEl.style.color = topic.subject === 'Anatomy' ? 'var(--anatomy)' :
                            topic.subject === 'Physiology' ? 'var(--physiology)' : 'var(--biochemistry)';
    }

    // Reset Search & Filters
    const searchInput = document.getElementById('topic-search-input');
    if (searchInput) searchInput.value = '';

    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === 'all');
    });

    // Update Bottom Navigation (Next/Prev Topic)
    updateTopicNavButtons(blockId, topic);

    // Render questions
    renderTopicMCQs();
  }

  function updateTopicNavButtons(blockId, topic) {
    const blockData = blocks[blockId];
    const prevBtn = document.getElementById('prev-topic-btn');
    const nextBtn = document.getElementById('next-topic-btn');

    if (prevBtn) {
      if (topic.id > 1) {
        prevBtn.style.display = 'inline-flex';
        prevBtn.onclick = () => window.location.hash = `#${blockId}/topic/${topic.id - 1}`;
        prevBtn.innerHTML = `&larr; Previous Topic (#${topic.id - 1})`;
      } else {
        prevBtn.style.display = 'none';
      }
    }

    if (nextBtn) {
      if (topic.id < blockData.totalTopics) {
        nextBtn.style.display = 'inline-flex';
        nextBtn.onclick = () => window.location.hash = `#${blockId}/topic/${topic.id + 1}`;
        nextBtn.innerHTML = `Next Topic (#${topic.id + 1}) &rarr;`;
      } else {
        nextBtn.style.display = 'none';
      }
    }
  }

  // RENDER MCQs FOR CURRENT TOPIC
  function renderTopicMCQs() {
    const container = document.getElementById('mcqs-list-container');
    if (!container || !currentTopicId) return;

    const blockId = currentBlockId;
    const topic = blockMaps[blockId].topics.get(currentTopicId);
    if (!topic) return;

    const answers = userAnswers[blockId] || {};
    const bookmarks = userBookmarks[blockId] || new Set();

    // Collect questions in this topic
    const topicQuestions = [];
    for (let id = topic.start; id <= topic.end; id++) {
      const q = blockMaps[blockId].mcqs.get(id);
      if (q) topicQuestions.push(q);
    }

    // Apply filters
    const filtered = topicQuestions.filter(q => {
      const ans = answers[q.id] || answers[String(q.id)];
      const isBookmarked = bookmarks.has(q.id);

      if (currentFilter === 'unattempted' && ans) return false;
      if (currentFilter === 'wrong' && (!ans || ans.isCorrect)) return false;
      if (currentFilter === 'correct' && (!ans || !ans.isCorrect)) return false;
      if (currentFilter === 'bookmarked' && !isBookmarked) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const textMatch = q.question.toLowerCase().includes(query);
        const tagMatch = (q.tags || []).some(t => t.toLowerCase().includes(query));
        const expMatch = (q.explanation || '').toLowerCase().includes(query);
        const optMatch = Object.values(q.options).some(o => o.toLowerCase().includes(query));
        if (!textMatch && !tagMatch && !expMatch && !optMatch) return false;
      }

      return true;
    });

    // Update sticky score stats
    updateTopicStats(topicQuestions);

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
          <h3>No MCQs found</h3>
          <p>No questions matched your current filter or search criteria.</p>
          <button class="back-btn" style="margin-top: 1rem;" onclick="window.resetFilter()">Reset Filter</button>
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach(q => {
      const ans = answers[q.id] || answers[String(q.id)];
      const isAnswered = !!ans;
      const isBookmarked = bookmarks.has(q.id);

      html += `
        <div class="mcq-card" id="mcq-card-${q.id}">
          <div class="mcq-card-header">
            <div class="mcq-num-tag">
              <span class="mcq-badge">MCQ #${q.id}</span>
              <div class="source-tags">
                ${(q.tags || []).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('')}
              </div>
            </div>
            <button class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" 
                    title="${isBookmarked ? 'Remove bookmark' : 'Bookmark for revision'}" 
                    onclick="window.toggleBookmark(${q.id})">
              ${isBookmarked ? '★' : '☆'}
            </button>
          </div>

          <div class="mcq-stem">${escapeHtml(q.question)}</div>

          <div class="mcq-options-grid">
            ${['A', 'B', 'C', 'D'].map(key => {
              const optText = q.options[key] || '';
              if (!optText) return '';

              let optClass = 'opt-btn';
              let statusIcon = '';

              if (isAnswered) {
                if (key === q.correct) {
                  optClass += ' opt-correct';
                  statusIcon = '<span class="opt-status-icon">✓</span>';
                } else if (ans.selected === key) {
                  optClass += ' opt-wrong';
                  statusIcon = '<span class="opt-status-icon">✗</span>';
                } else {
                  optClass += ' dimmed';
                }
              }

              return `
                <button class="${optClass}" onclick="window.selectOption(${q.id}, '${key}')">
                  <span class="opt-letter">${key}</span>
                  <span class="opt-text">${escapeHtml(optText)}</span>
                  ${statusIcon}
                </button>
              `;
            }).join('')}
          </div>

          <!-- Explanation (Visible upon answering) -->
          <div class="mcq-explanation" id="mcq-exp-${q.id}" style="display: ${isAnswered ? 'block' : 'none'};">
            <div class="explanation-header">
              <span>💡 Exam Pearl & Clinical Insight</span>
            </div>
            <div class="explanation-body">
              ${formatExplanation(q.explanation)}
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function updateTopicStats(topicQuestions) {
    const answers = userAnswers[currentBlockId] || {};
    const total = topicQuestions.length;
    let answered = 0;
    let correct = 0;

    topicQuestions.forEach(q => {
      const a = answers[q.id] || answers[String(q.id)];
      if (a) {
        answered++;
        if (a.isCorrect) correct++;
      }
    });

    const statPill = document.getElementById('topic-stats-pill');
    if (statPill) {
      const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      statPill.innerHTML = `
        <span>Answered: <strong class="stat-pill-val">${answered}/${total}</strong></span>
        <span>•</span>
        <span>Score: <strong class="stat-pill-val">${correct}/${answered} (${accuracy}%)</strong></span>
      `;
    }
  }

  // ==========================================
  // USER ACTIONS
  // ==========================================

  // Immediate Learning Mode: Select Option
  window.selectOption = function (mcqId, chosenKey) {
    const blockId = currentBlockId;
    const q = blockMaps[blockId].mcqs.get(mcqId);
    if (!q) return;

    const isCorrect = chosenKey === q.correct;
    if (!userAnswers[blockId]) userAnswers[blockId] = {};

    const record = {
      selected: chosenKey,
      isCorrect: isCorrect,
      answeredAt: Date.now()
    };

    userAnswers[blockId][mcqId] = record;
    saveProgress(blockId);
    idbSaveAttempt(blockId, mcqId, record);

    // Re-render card immediately
    const cardEl = document.getElementById(`mcq-card-${mcqId}`);
    if (cardEl) {
      const buttons = cardEl.querySelectorAll('.opt-btn');
      const keys = ['A', 'B', 'C', 'D'];

      buttons.forEach((btn, idx) => {
        const key = keys[idx];
        btn.classList.remove('opt-correct', 'opt-wrong', 'dimmed');
        const iconSpan = btn.querySelector('.opt-status-icon');
        if (iconSpan) iconSpan.remove();

        if (key === q.correct) {
          btn.classList.add('opt-correct');
          const span = document.createElement('span');
          span.className = 'opt-status-icon';
          span.style.display = 'inline-block';
          span.textContent = '✓';
          btn.appendChild(span);
        } else if (key === chosenKey) {
          btn.classList.add('opt-wrong');
          const span = document.createElement('span');
          span.className = 'opt-status-icon';
          span.style.display = 'inline-block';
          span.textContent = '✗';
          btn.appendChild(span);
        } else {
          btn.classList.add('dimmed');
        }
      });

      const expEl = document.getElementById(`mcq-exp-${mcqId}`);
      if (expEl) expEl.style.display = 'block';
    }

    // Refresh topic score counter in sticky bar
    if (currentTopicId) {
      const topic = blockMaps[blockId].topics.get(currentTopicId);
      if (topic) {
        const topicQuestions = [];
        for (let id = topic.start; id <= topic.end; id++) {
          const tq = blockMaps[blockId].mcqs.get(id);
          if (tq) topicQuestions.push(tq);
        }
        updateTopicStats(topicQuestions);
      }
    }
  };

  // Toggle Bookmark
  window.toggleBookmark = function (mcqId) {
    const blockId = currentBlockId;
    const bk = userBookmarks[blockId];
    const isNowBookmarked = !bk.has(mcqId);

    if (isNowBookmarked) {
      bk.add(mcqId);
    } else {
      bk.delete(mcqId);
    }

    saveBookmarks(blockId);
    idbSaveBookmark(blockId, mcqId, isNowBookmarked);

    const cardEl = document.getElementById(`mcq-card-${mcqId}`);
    if (cardEl) {
      const btn = cardEl.querySelector('.bookmark-btn');
      if (btn) {
        btn.classList.toggle('bookmarked', isNowBookmarked);
        btn.textContent = isNowBookmarked ? '★' : '☆';
        btn.title = isNowBookmarked ? 'Remove bookmark' : 'Bookmark for revision';
      }
    }

    if (currentFilter === 'bookmarked') {
      renderTopicMCQs();
    }
  };

  // Filter Actions
  window.setFilter = function (filterType) {
    currentFilter = filterType;
    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === filterType);
    });
    renderTopicMCQs();
  };

  window.resetFilter = function () {
    currentFilter = 'all';
    searchQuery = '';
    const input = document.getElementById('topic-search-input');
    if (input) input.value = '';
    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === 'all');
    });
    renderTopicMCQs();
  };

  // Reset Actions (with safety snapshot)
  window.resetCurrentTopicProgress = function () {
    if (!currentTopicId) return;
    const blockId = currentBlockId;
    const topic = blockMaps[blockId].topics.get(currentTopicId);
    if (!topic) return;

    if (!confirm(`Are you sure you want to reset all answers for "${topic.name}"? (A restore snapshot will be created automatically)`)) {
      return;
    }

    createSafetySnapshot(`Reset Topic: ${topic.name}`);

    for (let id = topic.start; id <= topic.end; id++) {
      if (userAnswers[blockId]) delete userAnswers[blockId][id];
    }
    saveProgress(blockId);
    renderTopicMCQs();
    showToast(`Reset answers for ${topic.name}. Snapshot saved!`, '🔄');
  };

  window.resetCurrentBlockProgress = function () {
    const blockId = currentBlockId;
    const blockLabel = blockId === 'block4' ? 'Block 4' : blockId === 'block5' ? 'Block 5' : 'Block 6';
    if (!confirm(`Are you sure you want to reset ALL answers in ${blockLabel}? (A restore snapshot will be created automatically)`)) {
      return;
    }

    createSafetySnapshot(`Reset All ${blockLabel}`);

    userAnswers[blockId] = {};
    saveProgress(blockId);
    showBlockDashboard(blockId);
    showToast(`Reset all answers for ${blockLabel}. Snapshot saved!`, '🔄');
  };

  // Explanation Formatter
  function formatExplanation(rawExp) {
    if (!rawExp) return 'No detailed explanation provided.';
    let text = escapeHtml(rawExp);
    text = text.replace(/(Key note:?)/gi, '<strong style="color: #ea580c;">$1</strong>');
    text = text.replace(/^(Exam Pearl:?)/i, '');
    text = text.replace(/\b4\s+/g, '&rarr; ');
    text = text.replace(/->/g, '&rarr;');
    return text.trim();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    loadState();

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Database modal
    const dbBtn = document.getElementById('db-manager-btn');
    const dbCloseBtn = document.getElementById('db-modal-close-btn');
    const dbDoneBtn = document.getElementById('db-modal-done-btn');
    const dbBackdrop = document.getElementById('db-modal-backdrop');
    const dbExportBtn = document.getElementById('db-export-btn');
    const dbCopyBtn = document.getElementById('db-copy-btn');
    const dbFileInput = document.getElementById('db-import-file-input');
    const dbUndoBtn = document.getElementById('db-undo-reset-btn');

    if (dbBtn) dbBtn.addEventListener('click', openDatabaseModal);
    if (dbCloseBtn) dbCloseBtn.addEventListener('click', closeDatabaseModal);
    if (dbDoneBtn) dbDoneBtn.addEventListener('click', closeDatabaseModal);
    if (dbBackdrop) {
      dbBackdrop.addEventListener('click', e => {
        if (e.target === dbBackdrop) closeDatabaseModal();
      });
    }

    if (dbExportBtn) dbExportBtn.addEventListener('click', exportDatabaseBackup);
    if (dbCopyBtn) dbCopyBtn.addEventListener('click', copyDatabaseBackupToClipboard);
    if (dbFileInput) {
      dbFileInput.addEventListener('change', e => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          importDatabaseBackup(file);
          e.target.value = '';
        }
      });
    }

    if (dbUndoBtn) dbUndoBtn.addEventListener('click', undoLastReset);

    // Search input
    const searchInput = document.getElementById('topic-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        renderTopicMCQs();
      });
    }

    // Filter pills
    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = btn.getAttribute('data-filter');
        window.setFilter(f);
      });
    });

    // Scroll to top
    const scrollBtn = document.getElementById('scroll-top-btn');
    if (scrollBtn) {
      scrollBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Route setup
    window.addEventListener('hashchange', router);
    router();
  }

  // Load state immediately and initialize
  loadState();

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
