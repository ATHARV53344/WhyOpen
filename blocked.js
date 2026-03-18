// WHYOPEN – blocked.js
// Handles the Focus Mode block page logic

const QUOTES = [
  '"The ability to focus attention on important things is a defining characteristic of intelligence."',
  '"Concentrate all your thoughts upon the work in hand. The sun\'s rays do not burn until brought to a focus."',
  '"You will never reach your destination if you stop and throw stones at every dog that barks."',
  '"Focus on being productive instead of busy."',
  '"The secret of getting ahead is getting started. Focus. Execute. Repeat."',
  '"It is not enough to be busy. The question is: what are we busy about?"'
];

// Show random motivational quote
document.getElementById('quote').textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];

// Show the blocked site name from URL param (?site=youtube.com)
try {
  const params = new URLSearchParams(location.search);
  const site = params.get('site');
  if (site) {
    document.getElementById('blockedUrl').textContent = site;
  } else if (document.referrer) {
    document.getElementById('blockedUrl').textContent = new URL(document.referrer).hostname;
  }
} catch (e) {}

// Go back button
document.getElementById('goBackBtn').addEventListener('click', () => {
  history.back();
});

// Disable focus mode button
document.getElementById('disableFocusBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'TOGGLE_FOCUS_MODE' }, () => {
    history.back();
  });
});
