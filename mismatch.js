// WHYOPEN – Mismatch Detection Engine
// Compares user's stated reason against actual page being visited

// ── Category keyword maps ─────────────────────────────────────────────────────

const INTENT_CATEGORIES = {
  study: {
    keywords: ['study','learn','learning','course','tutorial','lecture','education',
               'homework','assignment','exam','quiz','notes','revision','practice',
               'understand','concept','theory','research','paper','thesis','academic'],
    label: 'studying/learning'
  },
  work: {
    keywords: ['work','task','project','meeting','report','email','presentation',
               'deadline','client','code','debug','develop','build','deploy','fix',
               'review','ticket','sprint','jira','figma','design','write','document'],
    label: 'working'
  },
  read: {
    keywords: ['read','article','blog','news','book','documentation','docs','wiki',
               'guide','reference','manual','spec','changelog','post','essay'],
    label: 'reading'
  },
  shop: {
    keywords: ['buy','shop','shopping','order','purchase','price','product','cart',
               'checkout','deal','discount','review','compare'],
    label: 'shopping'
  },
  watch: {
    keywords: ['watch','video','movie','film','episode','series','stream','tutorial video'],
    label: 'watching'
  }
};

const SITE_CATEGORIES = {
  entertainment: [
    'youtube.com','twitch.tv','netflix.com','hulu.com','disneyplus.com',
    'primevideo.com','hbomax.com','crunchyroll.com','dailymotion.com',
    'vimeo.com','tiktok.com','9gag.com','imgur.com','giphy.com'
  ],
  social: [
    'instagram.com','twitter.com','x.com','facebook.com','snapchat.com',
    'linkedin.com','reddit.com','tumblr.com','pinterest.com','discord.com',
    'whatsapp.com','telegram.org','threads.net','mastodon.social','bereal.com'
  ],
  shopping: [
    'amazon.com','flipkart.com','ebay.com','etsy.com','myntra.com',
    'meesho.com','ajio.com','walmart.com','target.com','aliexpress.com',
    'shopify.com','nykaa.com','swiggy.com','zomato.com'
  ],
  gaming: [
    'steampowered.com','store.steampowered.com','epicgames.com','roblox.com',
    'minecraft.net','chess.com','poki.com','coolmathgames.com'
  ],
  education: [
    'coursera.org','udemy.com','edx.org','khanacademy.org','brilliant.org',
    'codecademy.org','freecodecamp.org','leetcode.com','hackerrank.com',
    'stackoverflow.com','developer.mozilla.org','w3schools.com','geeksforgeeks.org',
    'medium.com','dev.to','github.com','docs.google.com'
  ],
  news: [
    'bbc.com','cnn.com','theguardian.com','nytimes.com','reuters.com',
    'techcrunch.com','theverge.com','wired.com','hindustantimes.com','ndtv.com'
  ]
};

// Domains where mismatch check makes NO sense (blank/extension pages)
const SKIP_DOMAINS = [
  'newtab', 'extensions', 'chrome', '', 'localhost',
  'google.com', 'bing.com', 'duckduckgo.com'
];

// ── Main mismatch detector ────────────────────────────────────────────────────

/**
 * Analyses whether a page matches the user's stated reason.
 * @param {string} reason   - What the user typed ("Study React")
 * @param {string} url      - Current page URL
 * @param {string} title    - Current page title
 * @returns {{ mismatch: boolean, confidence: number, reason: string, suggestion: string }}
 */
function detectMismatch(reason, url, title) {
  if (!reason || !url) return { mismatch: false };

  let parsedDomain = '';
  let pathname = '';
  try {
    const u = new URL(url);
    parsedDomain = u.hostname.replace('www.', '');
    pathname = u.pathname + ' ' + u.search;
  } catch {
    return { mismatch: false };
  }

  // Skip non-meaningful pages
  if (SKIP_DOMAINS.some(s => parsedDomain.includes(s))) return { mismatch: false };
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return { mismatch: false };

  const reasonLower  = reason.toLowerCase();
  const titleLower   = (title || '').toLowerCase();
  const fullPageText = (titleLower + ' ' + parsedDomain + ' ' + pathname).toLowerCase();

  // ── Step 1: Detect user's INTENT from their reason ──────────────────────────
  const userIntent = detectIntent(reasonLower);

  // ── Step 2: Extract keywords from reason ────────────────────────────────────
  const reasonKeywords = extractKeywords(reasonLower);

  // ── Step 3: Detect page CATEGORY ────────────────────────────────────────────
  const pageCategory = detectPageCategory(parsedDomain);

  // ── Step 4: Check if page title/URL contains reason keywords ────────────────
  const keywordMatch  = reasonKeywords.some(kw => fullPageText.includes(kw));

  // ── Step 5: Decide mismatch ──────────────────────────────────────────────────
  let mismatch    = false;
  let confidence  = 0;
  let explanation = '';

  // Case A: User wants to study/work/read but is on entertainment/social
  const focusIntents = ['study', 'work', 'read'];
  if (focusIntents.includes(userIntent) && ['entertainment', 'social', 'gaming'].includes(pageCategory)) {
    // Exception: youtube can be educational if title mentions the topic
    if (pageCategory === 'entertainment' && parsedDomain === 'youtube.com') {
      if (keywordMatch) {
        mismatch = false; // "Study React" + YouTube video about React = OK
      } else {
        mismatch   = true;
        confidence = 85;
        explanation = `YouTube doesn't seem related to "${reason}"`;
      }
    } else {
      mismatch   = true;
      confidence = 90;
      explanation = `${parsedDomain} looks like ${pageCategory} content, not ${INTENT_CATEGORIES[userIntent]?.label || userIntent}`;
    }
  }

  // Case B: Shopping intent but on social/entertainment
  if (userIntent === 'shop' && ['entertainment', 'social'].includes(pageCategory)) {
    mismatch   = true;
    confidence = 75;
    explanation = `${parsedDomain} doesn't look like a shopping site`;
  }

  // Case C: Reason mentions a specific topic — page has no relation
  if (!mismatch && reasonKeywords.length > 0 && !keywordMatch) {
    // Only flag if page is clearly distracting (not just an unrelated work page)
    if (['entertainment', 'social', 'gaming'].includes(pageCategory)) {
      mismatch   = true;
      confidence = 70;
      explanation = `Page content doesn't match your goal: "${reason}"`;
    }
  }

  // Case D: Title contains clear distraction signals vs focused reason
  const distractionTitleWords = ['meme','funny','viral','trending','prank','fail','compilation','shorts','reels','for you'];
  if (!mismatch && focusIntents.includes(userIntent)) {
    if (distractionTitleWords.some(w => titleLower.includes(w))) {
      mismatch   = true;
      confidence = 80;
      explanation = `Page title suggests entertainment, not "${reason}"`;
    }
  }

  if (!mismatch) return { mismatch: false };

  return {
    mismatch:    true,
    confidence,
    explanation,
    suggestion: buildSuggestion(reason, parsedDomain, pageCategory)
  };
}

// ── Intent detector ───────────────────────────────────────────────────────────
function detectIntent(reason) {
  for (const [intent, data] of Object.entries(INTENT_CATEGORIES)) {
    if (data.keywords.some(kw => reason.includes(kw))) return intent;
  }
  // Default: treat as "work" (focused task)
  return 'work';
}

// ── Keyword extractor ─────────────────────────────────────────────────────────
function extractKeywords(reason) {
  // Remove common stop words and return meaningful tokens
  const stopWords = new Set([
    'a','an','the','to','for','of','in','on','at','by','is','i','my',
    'and','or','with','this','that','it','do','want','need','about'
  ]);
  return reason
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

// ── Page category detector ────────────────────────────────────────────────────
function detectPageCategory(domain) {
  for (const [category, domains] of Object.entries(SITE_CATEGORIES)) {
    if (domains.some(d => domain === d || domain.endsWith('.' + d))) {
      return category;
    }
  }
  return 'unknown';
}

// ── Suggestion builder ────────────────────────────────────────────────────────
function buildSuggestion(reason, domain, pageCategory) {
  const suggestions = {
    entertainment: `Close this tab and get back to: "${reason}"`,
    social:        `Social media can wait. Stay focused on: "${reason}"`,
    gaming:        `Game later! You planned to: "${reason}"`,
    shopping:      `Save the shopping for later. Your goal: "${reason}"`,
    unknown:       `This page might not help with: "${reason}"`
  };
  return suggestions[pageCategory] || suggestions.unknown;
}

// Export for use in background.js
if (typeof module !== 'undefined') {
  module.exports = { detectMismatch, detectIntent, detectPageCategory, extractKeywords };
}
