---
Task ID: 1
Agent: main
Task: Fix match analysis navigation + redesign dashboard

Work Log:
- Diagnosed match analysis bug: matches-view passes raw football-data.org IDs without fd: prefix, so match-detail API 404s
- Fixed matches-view handleMatchClick to prefix IDs with fd:
- Added normalizeStatus() to /api/matches/[id]/route.ts mapping ESPN statuses (IN_PROGRESS, STATUS_FINAL, etc.) to internal values (live, finished, etc.)
- Applied normalization to both mapDbMatch and ESPN fallback responses
- Rewrote dashboard-view.tsx as a command center matching ChatGPT reference designs: KPI strip, live ticker, 2:1 asymmetric split with featured match panel + news rail
- Fixed trailing-paren syntax error in computeEloProb
- Build: PASSING, 0 errors, pushed to production

Stage Summary:
- Match analysis navigation fixed (fd: prefix routing)
- ESPN/DB status normalization added
- Dashboard redesigned from flat card grid to command center composition
- Commit: 1c2e341
