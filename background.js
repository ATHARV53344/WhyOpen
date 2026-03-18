// WHYOPEN – Background Service Worker (v2 — reasons persisted to storage)

// ── Config ────────────────────────────────────────────────────────────────────
const DEFAULT_SUGGESTIONS = [
  'youtube.com','instagram.com','reddit.com','twitter.com','x.com',
  'facebook.com','tiktok.com','netflix.com','twitch.tv','pinterest.com',
  'snapchat.com','discord.com','linkedin.com','tumblr.com','9gag.com'
];
const BLOCKED_PAGE_URL = chrome.runtime.getURL('blocked.html');

// In-memory tab metadata (non-persistent: timing, domain, etc.)
let tabStore = {};
let lastActiveTabId = null;
let lastActiveTime  = null;

// ── Reason persistence helpers ────────────────────────────────────────────────
// Reasons are stored in chrome.storage.local so they survive SW restarts
// Key: 'tabReasons' → { [tabId]: { reason, openedAt, domain, url } }

async function getTabReasons() {
  const d = await chrome.storage.local.get('tabReasons');
  return d.tabReasons || {};
}

async function saveTabReason(tabId, data) {
  const all = await getTabReasons();
  all[String(tabId)] = data;
  await chrome.storage.local.set({ tabReasons: all });
}

async function deleteTabReason(tabId) {
  const all = await getTabReasons();
  delete all[String(tabId)];
  await chrome.storage.local.set({ tabReasons: all });
}

async function getOneTabReason(tabId) {
  const all = await getTabReasons();
  return all[String(tabId)] || null;
}

// Sync storage reasons back into tabStore on SW wake
async function syncTabStoreFromStorage() {
  const reasons = await getTabReasons();
  // Get all currently open tabs to clean up stale entries
  const tabs = await chrome.tabs.query({});
  const openIds = new Set(tabs.map(t => String(t.id)));

  // Remove reasons for closed tabs
  const cleaned = {};
  for (const [id, data] of Object.entries(reasons)) {
    if (openIds.has(id)) cleaned[id] = data;
  }
  await chrome.storage.local.set({ tabReasons: cleaned });

  // Merge back into tabStore
  for (const [id, data] of Object.entries(cleaned)) {
    const numId = parseInt(id);
    if (!tabStore[numId]) tabStore[numId] = { timeSpent: 0, reminded: false, focused: true, isDistraction: false };
    tabStore[numId].reason    = data.reason;
    tabStore[numId].openedAt  = data.openedAt;
    tabStore[numId].domain    = data.domain || '';
    tabStore[numId].url       = data.url || '';
  }
}

// ── Blocked sites ─────────────────────────────────────────────────────────────
async function getBlockedSites() {
  const d = await chrome.storage.local.get('customBlockedSites');
  return d.customBlockedSites || [];
}

// ── Install / startup ─────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    focusMode: false,
    customBlockedSites: [],
    tabReasons: {},
    dailyStats: emptyStats(),
    statsDate: today(),
    reasonHistory: [],
    settings: {
      reminderInterval: 15,
      showNotifications: true,
      distractionWarning: true,
      focusBlockEnabled: true
    }
  });
  setupAlarms();
  await syncTabStoreFromStorage();
});

chrome.runtime.onStartup.addListener(async () => {
  await refreshStats();
  await syncTabStoreFromStorage();
  setupAlarms();
});

// Sync on every SW wake (handles cases where SW was killed mid-session)
syncTabStoreFromStorage();

// ── Alarms ────────────────────────────────────────────────────────────────────
function setupAlarms() {
  chrome.alarms.create('dailyReset',    { periodInMinutes: 1 });
  chrome.alarms.create('reminderCheck', { periodInMinutes: 1 });
}

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === 'dailyReset')    await refreshStats();
  if (a.name === 'reminderCheck') await checkReminders();
});

// ── Tab lifecycle ─────────────────────────────────────────────────────────────
chrome.tabs.onCreated.addListener(async (tab) => {
  const d = await chrome.storage.local.get('dailyStats');
  const s = d.dailyStats || emptyStats();
  s.tabsOpened = (s.tabsOpened || 0) + 1;
  await chrome.storage.local.set({ dailyStats: s });

  tabStore[tab.id] = {
    reason: null, url: tab.url || '', openedAt: Date.now(),
    domain: getDomain(tab.url || ''), isDistraction: false,
    focused: false, timeSpent: 0, reminded: false, title: ''
  };
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete') return;

  const dom     = getDomain(tab.url || '');
  const blocked = await getBlockedSites();
  const isDist  = isBlocked(dom, blocked);

  // Restore reason from storage if tabStore was wiped by SW restart
  const stored = await getOneTabReason(tabId);

  if (!tabStore[tabId]) {
    tabStore[tabId] = {
      reason: stored?.reason || null,
      url: tab.url, openedAt: stored?.openedAt || Date.now(),
      domain: dom, isDistraction: isDist,
      focused: !!stored?.reason, timeSpent: 0, reminded: false, title: tab.title || ''
    };
  } else {
    tabStore[tabId].domain = dom;
    tabStore[tabId].isDistraction = isDist;
    tabStore[tabId].url = tab.url;
    tabStore[tabId].title = tab.title || '';
    // Restore reason if it was lost
    if (!tabStore[tabId].reason && stored?.reason) {
      tabStore[tabId].reason   = stored.reason;
      tabStore[tabId].openedAt = stored.openedAt;
      tabStore[tabId].focused  = true;
    }
  }

  const st = await chrome.storage.local.get(['focusMode', 'settings']);

  // Focus mode block
  if (st.focusMode && isDist && st.settings?.focusBlockEnabled) {
    if (!tab.url.startsWith(BLOCKED_PAGE_URL)) {
      chrome.tabs.update(tabId, { url: BLOCKED_PAGE_URL + '?site=' + encodeURIComponent(dom) });
      return;
    }
  }

  // Push badge to page
  chrome.tabs.sendMessage(tabId, {
    type: 'SHOW_TAB_BADGE',
    reason: tabStore[tabId]?.reason || null,
    openedAt: tabStore[tabId]?.openedAt || Date.now()
  }).catch(() => {});
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const now = Date.now();

  // Track time on previous tab
  if (lastActiveTabId && lastActiveTime && tabStore[lastActiveTabId]) {
    const secs = Math.floor((now - lastActiveTime) / 1000);
    tabStore[lastActiveTabId].timeSpent = (tabStore[lastActiveTabId].timeSpent || 0) + secs;
    await trackTime(lastActiveTabId, secs);
  }
  lastActiveTabId = tabId;
  lastActiveTime  = now;

  // Restore reason from storage on tab switch (SW may have restarted)
  if (!tabStore[tabId]) tabStore[tabId] = { timeSpent: 0, reminded: false, focused: false, isDistraction: false };
  const stored = await getOneTabReason(tabId);
  if (stored?.reason && !tabStore[tabId].reason) {
    tabStore[tabId].reason   = stored.reason;
    tabStore[tabId].openedAt = stored.openedAt;
    tabStore[tabId].focused  = true;
  }

  if (tabStore[tabId]?.reason && tabStore[tabId]?.reminded) {
    const st = await chrome.storage.local.get('settings');
    if (st.settings?.showNotifications) notify(tabId, tabStore[tabId].reason);
  }
  if (tabStore[tabId]) tabStore[tabId].reminded = true;

  // Push badge
  chrome.tabs.sendMessage(tabId, {
    type: 'SHOW_TAB_BADGE',
    reason: tabStore[tabId]?.reason || null,
    openedAt: tabStore[tabId]?.openedAt || Date.now()
  }).catch(() => {});
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabStore[tabId] && lastActiveTabId === tabId && lastActiveTime) {
    await trackTime(tabId, Math.floor((Date.now() - lastActiveTime) / 1000));
  }
  delete tabStore[tabId];
  await deleteTabReason(tabId);
  if (lastActiveTabId === tabId) { lastActiveTabId = null; lastActiveTime = null; }
});

// ── Messages ──────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {

      case 'SET_REASON': {
        const { tabId, reason } = msg;

        // Get current tab info to persist alongside reason
        let domain = tabStore[tabId]?.domain || '';
        let url    = tabStore[tabId]?.url    || '';
        let openedAt = tabStore[tabId]?.openedAt || Date.now();

        // Update in-memory store
        if (!tabStore[tabId]) tabStore[tabId] = { timeSpent: 0, reminded: false, isDistraction: false };
        tabStore[tabId].reason   = reason;
        tabStore[tabId].focused  = true;
        tabStore[tabId].openedAt = openedAt;

        // ✅ Persist reason to storage so it survives SW restarts
        await saveTabReason(tabId, { reason, domain, url, openedAt });

        // Update daily stats
        const d = await chrome.storage.local.get(['dailyStats', 'reasonHistory']);
        const s = d.dailyStats || emptyStats();
        s.purposefulTabs = (s.purposefulTabs || 0) + 1;

        // Save to reason history
        const hist = d.reasonHistory || [];
        hist.unshift({ reason, domain, url, timestamp: Date.now() });
        if (hist.length > 200) hist.pop();

        await chrome.storage.local.set({ dailyStats: s, reasonHistory: hist });

        // Push badge to page immediately
        chrome.tabs.sendMessage(tabId, {
          type: 'SHOW_TAB_BADGE',
          reason,
          openedAt
        }).catch(() => {});

        sendResponse({ ok: true });
        break;
      }

      case 'SKIP_REASON': {
        const d = await chrome.storage.local.get('dailyStats');
        const s = d.dailyStats || emptyStats();
        s.distractedTabs = (s.distractedTabs || 0) + 1;
        await chrome.storage.local.set({ dailyStats: s });
        sendResponse({ ok: true });
        break;
      }

      case 'GET_TAB_REASON': {
        const tabId = msg.tabId;
        // First check memory, then fall back to storage
        let entry = tabStore[tabId] || null;
        if (!entry?.reason) {
          const stored = await getOneTabReason(tabId);
          if (stored) {
            entry = { ...entry, ...stored };
            // Restore into memory too
            if (!tabStore[tabId]) tabStore[tabId] = {};
            tabStore[tabId].reason   = stored.reason;
            tabStore[tabId].openedAt = stored.openedAt;
            tabStore[tabId].domain   = stored.domain;
            tabStore[tabId].url      = stored.url;
            tabStore[tabId].focused  = true;
          }
        }
        sendResponse({ data: entry || null });
        break;
      }

      case 'GET_REASON_FOR_CURRENT_TAB': {
        const tabId = sender.tab?.id;
        let entry = tabId ? tabStore[tabId] : null;
        // Fall back to storage if memory is empty
        if (!entry?.reason && tabId) {
          const stored = await getOneTabReason(tabId);
          if (stored) {
            if (!tabStore[tabId]) tabStore[tabId] = {};
            tabStore[tabId].reason   = stored.reason;
            tabStore[tabId].openedAt = stored.openedAt;
            tabStore[tabId].focused  = true;
            entry = tabStore[tabId];
          }
        }
        sendResponse({ reason: entry?.reason || null, openedAt: entry?.openedAt || null });
        break;
      }

      case 'SAVE_REASON_FROM_PAGE': {
        const tabId = sender.tab?.id;
        const { reason } = msg;
        if (tabId) {
          const openedAt = tabStore[tabId]?.openedAt || Date.now();
          const domain   = tabStore[tabId]?.domain   || getDomain(sender.tab?.url || '');
          const url      = tabStore[tabId]?.url      || sender.tab?.url || '';

          if (!tabStore[tabId]) tabStore[tabId] = { timeSpent: 0, reminded: false, isDistraction: false };
          tabStore[tabId].reason   = reason;
          tabStore[tabId].focused  = true;
          tabStore[tabId].openedAt = openedAt;

          // Persist to storage
          await saveTabReason(tabId, { reason, domain, url, openedAt });

          const d = await chrome.storage.local.get(['dailyStats', 'reasonHistory']);
          const s = d.dailyStats || emptyStats();
          s.purposefulTabs = (s.purposefulTabs || 0) + 1;
          const hist = d.reasonHistory || [];
          hist.unshift({ reason, domain, url, timestamp: Date.now() });
          if (hist.length > 200) hist.pop();
          await chrome.storage.local.set({ dailyStats: s, reasonHistory: hist });

          // Push updated badge to the page
          chrome.tabs.sendMessage(tabId, {
            type: 'SHOW_TAB_BADGE',
            reason,
            openedAt: tabStore[tabId]?.openedAt || Date.now()
          }).catch(() => {});
        }
        sendResponse({ ok: true });
        break;
      }

      case 'GET_STATS': {
        const d = await chrome.storage.local.get(['dailyStats', 'reasonHistory']);
        sendResponse({ stats: d.dailyStats || emptyStats(), history: d.reasonHistory || [] });
        break;
      }

      case 'TOGGLE_FOCUS_MODE': {
        const d    = await chrome.storage.local.get('focusMode');
        const next = !d.focusMode;
        await chrome.storage.local.set({ focusMode: next });
        if (next) chrome.notifications.create('fm', {
          type: 'basic', iconUrl: 'icons/icon48.png',
          title: '🎯 Focus Mode ON',
          message: 'Your blocked sites are now blocked!'
        });
        sendResponse({ focusMode: next });
        break;
      }

      case 'GET_FOCUS_MODE': {
        const d = await chrome.storage.local.get('focusMode');
        sendResponse({ focusMode: d.focusMode || false });
        break;
      }

      case 'GET_BLOCKED_SITES':
        sendResponse({ sites: await getBlockedSites() });
        break;

      case 'SAVE_BLOCKED_SITES':
        await chrome.storage.local.set({ customBlockedSites: msg.sites });
        sendResponse({ ok: true });
        break;

      case 'GET_SUGGESTIONS':
        sendResponse({ suggestions: DEFAULT_SUGGESTIONS });
        break;

      case 'SAVE_SETTINGS':
        await chrome.storage.local.set({ settings: msg.settings });
        sendResponse({ ok: true });
        break;

      case 'GET_SETTINGS': {
        const d = await chrome.storage.local.get('settings');
        sendResponse({ settings: d.settings });
        break;
      }

      case 'DELETE_TAB_REASON': {
        // Called when user marks a purpose as done
        const tabId = sender.tab?.id || msg.tabId;
        if (tabId) {
          if (tabStore[tabId]) {
            tabStore[tabId].reason  = null;
            tabStore[tabId].focused = false;
          }
          await deleteTabReason(tabId);
        }
        sendResponse({ ok: true });
        break;
      }

      case 'CLEAR_STATS':
        await chrome.storage.local.set({
          dailyStats: emptyStats(),
          statsDate: today(),
          reasonHistory: []
        });
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({});
    }
  })();
  return true;
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function notify(tabId, reason) {
  chrome.notifications.create('r-' + tabId + '-' + Date.now(), {
    type: 'basic', iconUrl: 'icons/icon48.png',
    title: '🧠 Remember your purpose',
    message: 'You opened this tab to: "' + reason + '"',
    priority: 1
  });
}

async function checkReminders() {
  const st = await chrome.storage.local.get('settings');
  const ms = (st.settings?.reminderInterval || 15) * 60000;
  // Sync from storage before checking (SW may have restarted)
  await syncTabStoreFromStorage();
  for (const [id, d] of Object.entries(tabStore)) {
    if (d.reason && d.focused && (Date.now() - (d.openedAt||0)) > ms && st.settings?.showNotifications) {
      notify(parseInt(id), d.reason);
    }
  }
}

async function trackTime(tabId, secs) {
  if (!tabStore[tabId]) return;
  const d = await chrome.storage.local.get('dailyStats');
  const s = d.dailyStats || emptyStats();
  if (tabStore[tabId].focused && !tabStore[tabId].isDistraction) s.focusedTime = (s.focusedTime || 0) + secs;
  else s.distractedTime = (s.distractedTime || 0) + secs;
  const dom = tabStore[tabId].domain;
  if (dom) { s.topSites = s.topSites || {}; s.topSites[dom] = (s.topSites[dom] || 0) + secs; }
  const tot = (s.focusedTime || 0) + (s.distractedTime || 0);
  s.focusScore = tot > 0 ? Math.round((s.focusedTime / tot) * 100) : 100;
  await chrome.storage.local.set({ dailyStats: s });
}

function emptyStats() {
  return { tabsOpened: 0, purposefulTabs: 0, distractedTabs: 0, focusedTime: 0, distractedTime: 0, focusScore: 100, topSites: {} };
}

async function refreshStats() {
  const d = await chrome.storage.local.get(['statsDate', 'dailyStats']);
  if (d.statsDate !== today()) {
    const arc = await chrome.storage.local.get('statsArchive');
    const h = arc.statsArchive || [];
    if (d.dailyStats && d.statsDate) { h.unshift({ date: d.statsDate, ...d.dailyStats }); if (h.length > 30) h.pop(); }
    await chrome.storage.local.set({ dailyStats: emptyStats(), statsDate: today(), statsArchive: h });
  }
}

function getDomain(url) { try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; } }
function isBlocked(dom, list) { return list.some(d => dom === d || dom.endsWith('.' + d)); }
function today() { return new Date().toISOString().split('T')[0]; }
