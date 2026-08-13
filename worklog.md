---
Task ID: 1
Agent: Main
Task: Comprehensive polish pass on ELASTICO — design system, theme, fonts, navigation, interactions

Work Log:
- Audited entire application: globals.css, layout.tsx, page.tsx, sidebar.tsx, header.tsx, error-boundary.tsx, command-palette.tsx, login-view.tsx, leaderboard-view.tsx, and 10 other view files
- Fixed CSS @theme inline to reference Geist font variables instead of unloaded Inter/JetBrains Mono
- Removed redundant .dark CSS block (was duplicate of :root)
- Added --shimmer-color variable for light-theme compatibility
- Fixed layout.tsx: inline style for Geist font, removed service worker killer, fixed theme-color and favicon color to #10B981
- Fixed page.tsx: replaced all hardcoded dark colors with theme tokens (bg-background, text-foreground, etc.)
- Fixed sidebar.tsx: all hardcoded colors → theme tokens, added Activity icon for System Monitor (was duplicate Shield), added "Coming Soon" badges for tactical/achievements/social
- Fixed header.tsx: added theme toggle (Sun/Moon), added missing view titles, all colors → theme tokens, fixed plan badge classes
- Fixed error-boundary.tsx: hardcoded zinc → theme tokens
- Fixed login-view.tsx: 30+ hardcoded color replacements, disabled dead Forgot Password/Social Login buttons
- Fixed leaderboard-view.tsx: replaced emoji tabs with lucide icons, replaced emoji medals with styled text, disabled dead time period filter
- Fixed command-palette.tsx: implemented full keyboard navigation (↑↓+Enter), removed 🔴 emoji, fixed dialog bg to use popover token
- Standardized all 14 view files to use sonner toast (migrated 10 files from @/hooks/use-toast)
- Verified build passes clean

Stage Summary:
- Build: PASSING
- Font system: Geist Sans + Geist Mono now actually load via CSS variable chain
- Light theme: Fully functional with theme toggle in header
- All hardcoded colors in shell components eliminated
- Dead interactions disabled with visual cues
- Toast library unified to sonner
- Decorative emojis replaced with icons
- Command palette keyboard navigation working
- Deployment requires new Vercel token

---
Task ID: 2
Agent: Main
Task: Wire ESPN data into all views — replace mock data with real API data (no API keys needed)

Work Log:
- Diagnosed root cause: .env has no API keys, DB seeded with WC2026 mock data (0 players, no logos), 5 API client libraries built but unused, views render colored circles instead of <img> logos
- Rewrote matches-view.tsx: Changed from broken /api/football-data (needs key) to ESPN-powered /api/live. Added real team logos via <img> tags, league selector with 20 leagues, status tabs (Live/Upcoming/Finished/All), search, auto-refresh every 30s
- Updated dashboard-view.tsx: Added TickerMatch.homeLogo/awayLogo fields, ticker now renders <img> logos from ESPN data, live scores list shows team logos, next match prediction shows team logos, ELO rankings table shows logos, all matches sidebar shows logos. Falls back to colored circles if no logo URL
- Rewrote tournament-view.tsx: Replaced hardcoded WC2026 mock bracket with real ESPN league standings. Added league selector (15 leagues), standings table with team logos, form indicators (W/D/L), qualification zone highlighting (Champions League green, relegation red), KPI cards, leader/best defense/top scorer highlight cards. Renamed sidebar label from "Tournament" to "Standings"
- Updated player-view.tsx: Added ESPN fallback — when DB /api/players returns empty, fetches teams via /api/live?action=teams, then fetches rosters for up to 6 teams via /api/live?action=roster
- Extended /api/live/route.ts: Added `teams` action (calls fetchTeams) and `roster` action (calls fetchTeamRoster) to the ESPN data gateway
- Added `logo?: string` field to Team interface in Zustand store
- Updated header.tsx: Renamed "Tournament" → "League Standings" in view titles
- Updated sidebar.tsx: Renamed "Tournament" → "Standings" in nav

Stage Summary:
- Build: PASSING (zero errors, zero warnings)
- Matches: Real ESPN scores with logos across 20 leagues (no API key needed)
- Dashboard: Live ticker shows real team badges, scores, and logos from ESPN
- Standings: Real league tables from ESPN with team crests, form, qualification zones
- Players: DB-first with ESPN roster fallback
- All data flows through ESPN public APIs — zero API keys required
- Next: Deploy to Vercel
