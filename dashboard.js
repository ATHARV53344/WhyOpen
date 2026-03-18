// WHYOPEN – Dashboard Script

const DISTRACTION_SITES = [
  'youtube.com','instagram.com','reddit.com','twitter.com','x.com',
  'facebook.com','tiktok.com','netflix.com','twitch.tv','pinterest.com',
  'snapchat.com','discord.com','9gag.com'
];

// ─── Navigation ──────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(`page-${page}`).classList.add('active');

    if (page === 'history') loadHistory();
    if (page === 'sites') loadTopSitesFull();
  });
});

// Check hash for direct navigation
if (location.hash === '#history') {
  document.querySelector('[data-page="history"]').click();
} else if (location.hash === '#settings') {
  document.querySelector('[data-page="settings"]').click();
}

// ─── Clock ────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('liveClock').textContent = `${h}:${m}`;
  document.getElementById('todayDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}
updateClock();
setInterval(updateClock, 1000);

// ─── Load overview stats ──────────────────────────────────────────────────────
async function loadOverview() {
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, (res) => {
    if (chrome.runtime.lastError || !res) return;
    const s = res.stats;

    document.getElementById('cardTabs').textContent = s.tabsOpened || 0;
    document.getElementById('cardPurpose').textContent = s.purposefulTabs || 0;
    document.getElementById('cardDistracted').textContent = s.distractedTabs || 0;
    document.getElementById('cardFocusTime').textContent = formatTime(s.focusedTime || 0);

    const score = s.focusScore || (s.tabsOpened === 0 ? 100 : 0);
    document.getElementById('scoreBig').textContent = score + '%';

    // Ring animation
    const circumference = 314;
    const offset = circumference - (score / 100) * circumference;
    const ring = document.getElementById('scoreRingFill');
    setTimeout(() => {
      ring.style.strokeDashoffset = offset;
      // Color by score
      if (score >= 80) ring.style.stroke = '#4ade80';
      else if (score >= 50) ring.style.stroke = '#6366f1';
      else ring.style.stroke = '#f59e0b';
    }, 100);

    document.getElementById('scoreDesc').textContent = getScoreDesc(score);

    // Time bars
    const focusedSec = s.focusedTime || 0;
    const distractedSec = s.distractedTime || 0;
    const totalSec = focusedSec + distractedSec || 1;
    document.getElementById('focusedTimeStr').textContent = formatTime(focusedSec);
    document.getElementById('distractedTimeStr').textContent = formatTime(distractedSec);
    setTimeout(() => {
      document.getElementById('focusedBar').style.width = ((focusedSec / totalSec) * 100) + '%';
      document.getElementById('distractedBar').style.width = ((distractedSec / totalSec) * 100) + '%';
    }, 200);

    // Top sites mini
    const topSites = s.topSites || {};
    const sorted = Object.entries(topSites).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const distSitesHit = sorted.filter(([domain]) => isDistractionSite(domain)).map(([d]) => d);

    // Distraction sites hit today
    const distList = document.getElementById('distractionSiteList');
    if (distSitesHit.length > 0) {
      distList.innerHTML = distSitesHit.map(d =>
        `<span class="dist-site-chip">⚠️ ${escHtml(d)}</span>`
      ).join('');
    }

    // Top sites mini render
    const miniContainer = document.getElementById('topSitesMini');
    if (sorted.length === 0) {
      miniContainer.innerHTML = '<div style="font-size:12px;color:var(--muted)">No data yet</div>';
    } else {
      miniContainer.innerHTML = sorted.map(([domain, sec], i) => `
        <div class="site-row">
          <span class="site-rank">${i+1}</span>
          <span class="site-favicon">🌐</span>
          <span class="site-name">${escHtml(domain)}</span>
          ${isDistractionSite(domain) ? '<span class="site-distraction-tag">⚠️</span>' : ''}
          <span class="site-time">${formatTime(sec)}</span>
        </div>
      `).join('');
    }
  });
}

// ─── Load history ─────────────────────────────────────────────────────────────
function loadHistory() {
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, (res) => {
    if (chrome.runtime.lastError || !res) return;
    const history = res.history || [];
    const container = document.getElementById('historyList');

    if (history.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📋</span>
          <div class="empty-title">No history yet</div>
          <div class="empty-sub">Start setting purposes for your tabs to see them here</div>
        </div>`;
      return;
    }

    container.innerHTML = history.map(item => `
      <div class="history-item">
        <div class="history-icon">${getReasonEmoji(item.reason)}</div>
        <div class="history-content">
          <div class="history-reason">${escHtml(item.reason)}</div>
          <div class="history-meta">${escHtml(item.domain || 'Unknown site')}</div>
        </div>
        <div class="history-time">${timeAgo(item.timestamp)}</div>
      </div>
    `).join('');
  });
}

// ─── Load top sites full ──────────────────────────────────────────────────────
function loadTopSitesFull() {
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, (res) => {
    if (chrome.runtime.lastError || !res) return;
    const topSites = res.stats?.topSites || {};
    const sorted = Object.entries(topSites).sort((a, b) => b[1] - a[1]);
    const container = document.getElementById('topSitesFull');

    if (sorted.length === 0) {
      container.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:16px 0">No site data yet today</div>';
      return;
    }

    const maxSec = sorted[0]?.[1] || 1;
    container.innerHTML = sorted.map(([domain, sec], i) => `
      <div class="site-row">
        <span class="site-rank">${i+1}</span>
        <span class="site-favicon">🌐</span>
        <span class="site-name">${escHtml(domain)}</span>
        ${isDistractionSite(domain) ? '<span class="site-distraction-tag">⚠️ Distraction</span>' : ''}
        <span class="site-time">${formatTime(sec)}</span>
      </div>
    `).join('');
  });
}

// ─── Focus mode toggle ────────────────────────────────────────────────────────
function loadFocusMode() {
  chrome.runtime.sendMessage({ type: 'GET_FOCUS_MODE' }, (res) => {
    if (chrome.runtime.lastError) return;
    setFocusUI(res?.focusMode || false);
  });
}

function setFocusUI(active) {
  const sw = document.getElementById('focusSidebarSwitch');
  if (active) sw.classList.add('on');
  else sw.classList.remove('on');
}

document.getElementById('focusSidebarToggle').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'TOGGLE_FOCUS_MODE' }, (res) => {
    if (chrome.runtime.lastError) return;
    setFocusUI(res?.focusMode || false);
  });
});

// ─── Settings ─────────────────────────────────────────────────────────────────
async function loadSettings() {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
    if (chrome.runtime.lastError || !res?.settings) return;
    const s = res.settings;

    setToggle('setting-notifications', s.showNotifications !== false);
    setToggle('setting-distraction', s.distractionWarning !== false);
    setToggle('setting-block', s.focusBlockEnabled !== false);
    setToggle('setting-mismatch', s.mismatchDetection !== false);

    const interval = document.getElementById('setting-interval');
    if (s.reminderInterval) interval.value = s.reminderInterval;
  });
}

function setToggle(id, on) {
  const el = document.getElementById(id);
  if (!el) return;
  if (on) el.classList.add('on');
  else el.classList.remove('on');
}

function saveSettings() {
  const settings = {
    showNotifications: document.getElementById('setting-notifications').classList.contains('on'),
    distractionWarning: document.getElementById('setting-distraction').classList.contains('on'),
    focusBlockEnabled: document.getElementById('setting-block').classList.contains('on'),
    mismatchDetection: document.getElementById('setting-mismatch').classList.contains('on'),
    reminderInterval: parseInt(document.getElementById('setting-interval').value)
  };
  chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings });
}

['setting-notifications','setting-distraction','setting-block','setting-mismatch'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', () => {
    el.classList.toggle('on');
    saveSettings();
  });
});

document.getElementById('setting-interval').addEventListener('change', saveSettings);

document.getElementById('clearStatsBtn').addEventListener('click', () => {
  if (confirm('Clear all stats for today? This cannot be undone.')) {
    chrome.runtime.sendMessage({ type: 'CLEAR_STATS' }, () => {
      loadOverview();
      loadHistory();
      loadTopSitesFull();
    });
  }
});

document.getElementById('refreshBtn').addEventListener('click', () => {
  loadOverview();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(seconds) {
  if (!seconds || seconds < 60) return `${Math.floor(seconds || 0)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isDistractionSite(domain) {
  return DISTRACTION_SITES.some(d => domain === d || domain.endsWith('.' + d));
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function getScoreDesc(score) {
  if (score >= 90) return 'Exceptional focus today! 🏆';
  if (score >= 75) return 'Great browsing habits! 🎯';
  if (score >= 50) return 'Decent focus, room to improve';
  if (score >= 25) return 'Getting distracted often';
  return 'High distraction levels today';
}

function getReasonEmoji(reason) {
  const r = reason.toLowerCase();
  if (r.includes('study') || r.includes('learn') || r.includes('research')) return '📚';
  if (r.includes('work') || r.includes('task') || r.includes('project')) return '💼';
  if (r.includes('video') || r.includes('watch') || r.includes('tutorial')) return '📺';
  if (r.includes('read') || r.includes('article') || r.includes('news')) return '📰';
  if (r.includes('email') || r.includes('mail')) return '📧';
  if (r.includes('shop') || r.includes('buy') || r.includes('order')) return '🛒';
  if (r.includes('music') || r.includes('podcast')) return '🎵';
  return '🎯';
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
loadOverview();
loadFocusMode();
loadSettings();
