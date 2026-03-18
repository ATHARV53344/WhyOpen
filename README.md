# 🧠 WHYOPEN – Mindful Browsing Assistant
### *Stop mindless browsing. Know WHY you open every tab.*

---

## Project Structure

```
whyopen-extension/
├── manifest.json       # MV3 Chrome extension config
├── background.js       # Service worker — core logic, tab events, storage
├── content.js          # Injected script — reminder banners on pages
├── newtab.html         # New tab override page with "Why" prompt
├── newtab.js           # New tab page script
├── popup.html          # Extension popup (toolbar icon click)
├── popup.js            # Popup script
├── dashboard.html      # Full analytics dashboard
├── dashboard.js        # Dashboard script
├── blocked.html        # Focus Mode block page
├── style.css           # Shared styles
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🚀 Local Installation (Developer Mode)

1. **Download / extract** the `whyopen-extension` folder to your computer.

2. **Open Chrome** and navigate to:
   ```
   chrome://extensions
   ```

3. **Enable Developer Mode** — toggle in the top-right corner.

4. Click **"Load unpacked"** and select the `whyopen-extension` folder.

5. The extension loads instantly. **Open a new tab** and you'll see the WHYOPEN prompt.

6. Click the extension icon in the toolbar to open the popup anytime.

---

## 🌍 Publishing on the Chrome Web Store

### Step 1 — Prepare assets
- Create promotional screenshots (1280×800 or 640×400)
- Write a compelling store description (see below)
- Zip the extension folder: `whyopen-extension.zip`

### Step 2 — Chrome Web Store Developer Account
1. Go to: https://chrome.google.com/webstore/devconsole
2. Pay the **one-time $5 registration fee**
3. Verify your identity

### Step 3 — Publish
1. Click **"New Item"** → upload your `.zip`
2. Fill in: name, description, category (Productivity), screenshots
3. Set visibility: **Public**
4. Submit for review (usually 1–3 business days)

### Store Description Template
```
🧠 WHYOPEN – Mindful Browsing Assistant

Do you open browser tabs and immediately forget why?
WHYOPEN asks you WHY before you browse — keeping you intentional and focused.

✅ Prompts you when opening a new tab
✅ Saves your purpose linked to each tab  
✅ Reminds you of your goal when you return
✅ Warns you about distraction sites (YouTube, Reddit, Instagram...)
✅ Focus Mode blocks distracting sites entirely
✅ Daily productivity dashboard with focus score
✅ Tracks focused vs. distracted browsing time

Built for students, developers, and deep workers who want to take back their attention.
```

---

## 💡 How It Works — Architecture

```
User opens new tab
       ↓
newtab.html (Why prompt)
       ↓
User types reason → newtab.js
       ↓
Message: SET_REASON → background.js
       ↓
Stored in tabStore (memory) + chrome.storage.local
       ↓
User switches tabs → tabs.onActivated
       ↓
background.js → content.js message: SHOW_REMINDER
       ↓
content.js renders reminder banner on the page
```

---

## 💰 Freemium Business Model

### Free Tier
- Unlimited tab purpose tracking
- Daily stats (tabs opened, focus score)
- Basic distraction warnings
- 7-day history

### Pro — $4.99/month or $39/year
- **Unlimited history** (30 days → forever)
- **Advanced analytics**: weekly/monthly trends, heatmaps
- **Custom distraction sites** list
- **Scheduled Focus Mode** (e.g. focus 9am–12pm daily)
- **Export data** (CSV, JSON)
- **Multiple goal profiles** (Work, Study, Personal)
- **AI-powered insights**: "You're most distracted on Tuesday afternoons"

### Team — $8/user/month
- Shared focus sessions
- Team productivity leaderboard
- Manager dashboard
- Slack/Notion integrations

---

## 🦠 Viral Growth Features

### 1. Focus Score Sharing
- "My focus score today: 87% 🎯 — tracked with WHYOPEN"
- One-click share to Twitter/LinkedIn

### 2. Streak System
- Daily streak for maintaining >70% focus score
- Streak badges (3 days, 7 days, 30 days)
- Break a streak → gentle nudge notification

### 3. Weekly Email Reports
- "This week you opened 234 tabs, 78% with purpose"
- Personalized tips based on your distraction patterns

### 4. Focus Rooms (Team)
- "Join my focus room" shareable links
- Real-time co-focus sessions with friends/colleagues

### 5. Referral Program
- Refer 3 friends → get 1 month Pro free
- Friends get 30% off first month

---

## 📈 Go-To-Market Strategy

### Phase 1 — Launch (Month 1–2)
- **Product Hunt launch** — target #1 Product of the Day
- **Reddit posts**: r/productivity, r/getdisciplined, r/learnprogramming
- **Hacker News Show HN** post
- **Twitter/X thread**: "I built a Chrome extension to fix my tab addiction"

### Phase 2 — Growth (Month 3–6)
- **YouTube sponsorships**: productivity/study-with-me channels
- **Blog content**: "The science of tab overload", "How I increased my focus score to 90%"
- **SEO**: target "mindful browsing", "focus extension chrome", "tab manager productivity"
- **TikTok/Reels**: "Day in the life using WHYOPEN"

### Phase 3 — Scale (Month 6–12)
- **B2B pivot**: sell to companies for employee productivity
- **LMS integrations**: Canvas, Blackboard for student focus
- **Enterprise**: SSO, admin controls, company-wide deployment

### KPI Targets
- Month 1: 500 installs
- Month 3: 5,000 installs, 50 Pro subscribers
- Month 6: 25,000 installs, 500 Pro subscribers ($2,500 MRR)
- Month 12: 100,000 installs, 3,000 Pro subscribers ($15,000 MRR)

---

## 🔧 Tech Stack & Future Roadmap

### Current Stack
- Chrome Extension Manifest V3
- Vanilla JavaScript (zero dependencies)
- Chrome Storage API for persistence
- Chrome Notifications API
- Chrome Tabs & Alarms API

### Roadmap
- [ ] **Firefox extension** port
- [ ] **Safari extension** (macOS/iOS)
- [ ] **AI-powered purpose suggestions** (on-device with Gemini Nano)
- [ ] **Pomodoro integration** built-in timer
- [ ] **Website blocking** advanced patterns (regex, wildcards)
- [ ] **Mobile companion app** (iOS/Android)
- [ ] **Calendar integration**: auto-focus mode during meetings
- [ ] **Obsidian/Notion sync**: export your purpose history as notes

---

## ⚙️ Permissions Explained (for Store Review)

| Permission | Why |
|---|---|
| `tabs` | Track when tabs are opened/switched |
| `storage` | Save your purposes and stats locally |
| `notifications` | Show reminder notifications |
| `alarms` | Daily stats reset, periodic reminders |
| `scripting` | Inject reminder banner into pages |
| `<all_urls>` | Detect distraction sites on any URL |

**Privacy commitment**: All data is stored **locally on your device**. Nothing is sent to any server. No account required.

---

## 🤝 Contributing

1. Fork the repo
2. Make changes
3. Test locally with Developer Mode
4. Submit PR with description of changes

---

*Built with ❤️ for people who want their attention back.*
