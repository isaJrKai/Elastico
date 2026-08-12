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
