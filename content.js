// WHYOPEN – Content Script

(function () {
  'use strict';

  if (location.protocol === 'chrome-extension:') return;
  if (location.protocol === 'chrome:') return;

  let badge = null;

  // ── Styles ──────────────────────────────────────────────────────────────────
  function addStyles() {
    if (document.getElementById('wo-css')) return;
    const el = document.createElement('style');
    el.id = 'wo-css';
    el.textContent = `
      #wo-badge {
        all: initial;
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
      }
      #wo-badge *, #wo-badge *::before, #wo-badge *::after { box-sizing: border-box; font-family: inherit; }
      #wo-pill {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(13,13,22,0.93);
        border: 1.5px solid rgba(99,102,241,0.5);
        border-radius: 22px;
        padding: 7px 13px 7px 8px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.5);
        backdrop-filter: blur(12px);
        transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
        max-width: 260px;
        overflow: hidden;
        animation: woIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
      }
      @keyframes woIn { from{opacity:0;transform:translateY(14px) scale(0.9)} to{opacity:1;transform:translateY(0) scale(1)} }
      #wo-badge:hover #wo-pill {
        border-color: rgba(99,102,241,0.85);
        box-shadow: 0 6px 28px rgba(99,102,241,0.3);
        transform: translateY(-2px);
      }
      #wo-icon {
        width: 22px; height: 22px;
        background: linear-gradient(135deg,#6366f1,#8b5cf6);
        border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; flex-shrink: 0; color: white;
      }
      #wo-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #818cf8; flex-shrink: 0; }
      #wo-dot { width: 3px; height: 3px; background: rgba(255,255,255,0.2); border-radius: 50%; flex-shrink: 0; }
      #wo-txt { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.88); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      #wo-txt.wo-empty { color: rgba(255,255,255,0.3); font-style: italic; font-weight: 400; }
      /* Hover card */
      #wo-card {
        display: none;
        position: absolute;
        bottom: calc(100% + 10px);
        right: 0;
        width: 268px;
        background: rgba(13,13,22,0.98);
        border: 1.5px solid rgba(99,102,241,0.4);
        border-radius: 16px;
        padding: 14px 15px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        backdrop-filter: blur(20px);
        animation: woCardIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both;
      }
      @keyframes woCardIn { from{opacity:0;transform:translateY(6px) scale(0.97)} to{opacity:1;transform:none} }
      #wo-badge:hover #wo-card { display: block; }
      #wo-card-eyebrow { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #818cf8; margin-bottom: 8px; }
      #wo-card-reason {
        font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.95);
        line-height: 1.5; padding: 9px 11px;
        background: rgba(99,102,241,0.1);
        border-left: 3px solid #6366f1;
        border-radius: 8px; margin-bottom: 9px;
        word-break: break-word; white-space: normal; user-select: text;
      }
      #wo-card-reason.wo-empty-reason {
        color: rgba(255,255,255,0.3); border-left-color: rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.03); font-weight: 400; font-style: italic;
      }
      #wo-card-meta { font-size: 10px; color: rgba(255,255,255,0.25); margin-bottom: 9px; font-family: monospace; }
      #wo-btns { display: flex; gap: 6px; }
      .wo-btn {
        flex: 1; padding: 7px 5px; border-radius: 8px;
        border: 1px solid transparent; font-size: 11px; font-weight: 700;
        cursor: pointer; transition: background 0.15s; text-align: center;
        white-space: nowrap; background: none; color: white;
      }
      #wo-btn-ok  { background: rgba(74,222,128,0.1); border-color: rgba(74,222,128,0.28); color: #4ade80; }
      #wo-btn-ok:hover  { background: rgba(74,222,128,0.2); }
      #wo-btn-edit { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.3); color: #a5b4fc; }
      #wo-btn-edit:hover { background: rgba(99,102,241,0.2); }
      #wo-btn-done { background: rgba(251,191,36,0.1); border-color: rgba(251,191,36,0.28); color: #fbbf24; flex: 0 0 auto; padding: 7px 9px; }
      #wo-btn-done:hover { background: rgba(251,191,36,0.2); }
      #wo-edit-row { display: none; gap: 6px; margin-top: 8px; }
      #wo-edit-row.wo-show { display: flex; }
      #wo-edit-input {
        flex: 1; background: rgba(255,255,255,0.07);
        border: 1px solid rgba(99,102,241,0.45); border-radius: 8px;
        padding: 7px 10px; color: white; font-size: 12px; font-weight: 600;
        outline: none; caret-color: #6366f1; min-width: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      #wo-edit-input:focus { border-color: rgba(99,102,241,0.7); }
      #wo-edit-save {
        background: #6366f1; border: none; border-radius: 8px;
        padding: 7px 11px; color: white; font-size: 12px;
        font-weight: 700; cursor: pointer; flex-shrink: 0;
      }
      #wo-edit-save:hover { background: #4f52d8; }
      /* Toast */
      #wo-done-confirm {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        width: 268px;
        background: rgba(13,13,22,0.98);
        border: 1.5px solid rgba(74,222,128,0.4);
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        backdrop-filter: blur(20px);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        animation: woIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
        display: none;
      }
      #wo-done-confirm.wo-show { display: block; }
      #wo-done-title { font-size: 18px; text-align: center; margin-bottom: 8px; }
      #wo-done-msg { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.6); text-align: center; line-height: 1.5; margin-bottom: 14px; }
      #wo-done-reason-txt { color: #4ade80; font-weight: 800; }
      #wo-done-btns { display: flex; gap: 8px; }
      #wo-done-yes {
        flex: 1; background: linear-gradient(135deg,#4ade80,#22c55e);
        border: none; border-radius: 10px; padding: 10px;
        color: #000; font-size: 13px; font-weight: 800;
        cursor: pointer; font-family: inherit; transition: opacity 0.15s;
      }
      #wo-done-yes:hover { opacity: 0.85; }
      #wo-done-no {
        flex: 1; background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
        padding: 10px; color: rgba(255,255,255,0.5);
        font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit;
      }
      #wo-done-no:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); }
      #wo-toast {
        position: fixed; top: 16px; left: 50%;
        transform: translateX(-50%) translateY(-80px);
        z-index: 2147483647;
        background: rgba(245,158,11,0.95); border-radius: 12px;
        padding: 10px 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px; font-weight: 700; color: #000;
        box-shadow: 0 8px 32px rgba(245,158,11,0.45);
        transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
        pointer-events: none; max-width: 90vw; text-align: center;
      }
      #wo-toast.wo-show { transform: translateX(-50%) translateY(0); }
    `;
    (document.head || document.documentElement).appendChild(el);
  }

  // ── Build badge ─────────────────────────────────────────────────────────────
  function buildBadge(reason, openedAt) {
    addStyles();
    if (badge) badge.remove();

    const has = !!(reason && reason.trim());
    const dom = location.hostname.replace('www.', '') || 'this page';
    const ago = openedAt ? timeAgo(openedAt) : '';

    badge = document.createElement('div');
    badge.id = 'wo-badge';
    badge.innerHTML =
      '<div id="wo-card">' +
        '<div id="wo-card-eyebrow">🎯 Purpose for this tab</div>' +
        '<div id="wo-card-reason" class="' + (has ? '' : 'wo-empty-reason') + '">' +
          (has ? x(reason) : 'No purpose set — click below to add') +
        '</div>' +
        '<div id="wo-card-meta">' + x(dom) + (ago ? ' · opened ' + ago : '') + '</div>' +
        '<div id="wo-btns">' +
          (has ? '<button class="wo-btn" id="wo-btn-ok">✓ Still focused</button>' : '') +
          '<button class="wo-btn" id="wo-btn-edit">' + (has ? '✏️ Update' : '+ Set purpose') + '</button>' +
          (has ? '<button class="wo-btn" id="wo-btn-done">🎉 Done</button>' : '') +
        '</div>' +
        '<div id="wo-edit-row">' +
          '<input id="wo-edit-input" placeholder="What\'s your goal?" maxlength="100" />' +
          '<button id="wo-edit-save">→</button>' +
        '</div>' +
      '</div>' +
      '<div id="wo-pill">' +
        '<div id="wo-icon">🧠</div>' +
        '<span id="wo-lbl">Why</span>' +
        '<span id="wo-dot"></span>' +
        '<span id="wo-txt" class="' + (has ? '' : 'wo-empty') + '">' +
          (has ? x(reason) : 'Tap to set purpose') +
        '</span>' +
      '</div>';

    (document.body || document.documentElement).appendChild(badge);
    wireEvents(reason);
  }

  function wireEvents(currentReason) {
    const editBtn   = document.getElementById('wo-btn-edit');
    const okBtn     = document.getElementById('wo-btn-ok');
    const editRow   = document.getElementById('wo-edit-row');
    const editInput = document.getElementById('wo-edit-input');
    const editSave  = document.getElementById('wo-edit-save');

    if (okBtn) {
      okBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        okBtn.textContent = '✓ Keep it up!';
        setTimeout(() => { if (okBtn) okBtn.textContent = '✓ Still focused'; }, 1500);
      });
    }

    const doneBtn = document.getElementById('wo-btn-done');
    if (doneBtn) {
      doneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDoneConfirm(currentReason);
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editRow.classList.add('wo-show');
        if (currentReason) editInput.value = currentReason;
        editInput.focus();
        editBtn.style.display = 'none';
        if (okBtn) okBtn.style.display = 'none';
      });
    }

    function doSave() {
      const val = editInput.value.trim();
      if (!val) return;
      chrome.runtime.sendMessage({ type: 'SAVE_REASON_FROM_PAGE', reason: val }, () => {
        if (chrome.runtime.lastError) return;
        buildBadge(val, Date.now());
      });
    }

    if (editSave)  editSave.addEventListener('click',  (e) => { e.stopPropagation(); doSave(); });
    if (editInput) {
      editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { e.stopPropagation(); doSave(); }
        if (e.key === 'Escape') { e.stopPropagation(); editRow.classList.remove('wo-show'); }
      });
      editInput.addEventListener('click', (e) => e.stopPropagation());
    }
  }

  // ── Done confirmation ───────────────────────────────────────────────────────
  function showDoneConfirm(reason) {
    // Remove existing
    const existing = document.getElementById('wo-done-confirm');
    if (existing) existing.remove();
    if (badge) badge.remove(); badge = null;

    const el = document.createElement('div');
    el.id = 'wo-done-confirm';
    el.classList.add('wo-show');
    el.innerHTML =
      '<div id="wo-done-title">🎉</div>' +
      '<div id="wo-done-msg">Did you finish:<br><span id="wo-done-reason-txt">' + x(reason) + '</span>?</div>' +
      '<div id="wo-done-btns">' +
        '<button id="wo-done-yes">✓ Yes, done!</button>' +
        '<button id="wo-done-no">Not yet</button>' +
      '</div>';
    (document.body || document.documentElement).appendChild(el);

    document.getElementById('wo-done-yes').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'DELETE_TAB_REASON' }, () => {
        el.remove();
        // Show empty badge
        buildBadge(null, null);
        // Flash a completion toast
        showCompletionToast(reason);
      });
    });

    document.getElementById('wo-done-no').addEventListener('click', () => {
      el.remove();
      buildBadge(reason, null);
    });

    // Auto close after 8s
    setTimeout(() => {
      if (document.getElementById('wo-done-confirm')) {
        el.remove();
        buildBadge(reason, null);
      }
    }, 8000);
  }

  function showCompletionToast(reason) {
    addStyles();
    let t = document.getElementById('wo-toast');
    if (t) t.remove();
    t = document.createElement('div');
    t.id = 'wo-toast';
    t.style.background = 'rgba(74,222,128,0.95)';
    t.style.color = '#000';
    t.innerHTML = '🎉 Purpose completed: <strong>' + x(reason) + '</strong>';
    (document.body || document.documentElement).appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('wo-show')));
    setTimeout(() => { t.classList.remove('wo-show'); setTimeout(() => t.remove(), 400); }, 4000);
  }

  // ── Toast ───────────────────────────────────────────────────────────────────
  function showToast(dom, reason) {
    addStyles();
    let t = document.getElementById('wo-toast');
    if (t) t.remove();
    t = document.createElement('div');
    t.id = 'wo-toast';
    t.innerHTML = '⚠️ <strong>' + x(dom) + '</strong> is blocked. Goal: <em>"' + x(reason) + '"</em>';
    (document.body || document.documentElement).appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('wo-show')));
    setTimeout(() => { t.classList.remove('wo-show'); setTimeout(() => t.remove(), 400); }, 5000);
  }

  // ── Messages ─────────────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SHOW_TAB_BADGE')   buildBadge(msg.reason, msg.openedAt);
    if (msg.type === 'SHOW_DISTRACTION') showToast(msg.domain, msg.reason);
    if (msg.type === 'REFRESH_BADGE')    init(); // triggered by popup after saving
  });

  // ── Init: ask background for this tab's reason ────────────────────────────
  function init() {
    if (!chrome.runtime?.id) return;
    chrome.runtime.sendMessage({ type: 'GET_REASON_FOR_CURRENT_TAB' }, (res) => {
      if (chrome.runtime.lastError) {
        buildBadge(null, null);
        return;
      }
      buildBadge(res?.reason || null, res?.openedAt || null);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-init when tab becomes visible (user switches back to tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      setTimeout(init, 150);
    }
  });

  // Poll every 2 seconds to catch updates from popup (popup closes before message arrives)
  setInterval(() => {
    if (!chrome.runtime?.id) return;
    if (document.visibilityState !== 'visible') return;
    chrome.runtime.sendMessage({ type: 'GET_REASON_FOR_CURRENT_TAB' }, (res) => {
      if (chrome.runtime.lastError) return;
      const newReason = res?.reason || null;
      // Only rebuild if reason changed
      const currentText = document.querySelector('#wo-txt')?.textContent;
      const currentIsEmpty = document.querySelector('#wo-txt')?.classList.contains('wo-empty');
      if (newReason && (currentIsEmpty || currentText !== newReason)) {
        buildBadge(newReason, res?.openedAt || null);
      }
    });
  }, 2000);

  // ── Utils ───────────────────────────────────────────────────────────────────
  function x(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    return Math.floor(s / 3600) + 'h ago';
  }
})();
