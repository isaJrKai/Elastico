const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, TableOfContents,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType, PageBreak, SectionType, TableLayoutType,
} = require("docx");

// ── Palette: DM-1 Deep Cyan (Tech/AI) ──
const PAL = {
  bg: "162235", accent: "37DCF2",
  coverTitle: "FFFFFF", coverSub: "B0B8C0", coverMeta: "90989F", coverFoot: "687078",
  tblHeaderBg: "1B6B7A", tblHeaderText: "FFFFFF",
  tblLine: "1B6B7A", tblInner: "C8DDE2", tblSurface: "EDF3F5",
};
const c = (hex) => hex.replace("#", "");
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ── Helper functions ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: "0A1628", font: { ascii: "Times New Roman" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: "0A1628", font: { ascii: "Times New Roman" } })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: "1A2B40", font: { ascii: "Calibri" } })],
  });
}
function body(text) {
  return new Paragraph({
    spacing: { after: 120, line: 312 },
    children: [new TextRun({ text, size: 24, color: "1A2B40", font: { ascii: "Calibri" } })],
  });
}
function bodyBold(label, text) {
  return new Paragraph({
    spacing: { after: 100, line: 312 },
    children: [
      new TextRun({ text: label, bold: true, size: 24, color: "0A1628", font: { ascii: "Calibri" } }),
      new TextRun({ text, size: 24, color: "1A2B40", font: { ascii: "Calibri" } }),
    ],
  });
}
function bullet(text) {
  return new Paragraph({
    spacing: { after: 60, line: 312 },
    indent: { left: 480, hanging: 240 },
    children: [
      new TextRun({ text: "\u2022 ", size: 24, color: "1B6B7A", font: { ascii: "Calibri" } }),
      new TextRun({ text, size: 24, color: "1A2B40", font: { ascii: "Calibri" } }),
    ],
  });
}
function spacer(twips = 120) {
  return new Paragraph({ spacing: { before: twips } });
}

// ── Simple table builder (horizontal-only style) ──
function specTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: c(PAL.tblLine) },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: c(PAL.tblLine) },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: c(PAL.tblInner) },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: rows.map((r, i) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: i === 0 ? c(PAL.tblHeaderBg) : (i % 2 === 0 ? c(PAL.tblSurface) : "FFFFFF") },
            borders: noBorders,
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: r[0], bold: i === 0, size: 21, color: i === 0 ? c(PAL.tblHeaderText) : "0A1628", font: { ascii: "Calibri" } })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: i === 0 ? c(PAL.tblHeaderBg) : (i % 2 === 0 ? c(PAL.tblSurface) : "FFFFFF") },
            borders: noBorders,
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ spacing: { line: 280 }, children: [new TextRun({ text: r[1], size: 21, color: i === 0 ? c(PAL.tblHeaderText) : "1A2B40", font: { ascii: "Calibri" } })] })],
          }),
        ],
      })
    ),
  });
}

// ── Screen section generator ──
function screenSection(num, title, refFile, data) {
  const rows = [
    ["Specification", "Detail"],
    ["Reference Image", `Reference ${String(num).padStart(2, "0")} (${refFile})`],
    ["ELASTICO Screen", data.screen],
    ["Existing Component", data.component],
    ["Data Source (API/Store)", data.dataSource],
    ["Assets to Source", data.assets],
  ];
  return [
    h1(`Reference ${String(num).padStart(2, "0")}: ${title}`),
    bodyBold("Purpose: ", data.purpose),
    bodyBold("Primary Question: ", data.primaryQuestion),
    bodyBold("Primary Information: ", data.primaryInfo),
    bodyBold("Primary Action: ", data.primaryAction),
    spacer(80),
    specTable(rows),
    spacer(60),
    h2("What to Preserve from Reference"),
    ...data.preserve.map((t) => bullet(t)),
    h2("What to Change"),
    ...data.change.map((t) => bullet(t)),
    h2("What Information Belongs Here"),
    ...data.infoBelongs.map((t) => bullet(t)),
    h2("Which Existing ELASTICO Component Supplies It"),
    body(data.componentDetail),
    h2("Which API/Store Supplies the Data"),
    body(data.dataDetail),
    h2("Which Assets Should Be Sourced"),
    ...data.assetsDetail.map((t) => bullet(t)),
    h2("What Must NOT Be Copied"),
    ...data.mustNotCopy.map((t) => bullet(t)),
    h2("1366 x 768 Composition"),
    body(data.composition),
    h2("Responsive Behavior"),
    body(data.responsive),
    h2("Acceptance Criteria"),
    ...data.acceptance.map((t) => bullet(t)),
  ];
}

// ═══════════════════════════════════════════════════════════════════
// SCREEN DATA
// ═══════════════════════════════════════════════════════════════════

const screens = [
  // ── SCREEN 01: DASHBOARD ──
  {
    title: "Dashboard", refFile: "ChatGPT Image Aug 12, 08_59_11 AM.png",
    purpose: "Command center answering: What matters right now in football? This is the analyst's home base, not a summary of every database table. It must communicate live state, upcoming intelligence, and current model activity in a single composed viewport.",
    primaryQuestion: "What matters right now?",
    primaryInfo: "Live match scores and states, upcoming fixtures with predictions, current model performance, recent results with analytical context.",
    primaryAction: "View Live Match (on any live fixture) or Explore Match (on any upcoming/recent fixture).",
    component: "dashboard-view.tsx",
    dataSource: "Zustand store (matches, teams, predictions) + /api/live (ESPN proxy) + /api/matches + /api/predictions",
    assets: "Team crests (ESPN API logos), competition badges, country flags.",
    componentDetail: "The existing dashboard-view.tsx renders the main dashboard grid. It currently fetches data from multiple Zustand store actions (fetchLiveScores, fetchMatches, fetchTeams) and displays them in a card-based layout. This component will be redesigned to follow the command-center composition principle from the philosophy document, replacing the current generic card grid with a spatially composed analytical workspace.",
    dataDetail: "Live scores come from /api/live which proxies ESPN's public API (site.api.espn.com) - no API key required, returns real team logos, scores, and match states. Upcoming/recent matches come from /api/matches. Prediction data comes from /api/predictions which connects to the prediction engine. All data flows through the Zustand store (use-elastico-store.ts) which manages currentView switching and fetch actions. Note: the DB gate issue (page.tsx requiring DB before rendering) must be resolved before dashboard can display ESPN data.",
    assetsDetail: [
      "Team crests: Use ESPN API logo URLs (already returned in API responses). Build resolveTeamLogo() in an asset-resolution layer.",
      "Competition badges: Source from ESPN or local cached assets for major leagues (Premier League, La Liga, etc.).",
      "Country flags: Use a consistent flag library (e.g., flagcdn.com or local SVG set). Never use emoji flags.",
      "No player headshots on dashboard - this is a match-level view, not a player-level view.",
    ],
    preserve: [
      "The command-center composition: a large live/upcoming match area as the dominant visual element, with supporting analytical panels arranged around it.",
      "High information density with clear visual hierarchy - L1 hero metrics (scores), L2 contextual data (probabilities, stats), L3 metadata (timestamps, sources).",
      "Dark premium aesthetic with deep charcoal backgrounds (#0a0e17 to #131a29) and restrained accent colors.",
      "Left-aligned sidebar navigation (fixed ~240px) with icon + label items and active state indication.",
      "Typography hierarchy: large display numbers for scores (28-48px bold), tracked-out uppercase labels for section headers, compact 12-14px body text.",
      "Tabular/monospaced numbers for data alignment across all metrics.",
      "Glassmorphism-style card containers with 1px borders and 8-12px border radius, but used sparingly - not every element needs a card.",
    ],
    change: [
      "Replace the 3x3 grid-of-screens composite layout with a single full-screen dashboard composition.",
      "Remove any reference-specific team names, player names, scores, and statistics. All data must come from real ELASTICO data sources.",
      "Adopt the ELASTICO philosophy's cognitive flow: WHERE AM I > WHAT IS HAPPENING > WHAT MATTERS > WHY > EVIDENCE > NEXT ACTION.",
      "Replace generic card grids with spatially composed analytical surfaces (see philosophy Section 9: Spatial Design Language).",
      "Ensure navigation follows the user's mental model (see philosophy Section 6), not the order components were written.",
      "Consolidate the color palette to ELASTICO's design tokens rather than using multiple reference-specific palettes.",
    ],
    infoBelongs: [
      "Live match scores with real-time state indicators (LIVE, HT, FT) and team crests.",
      "Upcoming fixtures with dates, competitions, and prediction probabilities where available.",
      "Current model/prediction performance summary (win rate, ROI if tracked).",
      "Recent results with scorelines and key analytical highlights.",
      "A 'current football state' summary strip showing what leagues/matches are active.",
      "League standings snippet for the user's primary competitions.",
    ],
    mustNotCopy: [
      "Sample player names (Haaland, Bruno Fernandes), sample team matchups (Man City vs Arsenal), sample statistics (94 rating, 18.4% ROI).",
      "The exact 4-column grid labels (Stats, Live, Predictions, Market) - these are reference-specific.",
      "Specific hex codes without adaptation - the references vary between #0a0e17, #0B0F14, #0F1115, #111827. ELASTICO must define its own tokens.",
      "Any fabricated data - if ESPN doesn't return it, show an elegant empty state.",
      "The 'Pro Analyst' role badge or any user-role UI not in the current auth model.",
      "Glowing neon effects on every element - the philosophy explicitly warns against this.",
    ],
    composition: "At 1366x768, the dashboard must fit the complete command-center composition without scrolling for the primary viewport. Sidebar (240px fixed) + main content area (1126px). The main area uses an asymmetric grid: top portion dominated by live/upcoming matches (60% height), bottom portion split between model insights (left 60%) and standings/recent activity (right 40%). Card padding is 16-20px, gutters 16-20px. The live match area should show 3-4 fixtures visibly. Typography: screen title 18-20px semibold, section labels 11-12px uppercase tracked, data values 24-32px bold. No horizontal overflow.",
    responsive: "At 1280x720, sidebar can collapse to icon-only (64px), main content reflows to maintain readability. At 1024x768, sidebar becomes a hamburger menu, grid collapses to 2 columns. Below 768px, single-column stack with live matches first, then predictions, then standings. Tables may scroll horizontally. The page itself must never overflow horizontally.",
    acceptance: [
      "Dashboard loads and renders visible content within 3 seconds on 1366x768.",
      "Live match scores display real ESPN data (not fabricated numbers).",
      "All team crests render from ESPN API logo URLs, not placeholder circles.",
      "Navigation sidebar correctly switches between all 9 views via Zustand currentView.",
      "No horizontal scroll at 1366x768 viewport width.",
      "Empty states display gracefully when no live matches exist (not blank space).",
      "The visual hierarchy is immediately apparent: live scores > upcoming > supporting analytics.",
      "The page feels composed and spatial, not like a grid of identical cards.",
    ],
  },
  // ── SCREEN 02: LIVE MATCH ──
  {
    title: "Live Match", refFile: "Irz9NB2Q...jfif",
    purpose: "Deep analytical workspace for a single live match. This screen answers: What is happening in this match right now, and why? It is the most data-intensive screen in ELASTICO, serving as a live analytical room where an analyst can track score, momentum, tactical shape, statistics, and model interpretation simultaneously.",
    primaryQuestion: "What is happening in this match, and why?",
    primaryInfo: "Current score and match clock, live win probability, possession and key stats, tactical formation visualization, match events timeline.",
    primaryAction: "View Full Analysis (expand to detailed tactical/statistical view) or Switch Match (select a different live fixture).",
    component: "match-detail-view.tsx",
    dataSource: "/api/live (ESPN proxy for scores, events, lineups) + /api/predictions (model probability) + Zustand store",
    assets: "Team crests (ESPN), player names from ESPN roster data, competition logo, country flags for national teams.",
    componentDetail: "match-detail-view.tsx is the existing match detail component that renders when a user selects a match. It currently shows match info, basic stats, and events. This component must be transformed into a full live analytical workspace with a scoreboard hero, tactical pitch area, real-time stat comparison bars, event timeline, and model interpretation panel. It should support multiple sub-modes (Overview, Match Stats, Tactical) via internal tab navigation without leaving the view.",
    dataDetail: "The ESPN live API (/api/live proxy) provides real-time scores, match clock, events (goals, cards, substitutions), possession, shot counts, and basic statistics. The prediction engine (/api/predictions) provides pre-match and in-match model probabilities. Player and lineup data comes from ESPN's roster endpoints. For tactical visualizations, real spatial data (xT, passing networks, heatmaps) may not be available for most matches - these must show elegant unavailable states rather than fabricated data.",
    assetsDetail: [
      "Team crests: ESPN API logos for both home and away teams, normalized to consistent size (~40-48px).",
      "Competition logo: Sourced from ESPN or local cache for the specific league/competition.",
      "Country flags: Only for international matches, from a consistent flag library.",
      "Player images: NOT required on this screen - use abbreviated name nodes (e.g., 'BEN 23') on tactical views, matching the reference's approach of data nodes rather than photographs.",
      "Tactical pitch: Custom SVG/CSS rendering, not a chart library default.",
    ],
    preserve: [
      "The three-column core layout: left sidebar (home lineup), center hero (tactical pitch or primary analysis), right sidebar (away lineup/stats).",
      "Header bar with team crests, KPIs (possession %, shots), and central scoreboard as the dominant visual anchor.",
      "High information density appropriate for a deep analytical workspace - this is where analysts spend extended time.",
      "Dual-accent color coding for home vs away teams (e.g., cyan/teal vs terracotta/rust from the reference).",
      "Data-dense stat rows with tabular figures for numerical alignment.",
      "Uppercase tracked-out labels for section headers (POSSESSION, LINE-UP, COMMENTARY).",
      "Timeline/event footer with horizontal progress representation for goals and key events over match time.",
    ],
    change: [
      "Remove sample data: Real Madrid vs Levante, 1:0 score, specific possession/shots numbers, specific player names.",
      "Replace the fine-grid dot pattern background with ELASTICO's design-system surface tokens.",
      "Adapt the three-column layout to 1366x768 - the reference's density may need slight compression.",
      "Ensure the scoreboard follows ELASTICO's match state logic (LIVE/UPCOMING/RECENT/HISTORICAL from philosophy Section 13).",
      "Add model interpretation panel showing prediction probability and confidence, which the reference lacks.",
      "Implement sub-mode tabs (Overview, Match Stats, Tactical) to avoid showing all analytical layers simultaneously (philosophy Section 24).",
    ],
    infoBelongs: [
      "Match identity: home team vs away team, competition, match date/kickoff time, current match state.",
      "Live scoreboard: score, match clock (with stoppage time), half indicator.",
      "Live win probability with in-match trend line (if prediction engine supports it).",
      "Key statistics comparison: possession, shots (on target), passes, fouls, corners.",
      "Lineups for both teams with formation notation.",
      "Match events timeline: goals, cards, substitutions with minute markers.",
      "Tactical formation view (if lineup data available; otherwise show static formation diagram).",
      "Model interpretation: pre-match prediction, current probability, confidence level.",
    ],
    mustNotCopy: [
      "The specific Real Madrid vs Levante matchup, 1:0 scoreline, or any specific player names/numbers from the reference.",
      "The exact teal/rust color pairing - use ELASTICO's team-identity color system instead.",
      "The rotated vertical text label ('FOOTBALL GAME ANALYSIS') on the left edge.",
      "Specific possession percentages (77%), shot counts, or any numerical data from the reference.",
      "The macOS window chrome traffic lights visible in the reference screenshot.",
      "Any tactical data (passing networks, pressing zones) that cannot be derived from real ELASTICO data sources.",
    ],
    composition: "At 1366x768, the Live Match screen fills the entire viewport beyond the sidebar (240px). Header bar (~60px) contains team crests + score + clock. Main area splits into: left panel (~250px) for home lineup, center area (~500px) for tactical pitch/primary viz, right panel (~250px) for away stats. Below the primary area, a footer strip (~180px) contains the event timeline and key stats comparison bars. Total vertical budget: 60 (header) + 528 (primary) + 180 (footer) = 768px. Sub-mode tabs sit between header and primary area (~36px). Internal card padding: 12-16px for compact density.",
    responsive: "At 1280x720, compress side panels to 200px each, center area absorbs the difference. At 1024x768, collapse to two-column: primary viz on top (full width), lineups and stats in a tabbed panel below. Below 768px, stack vertically: scoreboard > stats bars > events > lineups. Tactical pitch view may require landscape orientation hint on mobile.",
    acceptance: [
      "Live match data updates reflect ESPN API responses (scores, clock, events).",
      "Score and match clock are the largest, most prominent elements on screen.",
      "Team crests from ESPN render correctly for both home and away teams.",
      "Statistical comparison bars accurately reflect real data from the API.",
      "Sub-mode tabs (Overview, Match Stats, Tactical) switch without page reload.",
      "If spatial/tactical data is unavailable, an elegant unavailable state is shown.",
      "The screen fits 1366x768 without horizontal overflow.",
      "Navigation back to dashboard is accessible and clearly labeled.",
    ],
  },
  // ── SCREEN 03: PLAYER PROFILE ──
  {
    title: "Player Profile", refFile: "Jqi5S_EI...jfif",
    purpose: "Player intelligence dossier. This screen answers: Who is this player, and how are they performing? It should feel like opening a scout's dossier - starting with identity, flowing through current performance, key metrics, tactical role, and match history. It is NOT a FIFA-style attribute card.",
    primaryQuestion: "Who is this player, and how are they performing?",
    primaryInfo: "Player identity (name, position, team, nationality, photo), current season performance metrics, key statistical breakdowns, match history.",
    primaryAction: "Compare Player (select another player for head-to-head) or View Match (navigate to a specific match from their history).",
    component: "player-view.tsx",
    dataSource: "/api/players + ESPN player endpoints + Zustand store (selectedPlayer, teams)",
    assets: "Player headshot (from ESPN or upstream provider), team crest, country flag.",
    componentDetail: "player-view.tsx is the existing player profile component. It renders player details, stats, and match history. This must be transformed from a basic profile card into a full intelligence dossier with a hero identity section, current performance strip, detailed metrics with contextual comparisons, and a match history log. The layout should use an asymmetric composition giving visual weight to the primary analytical area (stats/heatmap) while keeping the identity and navigation compact.",
    dataDetail: "Player data comes from /api/players which may connect to ESPN's athlete endpoints or the local database. The Zustand store holds the selectedPlayer state and team data. Performance metrics (goals, assists, passes, etc.) come from the player's match history aggregated in the database. If advanced metrics (xG, xA, progressive passes) are not available in the current data model, they must be omitted - never fabricate them (philosophy Section 23).",
    assetsDetail: [
      "Player headshot: Use ESPN athlete photo URL if available. Normalize to circular crop with consistent sizing (large hero: 120-150px, list: 40px). Provide initials fallback.",
      "Team crest: ESPN API logo for the player's current club.",
      "Country flag: From a consistent flag library based on player nationality.",
      "Pitch heatmap: Only render if real spatial data exists for the player. Otherwise show 'Spatial data not available' state.",
    ],
    preserve: [
      "The three-zone layout: hero identity area (top/left), primary analytical visualization (center/right), supporting metrics grid (bottom).",
      "Player roster sidebar (fixed ~240px) for navigating between players within the same team/context.",
      "High-density analytical dashboard feel with multiple chart types visible simultaneously.",
      "The pitch heatmap as a central analytical element - this is a signature football-specific visualization.",
      "Large KPI numbers (32-48px bold) for primary metrics with supporting trend indicators.",
      "Dark surface system with subtle elevation differences between card layers.",
      "Color-coded data visualization (green for positive, red for negative, spectrum for heatmaps).",
    ],
    change: [
      "Remove all sample data: specific player names, numbers (965, 255%), and statistics from the reference.",
      "Replace the Russian/Cyrillic UI text with English.",
      "Remove the macOS window chrome visible in the reference.",
      "Adapt the heatmap color spectrum to use ELASTICO's data visualization color tokens.",
      "If no real heatmap/spatial data exists for a player, show an elegant unavailable state rather than an empty pitch.",
      "Ensure the dossier follows the philosophy's information flow: identity > performance > metrics > tactical role > comparison > history (Section 23).",
      "Remove toggle switches labeled in foreign languages - implement in English with ELASTICO's interaction patterns.",
    ],
    infoBelongs: [
      "Player identity: full name, position, current team, nationality, age/date of birth, jersey number.",
      "Current season summary: appearances, goals, assists, minutes played.",
      "Key performance metrics relevant to the player's position (e.g., forwards: xG, shot conversion; midfielders: pass accuracy, progressive passes; defenders: aerial duels, interceptions).",
      "Performance trend over recent matches (line chart or sparkline).",
      "Match history log with results and key contributions.",
      "Tactical role description and formation placement (if data supports it).",
      "Comparison link to jump to the Compare Players screen.",
    ],
    mustNotCopy: [
      "The specific Cyrillic/Russian text or any non-English labels from the reference.",
      "The specific player statistics (965, 255%, shot conversion percentages) - these are reference-specific numbers.",
      "The macOS traffic light buttons (window chrome) visible in the reference.",
      "Any FIFA-style attribute hexagon if the data doesn't support those specific metrics.",
      "The exact color spectrum of the heatmap - use ELASTICO's data viz palette instead.",
      "Dropdown filters labeled in foreign languages.",
    ],
    composition: "At 1366x768, the Player Profile uses the full content area (1126px after 240px sidebar). Top section (~200px): player identity strip with headshot (left), name/position/team/nationality (center), key season stats as large KPI numbers (right). Middle section (~360px): primary analytical area - split between stat breakdown charts (left 50%) and pitch heatmap (right 50%). Bottom section (~200px): match history table with compact rows (48px row height). Internal padding: 16-20px. The roster sidebar is only visible when accessed from a team context; otherwise, a back button provides navigation.",
    responsive: "At 1280x720, maintain the identity strip but reduce KPI number sizes. At 1024x768, stack the middle section vertically (stats above, heatmap below). Below 768px, single-column stack: identity > KPIs > charts > match history. The heatmap may require a minimum width and could show a simplified version or placeholder on very small screens.",
    acceptance: [
      "Player identity section displays real data (name, team, position) from the API.",
      "Player headshot renders from ESPN or shows professional initials fallback.",
      "All statistics shown are real data from the API, not fabricated numbers.",
      "If advanced metrics are unavailable, they are omitted (not replaced with zeros or random values).",
      "Match history shows real match data with correct scores and dates.",
      "The 'Compare Player' action navigates to the Compare screen with this player pre-selected.",
      "The screen fits 1366x768 without horizontal overflow.",
      "The dossier information flow follows: identity > performance > metrics > history.",
    ],
  },
  // ── SCREEN 04: MATCH ANALYSIS ──
  {
    title: "Match Analysis", refFile: "V5SQXI6Dd...jfif",
    purpose: "Post-match deep dive and tactical analysis workspace. This screen answers: What happened in this match, and what does the evidence show? It extends beyond the live match view into detailed post-match analytics including tactical diagrams, heatmaps, radar charts, and performance comparisons for both teams.",
    primaryQuestion: "What happened in this match, and what does the evidence show?",
    primaryInfo: "Final score, team performance comparison, tactical diagrams with player positioning, key match statistics, player performance highlights.",
    primaryAction: "Explore Tactics (drill into tactical view) or View Player (navigate to a specific player's profile from this match).",
    component: "match-detail-view.tsx (post-match mode) + tactical-view.tsx",
    dataSource: "/api/matches (match details) + /api/predictions (model vs actual) + DB (detailed stats) + Zustand store",
    assets: "Team crests, competition logo, player names and positions.",
    componentDetail: "The post-match analysis reuses match-detail-view.tsx but in a completed-match state. The tactical-view.tsx component provides the spatial laboratory (pitch visualization). These must work together to present: (1) a KPI summary row, (2) tactical pitch diagram with player nodes and formation, (3) heatmap for spatial dominance, (4) radar chart for multi-dimensional team comparison, (5) bar charts for discrete stat comparisons. The layout uses a masonry-style grid with the tactical pitch as the dominant element.",
    dataDetail: "Match details come from /api/matches with full statistics. The prediction engine provides model accuracy (predicted vs actual outcome). Tactical/spatial data (heatmaps, passing networks) may only be available for matches where ELASTICO has access to detailed event data - most ESPN-sourced matches will not have this. Show elegant unavailable states. Player performance data aggregates from the match events.",
    assetsDetail: [
      "Team crests: ESPN API logos for both teams.",
      "Competition logo: From ESPN or local cache.",
      "Player representation: Use numbered circular nodes on tactical diagrams (matching reference's approach), NOT photographs.",
      "No player headshots required on this screen - the focus is on tactical/statistical analysis.",
    ],
    preserve: [
      "The masonry-style grid with a large tactical pitch as the optical center and dominant element.",
      "KPI metric cards row at the top with icon + large number + sparkline/progress bar format.",
      "Custom tactical pitch visualization with player nodes, movement arrows, and zone highlighting.",
      "Radar chart (hexagonal/spider) for multi-attribute team comparison.",
      "Heatmap overlay on pitch template showing spatial dominance.",
      "Grouped bar charts for direct statistical comparison between the two teams.",
      "Semantic icon usage (running figure for distance, speedometer for sprint) that is metaphorically correct.",
    ],
    change: [
      "Replace sample team names (Aether FC, Zenith United) and all sample statistics with real ELASTICO data.",
      "Replace the cyan/lime accent colors with ELASTICO's design-system tokens.",
      "Remove hatched 'Pressing Zones' if real pressing data doesn't exist for the match.",
      "Adapt the 4-KPI top row to show only metrics that are actually available in the data model.",
      "If tactical/spatial data is unavailable, show 'Spatial data not available for this match' per philosophy Section 25.",
      "Ensure the analysis follows the philosophy's 'Charts Must Answer Questions' principle (Section 14) - every visualization must have a clear analytical purpose.",
    ],
    infoBelongs: [
      "Match identity and final score with competition context.",
      "Team performance KPIs: distance covered, sprints, pass accuracy, shots on target (only metrics available in the data model).",
      "Tactical formation diagram showing starting XI positions for both teams.",
      "Statistical comparison: possession, shots, passes, fouls, corners (from match data).",
      "Player performance highlights: top performers from each team with key contributions.",
      "Model accuracy: predicted outcome vs actual outcome (if prediction exists for this match).",
    ],
    mustNotCopy: [
      "Team names 'Aether FC' and 'Zenith United' - these are reference placeholders.",
      "Specific statistics: 11.2, 34.5, 88%, 321/385 - these are fabricated numbers.",
      "The exact cyan (#00d2ff) and lime (#4ade80) color pairing.",
      "The 'Movement Zone' and 'Pressing Zone' toggle labels if no pressing data exists.",
      "Player numbers on the pitch if they don't correspond to real jersey numbers from the match data.",
      "The specific radar chart attribute labels if those metrics aren't in the data model.",
    ],
    composition: "At 1366x768, the Match Analysis screen uses the full content area. Top row (~100px): 4 KPI metric cards equally spaced. Second row (~300px): three-column split - tactical pitch (50% width), heatmap (25%), donut/summary (25%). Third row (~300px): two-column split - bar chart comparison (55%) and radar chart (45%). Gutters: 16-24px between cards. Internal card padding: 20-24px. The KPI cards use compact layout: icon (left) + large number (center) + trend indicator (right). Chart axes use 11-12px labels with tabular figures.",
    responsive: "At 1280x720, reduce KPI cards to 3 across and stack the remaining one. Middle rows become 2-column (pitch full width on top, heatmap + donut below). At 1024x768, single-column stack: KPIs > pitch > charts. Below 768px, charts may need horizontal scroll within their containers.",
    acceptance: [
      "All statistics shown are real data from the match API, not reference placeholders.",
      "Tactical pitch shows correct formations and player positions from the match data.",
      "If spatial data is unavailable, a well-designed empty state is displayed.",
      "Every chart has a clear analytical question it answers (no decorative charts).",
      "Team crests and match identity use real data from the API.",
      "The screen fits 1366x768 without horizontal overflow.",
      "Charts are constrained within their containers (no escape).",
      "Model prediction accuracy is shown if a prediction existed for this match.",
    ],
  },
  // ── SCREEN 05: PLAYER COMPARISON ──
  {
    title: "Player Comparison", refFile: "xWXF9jOh...jfif",
    purpose: "Head-to-head analytical comparison of two players. This screen answers: How do these two players compare? The philosophy (Section 27) is explicit: align comparable metrics side by side, make differences obvious, and do not force users to jump between separate cards to compare values.",
    primaryQuestion: "How do these two players compare?",
    primaryInfo: "Side-by-side player identity, aligned statistical comparison rows, visual comparison bars/charts showing relative performance.",
    primaryAction: "Swap Player (change one of the compared players) or View Player (navigate to either player's full profile).",
    component: "compare-view.tsx",
    dataSource: "/api/players + Zustand store (teams, selectedPlayers) + DB (player stats)",
    assets: "Player headshots (2), team crests (2), country flags (2).",
    componentDetail: "compare-view.tsx is the existing player comparison component. It must be redesigned to show two players in a directly comparable layout where metrics are aligned in shared rows. The current implementation may use separate cards for each player - this must change to a unified comparison table/chart format. A player selector at the top allows swapping either player. The comparison should include radar charts for multi-dimensional overlap, aligned stat rows for direct numerical comparison, and visual bars showing relative performance.",
    dataDetail: "Player statistics come from /api/players and the database. The Zustand store manages which two players are selected for comparison. All compared metrics must exist in the actual data model. If a metric exists for one player but not the other, show the available value and 'N/A' for the missing one - never fabricate the missing value.",
    assetsDetail: [
      "Player headshots: ESPN athlete photos for both players, circular crop with consistent sizing (~80-100px). Initials fallback if photo unavailable.",
      "Team crests: ESPN API logos for both players' current clubs.",
      "Country flags: For both players' nationalities from a consistent flag library.",
    ],
    preserve: [
      "The hero player imagery with asymmetric card layout creating visual impact.",
      "Side-by-side player identity presentation with clear visual differentiation.",
      "Comparative progress bars showing dual-color fills for each player's stats.",
      "The 'VS' or comparison indicator between the two players.",
      "Glassmorphism-style floating cards with backdrop blur over a dark background.",
      "Player headshots used as identity anchors, not decorative elements.",
      "Match context card showing which match/season the comparison is based on.",
    ],
    change: [
      "Remove the specific player (Bruno Fernandes) and match context (Portugal vs France, Semi-Final) from the reference.",
      "Replace the full-bleed celebration photo background - ELASTICO should use a contained player card, not a photographic hero background, unless a legitimate editorial image exists.",
      "Adapt the glassmorphism to use ELASTICO's surface system (no excessive backdrop-blur abuse).",
      "Ensure the comparison table follows the philosophy's aligned-metrics approach (Section 27) - shared rows, not separate cards.",
      "Remove the LIVE pulse indicator if this is a historical/static comparison.",
      "Replace the Portugal red/France blue team-specific colors with a generic comparison color system (e.g., Player A color vs Player B color).",
    ],
    infoBelongs: [
      "Player A identity: name, position, team, nationality, headshot.",
      "Player B identity: name, position, team, nationality, headshot.",
      "Aligned stat comparison rows: Goals, Assists, Appearances, Pass Accuracy, xG (if available), and other metrics that exist in the data model for BOTH players.",
      "Visual comparison: horizontal bars or radar chart showing relative performance.",
      "Season/context selector: which time period the comparison covers.",
      "Per-match breakdown if drilling into specific fixtures.",
    ],
    mustNotCopy: [
      "Bruno Fernandes, Portugal, France, Semi-Final - all reference-specific entities.",
      "The specific heatmap overlay if it references Bruno Fernandes's actual positional data.",
      "The '1 Goal, 1 Assist' stat pills if they don't match real data.",
      "The 'LIVE' badge with pulse animation - comparisons are typically static analyses.",
      "The exact red (#DC143C) and blue (#002395) team-specific color coding.",
      "The 'Match Zone' breadcrumb navigation text.",
    ],
    composition: "At 1366x768, the Compare screen uses the full content area. Top section (~180px): two player identity cards side by side (each ~45% width) with a 'VS' divider in the center (~10%). Each card shows headshot (80px circle), name, position, team crest, nationality flag, and 2-3 key KPI numbers. Middle section (~300px): primary comparison area - aligned stat rows in a table format (metric name | player A value | player B value | visual bar). Bottom section (~250px): radar chart (left 50%) for multi-dimensional comparison and match context / season selector (right 50%). Gutters: 16-24px.",
    responsive: "At 1280x720, maintain side-by-side player cards but reduce headshot size. At 1024x768, stack player cards vertically with a horizontal 'VS' divider. Below 768px, full vertical stack: player A > player B > comparison table > radar chart. The radar chart may need a minimum 300px width.",
    acceptance: [
      "Both player identities show real data (name, team, position) from the API.",
      "All compared metrics exist in the data model for both players - no fabricated numbers.",
      "If a metric is missing for one player, 'N/A' is shown (not zero or a guessed value).",
      "The comparison table aligns metrics in shared rows for direct visual comparison.",
      "Player selector allows swapping either player with a search interface.",
      "Team crests render correctly for both players' clubs.",
      "The screen fits 1366x768 without horizontal overflow.",
    ],
  },
  // ── SCREEN 06: PREDICTIONS ──
  {
    title: "Predictions", refFile: "ChatGPT Image Aug 12, 08_54_08 AM.png",
    purpose: "Decision environment for match predictions. This screen answers: What does the model predict, and how confident is it? The philosophy (Section 26) is explicit: immediately communicate match, model, probabilities, confidence, generation time, data freshness, match state, and outcome if completed. Do not make it look like a casino.",
    primaryQuestion: "What does the model predict, and how confident is it?",
    primaryInfo: "Match predictions with probabilities, model confidence levels, prediction performance tracking (win rate, ROI), upcoming fixtures with forecasted outcomes.",
    primaryAction: "View Match Analysis (navigate to the specific match's analytical view) or Filter Predictions (by league, date range, confidence level).",
    component: "predictions-view.tsx",
    dataSource: "/api/predictions + prediction engine + Zustand store (predictions, matches)",
    assets: "Team crests (from ESPN or prediction data), league/competition badges.",
    componentDetail: "predictions-view.tsx is the existing predictions component. It must be transformed into a decision environment with a data-dense prediction table as the primary element, supported by model consensus and performance summary panels. The current implementation may show basic prediction cards - this must become a structured table with sortable columns, confidence badges, and model agreement indicators. Sub-navigation tabs should filter by prediction type (Match Winner, Over/Under, BTTS, etc.).",
    dataDetail: "Predictions come from /api/predictions which connects to the prediction engine. The engine generates probabilities for match outcomes. Model confidence and consensus data comes from the prediction engine's internal state. Historical prediction performance (win rate, ROI) is tracked in the database. Match data (teams, dates, leagues) comes from /api/matches and ESPN.",
    assetsDetail: [
      "Team crests: ESPN API logos for predicted match teams, displayed at ~24px in table rows and ~40px in headers.",
      "League/competition badges: For filtering and grouping predictions by competition.",
      "No player imagery on this screen - it's match-focused, not player-focused.",
    ],
    preserve: [
      "The hybrid layout: data-dense table (65% width) with summary KPI cards/panels (35% width).",
      "Sub-navigation tabs for prediction types (Match Winner, Over/Under, BTTS, Correct Score, All Leagues).",
      "Date range filter (e.g., 'Next 7 Days') aligned in the header area.",
      "Model consensus donut chart showing agreement percentage between models.",
      "Progress bars within table rows showing probability percentages.",
      "Confidence badges (High/Medium/Low) with color-coded background fills.",
      "Compact table rows (48-52px height) for high-density scanning.",
    ],
    change: [
      "Remove all sample prediction data: specific teams, percentages (78%, 71%), ROI (+18.4%), win rates (72%).",
      "Replace the 5-dot reliability score with ELASTICO's own confidence indication system.",
      "Adapt the color palette to use ELASTICO's design tokens (#00D26A brand green for positive, standard red/amber for negative/medium).",
      "Ensure the screen follows the philosophy's 'Decision Environment' principle - analytical, not casino-like.",
      "Add data freshness indicators (when the prediction was generated, when data was last updated).",
      "Show the specific model name/version that generated each prediction.",
    ],
    infoBelongs: [
      "Prediction table with columns: Match (teams + crests), Prediction (outcome), Probability (%), Confidence (High/Medium/Low badge), Model, Generated At.",
      "Model consensus summary: percentage agreement between models, with drill-down capability.",
      "Prediction performance KPIs: overall win rate, ROI, number of predictions tracked.",
      "Filter controls: date range, league/competition, prediction type, minimum confidence.",
      "Outcome tracking: for completed matches, show predicted vs actual outcome.",
    ],
    mustNotCopy: [
      "Specific match predictions or probabilities from the reference.",
      "The 72% win rate and +18.4% ROI numbers.",
      "The 83% model consensus donut value.",
      "Specific team matchups shown in the reference prediction table.",
      "The 'Next 7 Days' date range if ELASTICO uses different defaults.",
    ],
    composition: "At 1366x768, the Predictions screen fills the content area. Header bar (~80px): breadcrumbs (Predictions > Match Winner), sub-nav tabs, date filter. Body splits: left/center prediction table (~65% = ~730px), right summary panels (~35% = ~390px). The table has columns: Match (200px), Prediction (120px), Probability (100px), Confidence (100px), Model (150px). Right panels: Model Consensus donut (top, ~200px height) and Prediction Performance KPIs (bottom, ~200px height). Table rows: 48-52px, with 16px internal padding.",
    responsive: "At 1280x720, compress right panel to 300px, table absorbs the difference. At 1024x768, stack vertically: filters > KPIs > prediction table (full width) > consensus panel. Below 768px, the table may scroll horizontally within its container. The donut chart remains visible but smaller.",
    acceptance: [
      "All predictions shown are real outputs from the prediction engine, not reference placeholders.",
      "Probabilities and confidence levels reflect actual model outputs.",
      "Team crests render correctly in prediction table rows.",
      "Filter controls (date, league, type) actually filter the displayed predictions.",
      "For completed matches, predicted vs actual outcomes are both shown.",
      "Data freshness timestamps are visible on each prediction.",
      "The screen fits 1366x768 without horizontal overflow.",
      "The tone is analytical and professional, not casino-like.",
    ],
  },
  // ── SCREEN 07: AI ANALYST ──
  {
    title: "AI Analyst", refFile: "ChatGPT Image Aug 12, 08_48_21 AM (2).png",
    purpose: "Conversational reasoning interface. This screen answers: What analytical insight can the AI provide about this football question? The philosophy (Section 16) is explicit: AI should live inside the analysis, not be marketed as 'AI INSIGHT' on every page. Use contextual analytical language, not marketing language.",
    primaryQuestion: "What analytical insight can the AI provide?",
    primaryInfo: "Conversational AI interface with contextual football analysis, source citations, suggested follow-up questions, and analytical reasoning chains.",
    primaryAction: "Ask Question (text input for natural language query) or Select Suggested Question (tap a pre-built analytical prompt).",
    component: "chat-view.tsx",
    dataSource: "AI Gateway (7 providers via /api/chat or equivalent) + context from Zustand store (current match, player, prediction context)",
    assets: "Minimal - this is primarily a text-based interface. Source badges for data attribution.",
    componentDetail: "chat-view.tsx is the existing AI chat component. It connects to 7 AI providers through a gateway. The redesign must transform it from a generic chatbot UI into a contextual reasoning interface that understands football context. Key features: (1) context-aware queries that know which match/player/screen the user is viewing, (2) source citations showing which data sources support the AI's claims, (3) suggested follow-up questions relevant to the current analytical context, (4) a clean message history with clear user/AI visual distinction.",
    dataDetail: "The AI Gateway connects to 7 different providers. Context from the Zustand store (current match, selected player, active predictions) should be injected into AI queries to provide football-specific responses. The /api/chat endpoint (or equivalent) handles the AI request/response cycle. All AI responses must be grounded in real data - the philosophy forbids inventing explainability when the underlying engine cannot support it (Section 16).",
    assetsDetail: [
      "Minimal asset requirements - this is a text-heavy interface.",
      "Source attribution badges: small icons/labels for 'Match Data', 'ESPN Stats', 'Model Output' to cite data sources.",
      "Team crests may appear in AI responses when referencing specific teams - use the same resolveTeamLogo() function.",
      "No decorative imagery - the content is the interface.",
    ],
    preserve: [
      "The multi-row KPI cards at the top showing system status and key metrics (matches tracked, prediction accuracy, etc.).",
      "Chat bubble interface with clear visual distinction between user queries and AI responses.",
      "Source citations attached to AI responses showing data provenance.",
      "Suggested follow-up questions as tappable prompts below AI responses.",
      "Real-time status indicators (green dot for 'Live', 'Operational' status for AI system health).",
      "Feed/list format for AI Insights showing icon indicators and timestamps.",
    ],
    change: [
      "Remove the generic dashboard layout (6 KPI cards, live matches list, etc.) - the AI Analyst should be a focused reasoning interface, not a second dashboard.",
      "Replace marketing language ('Elite Analyst', 'Most Confident Prediction') with analytical language ('Model Interpretation', 'Key Factor').",
      "Ensure AI responses use the philosophy's microcopy guidelines (Section 39): 'Model confidence' not 'AI-powered predictive confidence score'.",
      "Inject football context from the current view into AI queries automatically.",
      "Add source attribution badges to every analytical claim in AI responses.",
      "Remove the 'System Status' and generic performance sparklines - focus on the conversational interface.",
    ],
    infoBelongs: [
      "Chat message history: user questions and AI responses with timestamps.",
      "Context indicator showing what entity the AI is analyzing (current match, player, prediction).",
      "Source citations on AI responses: which data sources support each claim.",
      "Suggested follow-up questions relevant to the current analytical context.",
      "Text input field with send button for natural language queries.",
      "Conversation history for the current session (clearable).",
    ],
    mustNotCopy: [
      "The generic dashboard KPI cards (6 equal-width metric cards at the top) - this is not a dashboard.",
      "Marketing language: 'Elite Analyst', 'Most Confident Prediction', 'System Status'.",
      "The 'Live Matches' list and 'Top Predictions' table - those belong on their own screens.",
      "The multi-chart layout (donut, line chart, sparklines) - the AI Analyst is a reasoning interface, not a chart gallery.",
      "Specific metric values (prediction accuracy percentages, ROI numbers) from the reference.",
    ],
    composition: "At 1366x768, the AI Analyst screen uses a focused layout. Left panel (~300px): conversation history list showing previous queries with timestamps. Right panel (~826px): primary chat area. At the top of the right panel, a context bar (~40px) shows the current analytical context (e.g., 'Analyzing: Arsenal vs Chelsea - Premier League'). Below that, the chat messages area (scrollable, ~550px) with user messages right-aligned and AI responses left-aligned with source badges. At the bottom, an input bar (~60px) with text field and send button. Suggested questions appear as chips above the input field.",
    responsive: "At 1280x720, narrow the conversation history panel to 240px. At 1024x768, collapse the history panel into a toggleable drawer, giving the chat area full width. Below 768px, full-width chat with a history icon to open the drawer. The input bar remains fixed at the bottom.",
    acceptance: [
      "AI responses are grounded in real data with visible source citations.",
      "The context bar shows the current analytical entity (match, player, etc.).",
      "Suggested follow-up questions are relevant to the current context.",
      "No marketing language ('AI-powered', 'Elite', 'Intelligent') in the interface.",
      "Chat messages are clearly distinguishable (user vs AI).",
      "The input field is always visible and accessible at the bottom.",
      "The screen fits 1366x768 without horizontal overflow.",
      "Empty state shows suggested questions to start the conversation.",
    ],
  },
  // ── SCREEN 08: ANALYTICS ──
  {
    title: "Analytics", refFile: "ChatGPT Image Aug 12, 08_48_20 AM (1).png",
    purpose: "Aggregate metrics and performance overview for the entire ELASTICO system. This screen answers: How is the system performing overall? It provides a bird's-eye view of model accuracy, prediction performance, data coverage, and system health across all tracked leagues and matches.",
    primaryQuestion: "How is the system performing overall?",
    primaryInfo: "Aggregate prediction performance metrics, model confidence distributions, data freshness indicators, league coverage summary, system health status.",
    primaryAction: "Drill Down (click any metric to see detailed breakdown) or Export (download analytics report).",
    component: "(no dedicated page - currently split between predictions-view and admin views)",
    dataSource: "/api/* aggregate endpoints + DB (prediction history, model logs) + Zustand store",
    assets: "League/competition crests for coverage overview.",
    componentDetail: "There is currently no dedicated analytics-view.tsx. This screen needs to be created. It should aggregate data from multiple API endpoints (/api/predictions for performance, /api/matches for coverage, /api/teams for league data) and present it in a coherent dashboard. The component should be registered in the Zustand currentView switch and added to the navigation. Key widgets: model performance over time, prediction accuracy by league, confidence distribution, data freshness timeline.",
    dataDetail: "Aggregate prediction data comes from the database (prediction history with outcomes). Model performance metrics (accuracy, calibration, ROI) are computed from historical predictions vs actual outcomes. League coverage data comes from /api/teams and /api/matches. System health data (API response times, data freshness) may need new tracking endpoints. If any aggregate data is not available, show it as 'Not yet tracked' rather than fabricating it.",
    assetsDetail: [
      "League/competition crests: For the coverage overview section, showing which leagues ELASTICO tracks.",
      "Minimal other assets - this is primarily a data visualization screen.",
    ],
    preserve: [
      "The 3-column layout: wide left column for primary predictive data, medium center for statistical breakdowns, narrow right for AI insights/status.",
      "Dual-colored progress bars showing direct opposition comparison (Home vs Away model performance).",
      "Live win probability line chart showing trend over match time.",
      "Donut chart for model confidence showing weighted average of different models.",
      "Status indicators: 'LIVE' badges, green dots for operational status.",
      "High information density appropriate for a power-user analytics screen.",
    ],
    change: [
      "Remove the specific match context (Man City vs Arsenal, '2-1' score, '87'' minute) - this is an aggregate screen, not a match-specific one.",
      "Replace the match-centric layout with a system-performance-centric layout.",
      "Remove the 'Ask AI Assistant' input field - that belongs on the AI Analyst screen.",
      "Add aggregate metrics not in the reference: prediction accuracy over time, league coverage, data freshness.",
      "Ensure charts follow the 'Charts Must Answer Questions' principle (philosophy Section 14).",
      "Remove the 'Customise' button if it doesn't connect to real functionality.",
    ],
    infoBelongs: [
      "Prediction performance over time: accuracy trend line, cumulative ROI, number of predictions.",
      "Accuracy by league/competition: which leagues the model performs best/worst on.",
      "Model confidence distribution: how often the model is High/Medium/Low confidence.",
      "Data freshness: last update time for each data source (ESPN, model, etc.).",
      "League coverage: which competitions are tracked, how many matches per league.",
      "System health: API response times, error rates, data pipeline status.",
    ],
    mustNotCopy: [
      "The Man City vs Arsenal match context, '2-1' score, '87'' minute marker.",
      "The specific xG values and probability percentages from the reference.",
      "The 'Live Win Probability' chart if it refers to a specific match - this screen shows aggregate data.",
      "The 'Ask AI Assistant' input field - that's the AI Analyst screen's responsibility.",
      "The 'Top Players' list if it refers to a specific match.",
    ],
    composition: "At 1366x768, the Analytics screen fills the content area. Top row (~80px): screen title, date range selector, and export button. Second row (~120px): 4-5 KPI summary cards (Total Predictions, Accuracy %, Avg Confidence, Leagues Tracked, Data Freshness). Third row (~250px): two-column split - performance trend chart (left 60%, line chart showing accuracy/ROI over time) and confidence distribution donut (right 40%). Fourth row (~250px): two-column split - league coverage table (left 60%) and system health status panel (right 40%). Gutters: 16-24px, card padding: 16-20px.",
    responsive: "At 1280x720, reduce KPI cards to 4 across. At 1024x768, stack the third and fourth rows into single-column layouts. Below 768px, full vertical stack. The league coverage table may need horizontal scroll.",
    acceptance: [
      "A dedicated analytics-view.tsx component exists and is registered in the navigation.",
      "All aggregate metrics are computed from real prediction history data.",
      "If historical prediction data is insufficient, an elegant 'Insufficient data' state is shown.",
      "Charts have clear analytical purposes and answer specific questions.",
      "Date range selector filters the analytics data correctly.",
      "The screen fits 1366x768 without horizontal overflow.",
      "League coverage accurately reflects which competitions ELASTICO actually tracks.",
    ],
  },
  // ── SCREEN 09: SETTINGS ──
  {
    title: "Settings", refFile: "ChatGPT Image Aug 13, 04_03_10 AM.png",
    purpose: "Quiet utility configuration screen. This screen answers: How do I configure ELASTICO to my preferences? The philosophy (Section 28) is explicit: Settings should be calm, organized, compact, predictable, and functional. Do not make Settings look like the dashboard.",
    primaryQuestion: "How do I configure ELASTICO?",
    primaryInfo: "User preferences, display settings, data preferences, notification settings, account management.",
    primaryAction: "Save Changes (persist updated settings).",
    component: "settings-view.tsx",
    dataSource: "Local state + /api/setup + /api/auth/* + Zustand store (user preferences)",
    assets: "Minimal - user avatar if authenticated.",
    componentDetail: "settings-view.tsx is the existing settings component. It currently handles basic configuration. The redesign must transform it into a calm, organized utility screen using a master-detail layout: a vertical category list on the left (Account, Display, Data, Notifications) and a configuration form panel on the right. This is NOT a dashboard - it should use minimal visual ornamentation, clear form controls, and predictable layouts. Toggle switches, dropdowns, and input fields should follow the design system's form component specifications.",
    dataDetail: "Settings are primarily local state (theme, language, notification preferences) persisted to localStorage or the user's database record. Account management uses /api/auth/* endpoints. The /api/setup endpoint handles initial configuration. The Zustand store holds user preferences and auth state. No external data APIs are needed for this screen.",
    assetsDetail: [
      "User avatar: if authenticated, show the user's avatar from the auth provider. If not, show initials.",
      "Minimal other assets - this is a functional utility screen, not a visual showcase.",
    ],
    preserve: [
      "The master-detail layout: left navigation list for setting categories, right form panel for configuration.",
      "Calm, understated visual treatment - this is not a dashboard.",
      "Toggle switches (iOS-style) for boolean settings.",
      "Dropdown selectors for enum-based settings.",
      "Tabular/form-based layout rather than card-based.",
      "Uppercase section headers with consistent spacing.",
    ],
    change: [
      "Remove any dashboard-like elements (KPI cards, charts, live data).",
      "Adapt the layout to use ELASTICO's design-system form components.",
      "Ensure settings categories match what ELASTICO actually supports (don't show options that don't work).",
      "Add proper form validation and save confirmation feedback.",
      "Use the design system's toggle/dropdown components, not custom implementations.",
      "Ensure the 'quiet utility' principle (philosophy Section 28) is maintained throughout.",
    ],
    infoBelongs: [
      "Account: profile information, email, password change, authentication status.",
      "Display: theme (dark/light), language, density (compact/comfortable), sidebar position.",
      "Data: preferred leagues/competitions, default match view, data refresh interval.",
      "Notifications: which events trigger notifications, notification delivery method.",
      "About: ELASTICO version, data sources, credits.",
    ],
    mustNotCopy: [
      "The dashboard content (live match, charts, analytics) visible in the reference - this is a SETTINGS screen, not a dashboard.",
      "The purple (#8B5CF6) active state color if it conflicts with ELASTICO's design tokens.",
      "The specific setting categories shown in the reference if they don't match ELASTICO's actual features.",
      "Any live data widgets or KPI cards.",
    ],
    composition: "At 1366x768, the Settings screen uses a master-detail layout. Left panel (~240px): vertical list of setting categories (Account, Display, Data, Notifications, About) with text labels and active state indication. Right panel (~886px): configuration form for the selected category. Forms use standard vertical layout with label above control, 24px vertical spacing between groups. Toggle switches: 44px width, 24px height. Dropdown selectors: full-width within the form panel. Input fields: full-width with 12px border radius and 8px padding. The layout is calm and spacious - no charts, no KPIs, no live data.",
    responsive: "At 1280x720, maintain the master-detail split. At 1024x768, narrow the category panel to 200px. Below 768px, stack vertically: category selector as horizontal tabs at the top, form panel below. All form controls remain full-width and usable.",
    acceptance: [
      "All setting categories shown actually correspond to functional settings (no dead options).",
      "Toggle switches and dropdowns are wired to real state management.",
      "Save changes persists to localStorage or database and shows confirmation.",
      "The screen is visually calm and does not look like a dashboard.",
      "Form controls follow the design system's component specifications.",
      "The screen fits 1366x768 without horizontal overflow.",
      "Navigation back to the main workspace is accessible.",
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// COVER (R1 - Pure Paragraph Left)
// ═══════════════════════════════════════════════════════════════════
function calcTitleLayout(title, maxWidth, preferredPt = 40, minPt = 24) {
  const CHARS_PER_PT = 0.52;
  let pt = preferredPt;
  while (pt > minPt) {
    const charsPerLine = Math.floor(maxWidth / (pt * 14.6));
    if (charsPerLine <= 0) { pt--; continue; }
    const lines = Math.ceil(title.length / charsPerLine);
    if (lines <= 3) return { titlePt: pt, titleLines: splitTitleLines(title, charsPerLine) };
    pt--;
  }
  return { titlePt: minPt, titleLines: [title] };
}
function splitTitleLines(title, charsPerLine) {
  const breakAfter = new Set(" ,.!?;:-/()[]{}".split(""));
  const lines = [];
  let remaining = title;
  while (remaining.length > 0) {
    if (remaining.length <= charsPerLine) { lines.push(remaining.trim()); break; }
    let breakAt = -1;
    for (let i = Math.min(charsPerLine, remaining.length); i > charsPerLine * 0.7; i--) {
      if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  return lines;
}
function calcCoverSpacing(p) {
  const SAFETY = 1200;
  const usable = 16838 - (p.marginTop || 0) - (p.marginBottom || 0) - SAFETY;
  const contentH =
    (p.titleLineCount || 1) * ((p.titlePt || 36) * 23 + 200) +
    (p.hasSubtitle ? (12 * 23 + 600) : 0) +
    (p.metaLineCount || 0) * (10 * 23 + 100) +
    (p.fixedHeight || 800) + 900;
  const remaining = Math.max(usable - contentH, 400);
  const rawTop = Math.floor(remaining * 0.45);
  const rawBottom = Math.floor(remaining * 0.45);
  return { topSpacing: Math.max(rawTop, 400), bottomSpacing: Math.max(rawBottom, 800) };
}

function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const { titlePt, titleLines } = calcTitleLayout(config.title, 11906 - padL - padR - 300, 40, 24);
  const titleSize = titlePt * 2;
  const sp = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt, hasSubtitle: !!config.subtitle,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: sp.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "),
        size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: P.titleColor, font: { ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor, font: { ascii: "Calibri" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 }, border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.metaColor, font: { ascii: "Calibri" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: sp.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                                  " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: c(P.bg) }, borders: noBorders, children })],
    })],
  })];
}

// ═══════════════════════════════════════════════════════════════════
// ASSEMBLE DOCUMENT
// ═══════════════════════════════════════════════════════════════════

// -- Body content --
const bodyContent = [];

// -- Introduction --
bodyContent.push(h1("Introduction"));
bodyContent.push(body("This document is the Visual Reference Execution Brief for ELASTICO, a football intelligence workstation built on Next.js 15. It serves as the definitive bridge between the ELASTICO UX/UI Philosophy document (which defines the design intent, principles, and visual direction) and the actual UI implementation to be executed by GLM (an AI coder)."));
bodyContent.push(body("The brief covers nine screens that compose the ELASTICO experience: Dashboard, Live Match, Player Profile, Match Analysis, Player Comparison, Predictions, AI Analyst, Analytics, and Settings. For each screen, it provides a detailed specification mapping visual reference images to concrete implementation requirements, removing ambiguity before the implementation phase begins."));
bodyContent.push(body("Each screen specification includes: what to preserve from the visual reference, what to change, what information belongs on that screen, which existing ELASTICO component supplies it, which API or Zustand store supplies the data, which assets should be sourced, what must NOT be copied from the reference, the 1366 x 768 composition layout, responsive behavior, and acceptance criteria."));

bodyContent.push(h1("How to Use This Brief"));
bodyContent.push(body("This brief is structured to be read screen-by-screen. Each screen section is self-contained: an implementer can work on any screen by reading its section without needing to cross-reference other sections. However, the Design System Foundations section below establishes shared tokens and rules that all screens must follow."));
bodyContent.push(bullet("Read the Design System Foundations section first to understand the shared visual language."));
bodyContent.push(bullet("For each screen, start with the Purpose and Primary Question to understand the screen's intent."));
bodyContent.push(bullet("Use the specification table to identify the component, data source, and assets required."));
bodyContent.push(bullet("Follow the 'What to Preserve' and 'What to Change' lists to translate the reference into ELASTICO's design language."));
bodyContent.push(bullet("Use the '1366 x 768 Composition' section to understand the exact layout at the target viewport."));
bodyContent.push(bullet("Verify completion against the Acceptance Criteria checklist."));
bodyContent.push(bullet("Never copy sample data (player names, scores, statistics) from the references. All data must come from real ELASTICO data sources."));

bodyContent.push(h1("Design System Foundations"));
bodyContent.push(body("Before implementing any individual screen, the following design-system primitives must be established. These tokens define the shared visual DNA that makes ELASTICO feel like one product, not nine disconnected dashboards. The philosophy document (Sections 8-12, 29-31) provides the full rationale; this section defines the concrete tokens."));

bodyContent.push(h2("Color Tokens"));
bodyContent.push(body("ELASTICO uses a restrained premium dark foundation. The base palette is derived from the visual references but unified into a single consistent token system. Background surfaces use near-black charcoals with subtle blue undertones (#0a0e17, #131a29, #1a1f2e). Text uses high-contrast white (#f9fafb) for primary and muted grays (#9ca3af, #6b7280) for secondary and tertiary levels. The brand accent is a restrained emerald green (#10b981) used for positive states, active navigation, and success indicators. Data visualization colors follow semantic rules: green for positive, red for negative, blue for neutral, amber for caution. Team identity colors override data colors when showing team-specific information. Every color must communicate state, hierarchy, selection, or sentiment - decorative color is forbidden."));

bodyContent.push(h2("Typography Scale"));
bodyContent.push(body("The type system uses a clean geometric sans-serif (Inter) as the primary font family. Headings use semibold weight (600) at 18-24px. Section labels use uppercase with wide letter-spacing (0.05em) at 11-12px. Body text uses regular weight (400) at 13-14px with 1.4-1.5 line height. Data values and KPI numbers use bold weight (700) at 24-48px, with tabular/monospaced figures for numerical alignment. The philosophy warns against making everything bold or every heading enormous - restraint creates hierarchy."));

bodyContent.push(h2("Spacing System"));
bodyContent.push(body("The spacing system uses an 8px base unit. Card internal padding is 16-20px. Gutters between cards are 16-24px. Section margins between major layout blocks are 24-32px. Element spacing within cards uses tight 4-8px gaps between label-value pairs and 12-16px between list items. Edge-of-viewport margins are 24-32px. The philosophy emphasizes that spacing communicates hierarchy: large gaps separate conceptual sections, medium gaps group related information, and small gaps connect tightly related data. Identical spacing everywhere is forbidden."));

bodyContent.push(h2("Surface and Border System"));
bodyContent.push(body("ELASTICO uses subtle surface elevation rather than heavy shadows or glowing borders. Cards use 1px borders with rgba(255,255,255,0.03-0.06) on dark backgrounds, creating depth without visual noise. Border radius is consistently 8-12px across all card and container components. The philosophy explicitly warns against glowing borders, excessive neon, and the 'AI-generated design' aesthetic. If everything is highlighted, nothing is highlighted."));

bodyContent.push(h2("Component Library Primitives"));
bodyContent.push(body("The following components must be established as shared primitives before implementing individual screens: navigation sidebar (icon + label, active state with green accent), tab groups (for sub-navigation within screens), data tables (minimalist with row hover, zebra striping, sortable headers), stat comparison bars (horizontal dual-color bars), metric cards (icon + label + large value + trend), status badges (LIVE, HT, FT with color semantics), form controls (toggle switches, dropdowns, text inputs with consistent styling), and chart containers (with consistent padding, axis styling, and legend treatment). Each component must have variants for its different states (default, hover, active, disabled, loading, empty, error)."));

// -- Screen sections --
for (let i = 0; i < screens.length; i++) {
  const s = screens[i];
  const sectionElements = screenSection(
    i + 1, s.title, s.refFile, s
  );
  for (const el of sectionElements) {
    bodyContent.push(el);
  }
}

// -- Cross-Cutting Concerns --
bodyContent.push(h1("Cross-Cutting Concerns"));

bodyContent.push(h2("Asset Resolution Layer"));
bodyContent.push(body("A centralized asset-resolution layer must be built before any screen implementation. The philosophy (Sections 18-22) mandates resolveTeamLogo(), resolvePlayerImage(), and resolveCountryFlag() functions that the UI calls without knowing where assets come from. The resolution chain is: verified provider image (e.g., ESPN logo URL) > local cached asset where licensing permits > professional fallback (initials, crest, silhouette). Never use AI-generated faces for real players. Never use emoji flags. Never scrape arbitrary copyrighted images."));

bodyContent.push(h2("Empty, Error, and Loading States"));
bodyContent.push(body("Every screen must handle three non-ideal states gracefully. Empty states (philosophy Section 33) must communicate what is missing, why (when useful), and what the user can do next. Error states (Section 34) must be calm and actionable, showing the last verified update time and a retry action. Loading states (Section 32) must use structural skeletons matching the eventual layout, not full-page spinners. Never fabricate replacement values for missing data."));

bodyContent.push(h2("Navigation Consistency"));
bodyContent.push(body("The single-shell architecture (page.tsx > Zustand currentView > 26 view components) must be preserved. The navigation sidebar must be consistent across all screens except Settings (which uses horizontal tabs). Active state indication must use the brand green accent with consistent left-border or background treatment. Navigation order must follow the user's mental model: Dashboard > Live Match > Player > Match Analysis > Compare > Predictions > AI Analyst > Analytics > Settings."));

bodyContent.push(h2("Data Honesty Rule"));
bodyContent.push(body("This is the non-negotiable foundation of ELASTICO's credibility. Every number displayed must be real data from an ELASTICO data source. Every image must be a legitimate asset or a professional fallback. If data is unavailable, show an elegant unavailable state. If a metric doesn't exist in the data model, omit it. If the reference shows a beautiful chart for data ELASTICO doesn't have, implement the unavailable state - not the chart with fake numbers. The philosophy (Section 41) states: a component that looks better with a fake number is a broken component."));

bodyContent.push(h2("Implementation Sequence"));
bodyContent.push(body("The philosophy (Section 43) defines the mandatory implementation order. The design system foundations (this document's Design System Foundations section) must be established first. Then: fix global shell and navigation, establish the laptop-first grid, implement Dashboard as the visual grammar setter, then Live Match as the hero experience, then Player and Match Analysis, then Predictions, Compare, AI Analyst, Analytics, and finally Settings. Responsive refinement and motion polish come last. Do not polish a broken hierarchy."));

// ═══════════════════════════════════════════════════════════════════
// BUILD DOCX
// ═══════════════════════════════════════════════════════════════════
const coverConfig = {
  title: "ELASTICO Visual Reference Execution Brief",
  subtitle: "Per-Screen Implementation Specifications for GLM",
  englishLabel: "CONFIDENTIAL  \u2022  PRODUCT DESIGN",
  metaLines: ["Version 1.0  |  August 2026", "Architecture: Next.js 15 + Zustand + ESPN API + Prisma"],
  footerLeft: "ELASTICO Football Intelligence",
  footerRight: "isaJrKai/Elastico",
  palette: {
    bg: PAL.bg, accent: c(PAL.accent),
    titleColor: PAL.coverTitle, subtitleColor: PAL.coverSub,
    metaColor: PAL.coverMeta, footerColor: PAL.coverFoot,
  },
};

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri" }, size: 24, color: "1A2B40" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: { run: { font: { ascii: "Times New Roman" }, size: 32, bold: true, color: "0A1628" } },
      heading2: { run: { font: { ascii: "Times New Roman" }, size: 28, bold: true, color: "0A1628" } },
      heading3: { run: { font: { ascii: "Calibri" }, size: 26, bold: true, color: "1A2B40" } },
    },
  },
  sections: [
    // Cover section
    {
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: buildCoverR1(coverConfig),
    },
    // TOC section
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 } },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT, spacing: { after: 0 },
            children: [new TextRun({ text: "ELASTICO Visual Reference Execution Brief", size: 16, color: "90989F", font: { ascii: "Calibri" }, italics: true })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "90989F", font: { ascii: "Calibri" } })],
          })],
        }),
      },
      children: [
        new Paragraph({
          spacing: { after: 300 },
          children: [new TextRun({ text: "Table of Contents", size: 36, bold: true, color: "0A1628", font: { ascii: "Times New Roman" } })],
        }),
        new TableOfContents("Table of Contents", {
          hyperlink: true, headingStyleRange: "1-3",
        }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: "(Right-click the TOC and select \u201cUpdate Field\u201d to refresh page numbers after opening in Word.)", size: 18, italics: true, color: "90989F", font: { ascii: "Calibri" } })],
        }),
        new Paragraph({ children: [new TextRun({ break: 1 })], pageBreakBefore: true }),
      ],
    },
    // Body section
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT, spacing: { after: 0 },
            children: [new TextRun({ text: "ELASTICO Visual Reference Execution Brief", size: 16, color: "90989F", font: { ascii: "Calibri" }, italics: true })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Page ", size: 18, color: "90989F", font: { ascii: "Calibri" } }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "90989F", font: { ascii: "Calibri" } }),
            ],
          })],
        }),
      },
      children: bodyContent,
    },
  ],
});

const OUTPUT = "/home/z/my-project/download/ELASTICO_Visual_Reference_Execution_Brief.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUTPUT, buf);
  console.log("Document saved to: " + OUTPUT);
});
