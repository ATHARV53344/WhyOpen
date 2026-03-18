// WHYOPEN – New Tab Page Script

// Focus input ASAP — must be at top of file, runs before init()
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('reasonInput');
  if (input) { input.focus(); input.select(); }
});

const DISTRACTION_SITES = [
  'youtube.com','instagram.com','reddit.com','twitter.com','x.com',
  'facebook.com','tiktok.com','netflix.com','twitch.tv','pinterest.com',
  'snapchat.com','discord.com','linkedin.com','tumblr.com','9gag.com'
];

let currentTabId = null;

// ─── Clock ────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('clock').textContent = `${h}:${m}`;
  document.getElementById('dateStr').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  }).toUpperCase();
}

updateClock();
setInterval(updateClock, 1000);

// ─── Get current tab info ────────────────────────────────────────────────────
async function getCurrentTab() {
  return new Promise(resolve => {
    chrome.tabs.getCurrent(resolve);
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const tab = await getCurrentTab();
  if (tab) currentTabId = tab.id;

  setupEventListeners();
  await loadStats();
  await loadRecentReasons();
  await checkFocusMode();

  // Aggressively focus the input — Chrome new tab pages can be tricky
  const focusInput = () => {
    const input = document.getElementById('reasonInput');
    if (input && document.getElementById('promptForm').style.display !== 'none') {
      input.focus();
    }
  };

  // Fire multiple times to beat Chrome's new tab focus quirks
  focusInput();
  [50, 150, 300, 600, 1000].forEach(ms => setTimeout(focusInput, ms));

  // Re-focus if user clicks anywhere on the background (not a button)
  document.addEventListener('click', (e) => {
    const tag = e.target.tagName;
    const isInteractive = tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' ||
      tag === 'SELECT' || e.target.closest('button') || e.target.closest('a');
    if (!isInteractive) focusInput();
  });
}

// ─── Stats ────────────────────────────────────────────────────────────────────
async function loadStats() {
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, (res) => {
    if (chrome.runtime.lastError || !res) return;
    const s = res.stats;
    document.getElementById('statTabs').textContent = s.tabsOpened || 0;
    document.getElementById('statPurpose').textContent = s.purposefulTabs || 0;
    document.getElementById('statScore').textContent = (s.focusScore || 100) + '%';
  });
}

// ─── Recent reasons ───────────────────────────────────────────────────────────
async function loadRecentReasons() {
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, (res) => {
    if (chrome.runtime.lastError || !res) return;
    const history = res.history || [];
    const recent = [...new Set(history.map(h => h.reason))].slice(0, 5);
    if (recent.length === 0) return;

    const section = document.getElementById('recentSection');
    const container = document.getElementById('recentItems');
    section.style.display = 'block';
    container.innerHTML = recent.map(r =>
      `<span class="recent-item">${escHtml(r)}</span>`
    ).join('');

    container.querySelectorAll('.recent-item').forEach(el => {
      el.addEventListener('click', () => {
        document.getElementById('reasonInput').value = el.textContent;
        document.getElementById('reasonInput').dispatchEvent(new Event('input'));
        document.getElementById('reasonInput').focus();
      });
    });
  });
}

// ─── Focus mode ───────────────────────────────────────────────────────────────
async function checkFocusMode() {
  chrome.runtime.sendMessage({ type: 'GET_FOCUS_MODE' }, (res) => {
    if (chrome.runtime.lastError) return;
    setFocusUI(res?.focusMode || false);
  });
}

function setFocusUI(active) {
  const badge = document.getElementById('focusToggle');
  const label = document.getElementById('focusLabel');
  if (active) {
    badge.classList.add('active');
    label.textContent = 'Focus: ON';
  } else {
    badge.classList.remove('active');
    label.textContent = 'Focus Mode';
  }
}

// ─── Distraction detection ────────────────────────────────────────────────────
function checkDistractionSite() {
  // On newtab page, check if previous page was distraction
  // We can check referrer or just skip on newtab itself
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function setupEventListeners() {
  const input = document.getElementById('reasonInput');
  const saveBtn = document.getElementById('saveBtn');
  const skipBtn = document.getElementById('skipBtn');
  const charCount = document.getElementById('charCount');
  const focusToggle = document.getElementById('focusToggle');
  const dashLink = document.getElementById('dashLink');

  dashLink.href = chrome.runtime.getURL('dashboard.html');

  input.addEventListener('input', () => {
    const val = input.value.trim();
    const len = input.value.length;
    charCount.textContent = `${len}/120`;
    saveBtn.disabled = val.length < 2;
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !saveBtn.disabled) {
      saveReason();
    }
    if (e.key === 'Escape') {
      skipReason();
    }
  });

  saveBtn.addEventListener('click', saveReason);
  skipBtn.addEventListener('click', skipReason);

  // Suggestion chips
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      input.value = chip.dataset.val;
      input.dispatchEvent(new Event('input'));
      input.focus();
    });
  });

  focusToggle.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TOGGLE_FOCUS_MODE' }, (res) => {
      if (chrome.runtime.lastError) return;
      setFocusUI(res?.focusMode || false);
    });
  });
}

function saveReason() {
  const input = document.getElementById('reasonInput');
  const reason = input.value.trim();
  if (!reason || reason.length < 2) return;

  if (currentTabId !== null) {
    chrome.runtime.sendMessage({
      type: 'SET_REASON',
      tabId: currentTabId,
      reason
    }, () => {
      if (chrome.runtime.lastError) return;
      showSuccess(reason);
    });
  } else {
    showSuccess(reason);
  }
}

function skipReason() {
  if (currentTabId !== null) {
    chrome.runtime.sendMessage({ type: 'SKIP_REASON', tabId: currentTabId });
  }
  // Show a gentle "skipped" state instead of navigating away
  document.getElementById('promptForm').style.display = 'none';
  const successState = document.getElementById('successState');
  successState.style.display = 'flex';
  document.getElementById('successReason').textContent = 'No purpose set — browse freely.';
  document.querySelector('.success-icon').textContent = '👋';
  document.querySelector('.success-title').textContent = 'Skipped';
  document.querySelector('.success-hint').textContent = 'Open a new tab anytime to set a purpose';
}

function showSuccess(reason) {
  document.getElementById('promptForm').style.display = 'none';
  const successState = document.getElementById('successState');
  successState.style.display = 'flex';
  document.getElementById('successReason').textContent = `"${reason}"`;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

init();
