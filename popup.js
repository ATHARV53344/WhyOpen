// WHYOPEN – Popup Script (clean)

let currentTab = null;
let blockedSites = [];
let isFocusActive = false;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  await Promise.all([loadBlocked(), loadFocus()]);
  loadReason(tab);
  loadStats();
  setupPrompt(tab);
  setupFocusModal();
  setupLinks();
  setTimeout(() => document.getElementById('whyInput')?.focus(), 50);
}

// ── Load helpers ──────────────────────────────────────────────────────────────
function loadBlocked() {
  return new Promise(r => {
    chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' }, res => {
      blockedSites = res?.sites || [];
      r();
    });
  });
}

function loadFocus() {
  return new Promise(r => {
    chrome.runtime.sendMessage({ type: 'GET_FOCUS_MODE' }, res => {
      isFocusActive = res?.focusMode || false;
      setFocusUI(isFocusActive);
      r();
    });
  });
}

function loadReason(tab) {
  chrome.runtime.sendMessage({ type: 'GET_TAB_REASON', tabId: tab.id }, res => {
    const data = res?.data;
    const el = document.getElementById('currentReason');
    if (!el) return;
    if (data?.reason) {
      const dom = getDomain(tab.url || '');
      const ago = data.openedAt ? timeAgo(data.openedAt) : '';
      el.innerHTML =
        '<div class="reason-card">' +
          '<div class="reason-text">"' + esc(data.reason) + '"</div>' +
          (ago ? '<div class="reason-meta">Set ' + ago + ' · ' + esc(dom) + '</div>' : '') +
          '<div class="reason-actions">' +
            '<button class="btn-done-purpose" id="btnDone">🎉 Mark as Done</button>' +
            '<button class="btn-delete-purpose" id="btnDelete">🗑 Delete</button>' +
          '</div>' +
        '</div>';

      // Wire done button
      document.getElementById('btnDone')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'DELETE_TAB_REASON', tabId: tab.id }, () => {
          // Tell content script to refresh badge
          chrome.tabs.sendMessage(tab.id, { type: 'REFRESH_BADGE' }, () => { chrome.runtime.lastError; });
          loadReason(tab);
          loadStats();
        });
      });

      // Wire delete button
      document.getElementById('btnDelete')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'DELETE_TAB_REASON', tabId: tab.id }, () => {
          chrome.tabs.sendMessage(tab.id, { type: 'REFRESH_BADGE' }, () => { chrome.runtime.lastError; });
          loadReason(tab);
          loadStats();
        });
      });

    } else {
      el.innerHTML = '<div class="no-reason">No purpose set — type one above ↑</div>';
    }
  });
}

function loadStats() {
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, res => {
    if (!res) return;
    const s = res.stats;
    setText('statTabs',    s.tabsOpened    || 0);
    setText('statPurpose', s.purposefulTabs|| 0);
    setText('statScore',   (s.focusScore != null ? s.focusScore : 100) + '%');
  });
}

// ── WHY prompt ────────────────────────────────────────────────────────────────
function setupPrompt(tab) {
  const input  = document.getElementById('whyInput');
  const setBtn = document.getElementById('setBtn');
  const skipBtn= document.getElementById('skipBtn');

  input.addEventListener('input', () => { setBtn.disabled = input.value.trim().length < 2; });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !setBtn.disabled) save(); });
  setBtn.addEventListener('click', save);
  skipBtn.addEventListener('click', () => window.close());

  document.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => { input.value = c.dataset.val; input.dispatchEvent(new Event('input')); input.focus(); });
  });

  function save() {
    const reason = input.value.trim();
    if (!reason) return;
    chrome.runtime.sendMessage({ type: 'SET_REASON', tabId: tab.id, reason }, () => {
      if (chrome.runtime.lastError) return;

      // Show success banner
      const banner = document.getElementById('successBanner');
      document.getElementById('successText').textContent = '"' + reason + '"';
      banner.classList.add('show');
      setBtn.disabled = true;
      input.value = '';

      // Refresh the current reason display in popup immediately
      loadReason(tab);
      loadStats();

      // Tell the content script on the page to refresh its badge NOW
      chrome.tabs.sendMessage(tab.id, { type: 'REFRESH_BADGE' }, () => {
        // Ignore errors (page may not have content script loaded)
        chrome.runtime.lastError;
      });

      setTimeout(() => window.close(), 1200);
    });
  }
}

// ── Focus modal ───────────────────────────────────────────────────────────────
function setupFocusModal() {
  const toggle     = document.getElementById('focusToggle');
  const modal      = document.getElementById('focusModal');
  const cancelBtn  = document.getElementById('cancelBtn');
  const activateBtn= document.getElementById('activateBtn');
  const turnOffBtn = document.getElementById('turnOffBtn');
  const editBtn    = document.getElementById('editSitesBtn');
  const addBtn     = document.getElementById('addSiteBtn');
  const siteInput  = document.getElementById('siteInput');

  toggle.addEventListener('click', openModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  cancelBtn.addEventListener('click', closeModal);
  addBtn.addEventListener('click', addSite);
  siteInput.addEventListener('keydown', e => { if (e.key === 'Enter') addSite(); });

  activateBtn.addEventListener('click', () => {
    if (blockedSites.length === 0) {
      siteInput.focus();
      siteInput.placeholder = '⚠️ Add at least one site!';
      setTimeout(() => { siteInput.placeholder = 'e.g. instagram.com'; }, 2000);
      return;
    }
    chrome.runtime.sendMessage({ type: 'SAVE_BLOCKED_SITES', sites: blockedSites }, () => {
      if (!isFocusActive) {
        chrome.runtime.sendMessage({ type: 'TOGGLE_FOCUS_MODE' }, r => {
          isFocusActive = r?.focusMode || true;
          setFocusUI(true);
          closeModal();
        });
      } else { closeModal(); }
    });
  });

  turnOffBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TOGGLE_FOCUS_MODE' }, r => {
      isFocusActive = r?.focusMode || false;
      setFocusUI(false);
      closeModal();
    });
  });

  editBtn.addEventListener('click', () => showSetup());

  function openModal() {
    modal.classList.add('show');
    if (isFocusActive) showActive();
    else showSetup();
  }
  function closeModal() { modal.classList.remove('show'); }

  function showSetup() {
    document.getElementById('modalSetup').style.display = 'block';
    document.getElementById('modalActive').style.display = 'none';
    renderSuggestions(); renderList();
    setTimeout(() => siteInput.focus(), 80);
  }

  function showActive() {
    document.getElementById('modalSetup').style.display = 'none';
    document.getElementById('modalActive').style.display = 'block';
    const p = document.getElementById('activeSitesPreview');
    p.innerHTML = blockedSites.length
      ? 'Blocking: <strong style="color:#f0eeff">' + esc(blockedSites.join(', ')) + '</strong>'
      : 'No sites configured.';
  }

  function addSite() {
    let v = siteInput.value.trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!v) return;
    if (!v.includes('.')) v += '.com';
    if (!blockedSites.includes(v)) {
      blockedSites.push(v);
      chrome.runtime.sendMessage({ type: 'SAVE_BLOCKED_SITES', sites: blockedSites });
    }
    siteInput.value = '';
    renderList(); renderSuggestions();
    siteInput.focus();
  }

  function removeSite(s) {
    blockedSites = blockedSites.filter(b => b !== s);
    chrome.runtime.sendMessage({ type: 'SAVE_BLOCKED_SITES', sites: blockedSites });
    renderList(); renderSuggestions();
  }

  function renderList() {
    const el = document.getElementById('blockedList');
    if (!el) return;
    if (!blockedSites.length) { el.innerHTML = '<span class="empty-list">No sites added yet</span>'; return; }
    el.innerHTML = blockedSites.map(s =>
      '<span class="blocked-tag">' + esc(s) +
        '<button class="blocked-tag-remove" data-s="' + esc(s) + '">×</button>' +
      '</span>'
    ).join('');
    el.querySelectorAll('.blocked-tag-remove').forEach(b => b.addEventListener('click', () => removeSite(b.dataset.s)));
  }

  function renderSuggestions() {
    chrome.runtime.sendMessage({ type: 'GET_SUGGESTIONS' }, res => {
      const list = res?.suggestions || [];
      const el = document.getElementById('suggestionPills');
      if (!el) return;
      el.innerHTML = list.map(s =>
        '<span class="suggestion-pill' + (blockedSites.includes(s) ? ' added' : '') + '" data-s="' + esc(s) + '">' + esc(s) + '</span>'
      ).join('');
      el.querySelectorAll('.suggestion-pill:not(.added)').forEach(p => {
        p.addEventListener('click', () => {
          if (!blockedSites.includes(p.dataset.s)) {
            blockedSites.push(p.dataset.s);
            chrome.runtime.sendMessage({ type: 'SAVE_BLOCKED_SITES', sites: blockedSites });
            renderList(); renderSuggestions();
          }
        });
      });
    });
  }
}

function setFocusUI(on) {
  isFocusActive = on;
  document.getElementById('focusToggle').classList.toggle('active', on);
  document.getElementById('focusLabel').textContent = on ? 'Focus: ON' : 'Focus Mode';
}

// ── Footer ────────────────────────────────────────────────────────────────────
function setupLinks() {
  document.getElementById('dashLink').addEventListener('click', () => { chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }); window.close(); });
  document.getElementById('historyLink').addEventListener('click', () => { chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') + '#history' }); window.close(); });
  document.getElementById('settingsLink').addEventListener('click', () => { chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') + '#settings' }); window.close(); });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDomain(url) { try { return new URL(url).hostname.replace('www.',''); } catch { return ''; } }
function timeAgo(ts) {
  const s = Math.floor((Date.now()-ts)/1000);
  if (s < 60) return s+'s ago';
  if (s < 3600) return Math.floor(s/60)+'m ago';
  return Math.floor(s/3600)+'h ago';
}
function esc(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; }
function setText(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

init();
