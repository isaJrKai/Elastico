const { Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType, HeadingLevel, PageNumber, PageBreak, TableOfContents, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, SectionType } = require("docx");
const fs = require("fs");

const P = { bg:"162235", body:"1C2A3D", secondary:"5B6B7D", accent:"37DCF2", cover:{titleColor:"FFFFFF",subtitleColor:"B0B8C0",metaColor:"90989F",footerColor:"687078"}, table:{headerBg:"1B6B7A",headerText:"FFFFFF",accentLine:"1B6B7A",innerLine:"C8DDE2",surface:"EDF3F5"} };
const c = h => h.replace("#","");
const allNoBorders = { top:{style:BorderStyle.NONE,size:0},bottom:{style:BorderStyle.NONE,size:0},left:{style:BorderStyle.NONE,size:0},right:{style:BorderStyle.NONE,size:0},insideHorizontal:{style:BorderStyle.NONE,size:0},insideVertical:{style:BorderStyle.NONE,size:0} };
const mkCell = (text, opts={}) => new TableCell({
  shading: opts.header ? {type:ShadingType.CLEAR,fill:c(P.table.headerBg)} : opts.alt ? {type:ShadingType.CLEAR,fill:c(P.table.surface)} : undefined,
  borders: { top:{style:BorderStyle.SINGLE,size:1,color:c(P.table.innerLine)},bottom:{style:BorderStyle.SINGLE,size:1,color:c(P.table.innerLine)},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE} },
  children: [new Paragraph({ alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({ text, size:20, color: opts.header ? c(P.table.headerText) : c(P.body), bold: !!opts.header, font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"} })] })]
});

function h1(t){return new Paragraph({heading:HeadingLevel.HEADING_1,spacing:{before:480,after:200},children:[new TextRun({text:t,bold:true,size:32,color:c(P.body),font:{ascii:"Calibri",eastAsia:"SimHei"}})]})}
function h2(t){return new Paragraph({heading:HeadingLevel.HEADING_2,spacing:{before:360,after:160},children:[new TextRun({text:t,bold:true,size:28,color:c(P.body),font:{ascii:"Calibri",eastAsia:"SimHei"}})]})}
function h3(t){return new Paragraph({heading:HeadingLevel.HEADING_3,spacing:{before:280,after:120},children:[new TextRun({text:t,bold:true,size:24,color:c(P.body),font:{ascii:"Calibri",eastAsia:"SimHei"}})]})}
function p(t){return new Paragraph({alignment:AlignmentType.JUSTIFIED,spacing:{line:312,after:120},children:[new TextRun({text:t,size:22,color:c(P.body),font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}})]})}
function pb(l,t){return new Paragraph({alignment:AlignmentType.JUSTIFIED,spacing:{line:312,after:80},children:[new TextRun({text:l,bold:true,size:22,color:c(P.body),font:{ascii:"Calibri"}}),new TextRun({text:t,size:22,color:c(P.body),font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}})]})}
function b(t){return new Paragraph({spacing:{line:312,after:60},indent:{left:480,hanging:240},children:[new TextRun({text:"\u2022  ",size:22,color:c(P.table.accentLine),font:{ascii:"Calibri"}}),new TextRun({text:t,size:22,color:c(P.body),font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}})]})}
function d(l,v){return new Paragraph({spacing:{line:312,after:60},indent:{left:480,hanging:240},children:[new TextRun({text:"\u2014  ",size:22,color:c(P.secondary),font:{ascii:"Calibri"}}),new TextRun({text:l+": ",bold:true,size:22,color:c(P.body),font:{ascii:"Calibri"}}),new TextRun({text:v,size:22,color:c(P.body),font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}})]})}
function m(t){return new Paragraph({spacing:{line:312,after:60},indent:{left:360},children:[new TextRun({text:t,size:20,color:"4A5568",font:{ascii:"Consolas",eastAsia:"Microsoft YaHei"}})]})}
function sp(){return new Paragraph({spacing:{after:60},children:[]})}

// Cover R1
function calcTitleLayout(title,maxW,pt=38,min=24){const cw=p=>p*20,cpl=p=>Math.floor(maxW/cw(p));let tp=pt,lines;while(tp>=min){const c=cpl(tp);if(c<2){tp-=2;continue;}lines=title.length<=c?[title]:[title.substring(0,Math.floor(c*0.65)),title.substring(Math.floor(c*0.65))];if(lines.length<=3)break;tp-=2;}if(!lines||lines.length>3){lines=[title];tp=min;}return{titlePt:tp,titleLines:lines};}
function calcCS(p){const S=1200,u=16838-p.mt-p.mb-S,tH=p.tl*(p.tp*23+200),sH=p.hs?(12*23+600):0,eH=p.el?(9*23+600):0,mH=p.ml*(10*23+100),iH=900,cH=tH+sH+eH+mH+p.fh+iH,r=Math.max(u-cH,400),FM=800,rT=Math.floor(r*0.45),rB=Math.floor(r*0.45),bS=Math.max(rB,FM),tS=Math.max(rT-Math.max(0,FM-rB),400);return{topSpacing:tS,bottomSpacing:bS};}
function buildCover(cfg){const pl=1200,pr=800,aw=11906-pl-pr-300,{titlePt:tp,titleLines:tl}=calcTitleLayout(cfg.title,aw);const ts=tp*2,sp=calcCS({tl:tl.length,tp,hs:!!cfg.subtitle,el:!!cfg.englishLabel,ml:(cfg.metaLines||[]).length,fh:400,mt:0,mb:0});const aL={style:BorderStyle.SINGLE,size:8,color:c(P.accent),space:12};const ch=[];ch.push(new Paragraph({spacing:{before:sp.topSpacing}}));if(cfg.englishLabel)ch.push(new Paragraph({indent:{left:pl,right:pr},spacing:{after:500},border:{bottom:{style:BorderStyle.SINGLE,size:6,color:c(P.accent),space:8}},children:[new TextRun({text:cfg.englishLabel.split("").join("  "),size:18,color:c(P.accent),font:{ascii:"Calibri"},characterSpacing:40})]}));for(let i=0;i<tl.length;i++)ch.push(new Paragraph({indent:{left:pl},spacing:{after:i<tl.length-1?100:300,line:Math.ceil(tp*23),lineRule:"atLeast"},children:[new TextRun({text:tl[i],size:ts,bold:true,color:c(P.cover.titleColor),font:{eastAsia:"SimHei",ascii:"Arial"}})]}));if(cfg.subtitle)ch.push(new Paragraph({indent:{left:pl},spacing:{after:800},children:[new TextRun({text:cfg.subtitle,size:24,color:c(P.cover.subtitleColor),font:{eastAsia:"Microsoft YaHei",ascii:"Arial"}})]}));for(const l of(cfg.metaLines||[]))ch.push(new Paragraph({indent:{left:pl+200},spacing:{after:80},border:{left:aL},children:[new TextRun({text:l,size:24,color:c(P.cover.metaColor),font:{eastAsia:"Microsoft YaHei",ascii:"Arial"}})]}));ch.push(new Paragraph({spacing:{before:sp.bottomSpacing}}));ch.push(new Paragraph({indent:{left:pl,right:pr},border:{top:{style:BorderStyle.SINGLE,size:2,color:c(P.accent),space:8}},spacing:{before:200},children:[new TextRun({text:cfg.footerLeft||"",size:16,color:c(P.cover.footerColor),font:{ascii:"Arial"}}),new TextRun({text:"                                                    ",size:16}),new TextRun({text:cfg.footerRight||"",size:16,color:c(P.cover.footerColor),font:{ascii:"Arial"}})]}));return[new Table({width:{size:100,type:WidthType.PERCENTAGE},layout:{type:"FIXED"},borders:allNoBorders,rows:[new TableRow({height:{value:16838,rule:"exact"},children:[new TableCell({shading:{type:ShadingType.CLEAR,fill:c(P.bg)},borders:allNoBorders,children:ch})]})]})];}

// ── SCREEN BRIEF DATA ──
const screens = [
{
num:4, title:"Dashboard", role:"Command center", ref:"Image 01 (9-screen atlas, top-left)",
sections:[
{t:"h2",v:"Purpose and Primary Question"},
{t:"p",v:"The dashboard answers: what matters right now? It is the first screen after login and must immediately orient the user with live football action, upcoming matches, current intelligence, and model information. It is a curated command center, not a summary of every database table. The composition follows the philosophy directive: a navigation rail on the left, a current football state strip, then a primary area for live/upcoming matches, a supporting analytical area, and compact secondary panels for standings and trends."},
{t:"h2",v:"What to Preserve from Reference"},
{t:"b",v:"Multi-panel grid layout with persistent left sidebar navigation and asymmetric information density."},
{t:"b",v:"High information density achieved through typographic hierarchy: large KPI numbers anchor the eye, smaller labels and metadata recede."},
{t:"b",v:"Dark premium aesthetic with restrained accent colors. Emerald/green for positive indicators, subtle borders, no neon glow."},
{t:"b",v:"Live score area as the dominant first-look element."},
{t:"h2",v:"What to Change"},
{t:"b",v:"Replace generic equal-card grid with asymmetric layout giving more space to the primary analytical area (live matches, standings)."},
{t:"b",v:"Replace sample data with real ESPN data via Zustand store. Team crests come from ESPN API URLs."},
{t:"b",v:"Use analytical surfaces (continuous regions with internal hierarchy) rather than uniformly-sized rounded rectangles."},
{t:"h2",v:"Existing Components and Data Sources"},
{t:"d",l:"Live scores",v:"fetchLiveScores() in Zustand store, calls /api/live (ESPN). Returns liveMatches with team logos, scores, time, league."},
{t:"d",l:"Standings",v:"EspnStandingsCard and EspnStandingsList already in dashboard-view.tsx. Calls /api/live?action=standings&league=PL. Returns real standings with ESPN logo URLs."},
{t:"d",l:"Matches",v:"fetchMatches() in Zustand, calls /api/matches (Prisma). Returns matches with status, scores, teams."},
{t:"d",l:"News",v:"fetchNews() in Zustand, calls /api/news (ESPN > Newsdata.io > DB)."},
{t:"d",l:"Form chart",v:"Recharts BarChart already exists in dashboard-view.tsx. Wire to real ESPN match results."},
{t:"h2",v:"Asset Requirements"},
{t:"b",v:"Team crests: supplied by ESPN API (a.espncdn.com). Already flowing via /api/live."},
{t:"b",v:"Country/league flags: must use a real flag asset system (flagcdn.com). Replace all colored circle placeholders."},
{t:"h2",v:"What Must NOT Be Copied"},
{t:"b",v:"Exact 4-column equal grid (ELASTICO needs asymmetric layout)."},
{t:"b",v:"Sample player/team names or scores from reference images."},
{t:"b",v:"ROI/Bankroll/betting-specific metrics."},
{t:"b",v:"Glowing card borders or neon accent effects."},
{t:"h2",v:"1366 x 768 Composition"},
{t:"p",v:"Sidebar collapsed to 64px icon rail. Main content area approximately 1302px wide. Top bar: ELASTICO branding left, view title center, notification bell + user avatar right (48px height). Below top bar: full-width live match ticker strip (auto-scrolling, 48-56px height) showing current live scores with team crests. Primary zone (top 60% of remaining): live match cards in a 2-column grid, each card showing team crests, names, score, match time, league badge. If no live matches, show upcoming matches with kick-off times. Secondary zone (bottom 40%): left 60% is ESPN standings table (EspnStandingsCard), right 40% is a compact form/stats panel or news digest. All within one continuous analytical surface, not separate cards floating in space."},
{t:"h2",v:"Responsive Behavior"},
{t:"p",v:"At 1280x720: sidebar remains 64px, card grid becomes single column for matches, standings table scrolls horizontally. At 1440x900 and above: more breathing room, 3-column match grid possible, standings get full width. Tablet (768-1024px): sidebar becomes overlay, single column layout, match cards stack vertically. Mobile (below 768px): bottom tab navigation replaces sidebar, match cards full width, standings in a horizontal scroll container."},
{t:"h2",v:"States"},
{t:"p",v:"Loading: skeleton rows matching the eventual match card and standings table layout. Empty (no live matches): \u0027No live matches right now\u0027 with a \u0027View upcoming\u0027 button. Error (ESPN failure): \u0027Live data temporarily unavailable. Last update: X minutes ago.\u0027 with Retry button."},
{t:"h2",v:"Acceptance Criteria"},
{t:"b",v:"Real ESPN team crests render in live match cards and standings (no colored circles)."},
{t:"b",v:"Live ticker auto-scrolls and updates every 60 seconds."},
{t:"b",v:"Information hierarchy is immediately clear at 1366x768: live scores are the largest element."},
{t:"b",v:"Standings table shows real data with team logos and proper W/D/L form indicators."},
{t:"b",v:"No fabricated data anywhere on the screen."},
{t:"b",v:"The screen feels like a command center, not a collection of cards."},
]},{
num:5, title:"Live Match", role:"Hero experience \u2014 the deepest analytical workspace", ref:"Image 02 (Real Madrid vs Levante tactical view)",
sections:[
{t:"h2",v:"Purpose and Primary Question"},
{t:"p",v:"This is where all of ELASTICO's intelligence comes together in one screen: live data, score, events, xG, prediction, tactical state, and model interpretation. This should become the hero experience of the application. The primary question is: what is happening in this match right now, and why? The philosophy calls this a Live Analytical Room. It is the most information-dense screen in the application, but complexity must become discoverable, not overwhelming."},
{t:"h2",v:"What to Preserve from Reference"},
{t:"b",v:"The three-column layout: left lineup, center tactical pitch, right opponent lineup. This is a strong spatial composition that centers the analytical surface."},
{t:"b",v:"The header bar with team crests, key performance indicators (possession, shots, passing accuracy), and the central scoreboard."},
{t:"b",v:"The bottom dashboard strip with commentary, event timeline, and statistical breakdown."},
{t:"b",v:"The textured dark background that creates a \u0027glass cockpit\u0027 or broadcast-quality feel."},
{t:"b",v:"Monochromatic team identity through accent colors rather than colorful crests."},
{t:"h2",v:"What to Change"},
{t:"b",v:"The reference shows a static tactical diagram. ELASTICO should start with an Overview tab and add tactical/spatial visualization only when real data supports it."},
{t:"b",v:"The reference uses abbreviated player nodes (\u0027BEN 23\u0027). ELASTICO should use full player names from ESPN rosters with position indicators."},
{t:"b",v:"Add a tab system (Overview, Stats, xG, Tactical, Prediction) rather than showing everything simultaneously."},
{t:"b",v:"Replace reference sample data with real match data from /api/live and /api/matches/[id]."},
{t:"h2",v:"Existing Components and Data Sources"},
{t:"d",l:"Match detail",v:"match-detail-view.tsx (667 lines). Already has tabs (Overview/Stats/Predictions/Votes), Recharts bar/line/pie charts, xG visualizations, vote buttons, prediction list. This is the primary component to redesign."},
{t:"d",l:"Match data",v:"/api/matches/[id] (Prisma). Returns match with teams, events, votes, predictions. Also /api/live for real-time ESPN data."},
{t:"d",l:"xG data",v:"/api/understat (scraping) for xG. /api/analytics for xT, spatial data. /api/live for ESPN win probability."},
{t:"d",l:"Predictions",v:"/api/predictions/compute for real ELO/Poisson/Dixon-Coles predictions. Store in Zustand."},
{t:"d",l:"Lineups/rosters",v:"/api/live?action=roster for ESPN team rosters with player positions."},
{t:"h2",v:"Asset Requirements"},
{t:"b",v:"Team crests from ESPN API (already available in live match data)."},
{t:"b",v:"League/competition logo from ESPN or a centralized asset resolver."},
{t:"b",v:"No player headshots are available from ESPN. Use initials or position indicators as professional fallback."},
{t:"h2",v:"What Must NOT Be Copied"},
{t:"b",v:"The exact Real Madrid vs Levante data or any sample entities from the reference."},
{t:"b",v:"Fake tactical lines connecting players unless real pass network data exists."},
{t:"b",v:"A pitch populated with fake dots to look busy. Empty pitch with \u0027Spatial data unavailable\u0027 is better than fabricated data."},
{t:"h2",v:"1366 x 768 Composition"},
{t:"p",v:"The match header spans full width: left team crest + name, central score + match time + status badge, right team crest + name. Below that, a compact stat strip shows possession, shots, passing accuracy. The main content area is split: left 25% is a scrollable event timeline (goals, cards, substitutions with minute markers). Center 50% is the primary analytical view controlled by tabs: Overview shows a stats comparison bar chart; Stats shows detailed metrics; xG shows expected goals timeline; Tactical shows a pitch visualization (only if spatial data exists); Prediction shows model probability and confidence. Right 25% is a compact panel showing match context (venue, weather, referee), key player performers, and model interpretation. This is an Overview-first design: the user sees the score and key stats immediately, then discovers deeper analysis through tabs."},
{t:"h2",v:"States"},
{t:"p",v:"Loading: skeleton matching the header + 3-column layout. Empty (match not found): \u0027Match not found\u0027 with \u0027Back to matches\u0027 button. Error: calm message with retry. No data for a tab (e.g., no xG): \u0027xG data not available for this match\u0027 within the tab panel, not replacing the entire screen."},
{t:"h2",v:"Acceptance Criteria"},
{t:"b",v:"Match header shows real team crests, real scores, real match time from ESPN."},
{t:"b",v:"Tab system allows progressive disclosure: Overview is immediately useful, deeper data is discoverable."},
{t:"b",v:"No fabricated tactical data. Pitch visualization only appears when real spatial data exists."},
{t:"b",v:"Probability transitions update in real-time if the match is live."},
{t:"b",v:"The screen feels like a broadcast-quality analytical room, not a card collection."},
{t:"b",v:"All 5 breakpoints work without horizontal overflow or clipped content."},
]},{
num:6, title:"Player Profile", role:"Player dossier", ref:"Image 03 (Player analytics + heatmap)",
sections:[
{t:"h2",v:"Purpose and Primary Question"},
{t:"p",v:"The player screen should feel like opening a dossier. The primary question is: who is this player and what is their current performance level? The philosophy prescribes a clear vertical hierarchy: player identity (photo, name, position, team, nationality), then current performance, then key metrics, then positional breakdown, then tactical role, then comparison context, then match history. Each section should reveal more depth as the user scrolls."},
{t:"h2",v:"What to Preserve from Reference"},
{t:"b",v:"The sidebar player roster list with circular avatars, names, positions, and status indicators. This provides context and quick switching between players."},
{t:"b",v:"The hero section with a large player summary card showing key identity information and primary metrics."},
{t:"b",v:"The pitch heatmap as a central analytical visualization showing spatial involvement."},
{t:"b",v:"The multi-chart analytical grid below the hero: shot accuracy, shot conversion, trend lines, donut charts for percentages."},
{t:"b",v:"The dark analytical aesthetic with high-contrast data visualization accents."},
{t:"h2",v:"What to Change"},
{t:"b",v:"The reference shows generic \u0027Sports Player Analytics\u0027 branding. ELASTICO uses its own identity."},
{t:"b",v:"The reference shows Cyrillic text. ELASTICO uses English."},
{t:"b",v:"Replace sample metrics with real ELASTICO data. If the ESPN roster API does not provide a metric (match ratings, xA, heatmaps), show an elegant unavailable state rather than a fabricated number. This was already fixed in Round 3 of the data-honesty pass."},
{t:"b",v:"The heatmap should only appear when real spatial data exists (from /api/analytics or /api/understat). Otherwise show \u0027Spatial data unavailable for this player.\u0027},
{t:"h2",v:"Existing Components and Data Sources"},
{t:"d",l:"Player browser",v:"player-view.tsx (912 lines). Has search/filter/sort/pagination, position tabs, player cards with stats. Uses framer-motion for animations. Data from /api/players (Prisma) + TheSportsDB."},
{t:"d",l:"Player data",v:"/api/players (Prisma/DB) for stored players. /api/the-sports-db for player details and images. /api/live?action=roster for ESPN rosters."},
{t:"d",l:"Analytics",v:"/api/analytics for xT, Voronoi, shot analysis, pass analysis. /api/understat for xG and shot maps."},
{t:"h2",v:"Asset Requirements"},
{t:"b",v:"Player headshots: available from TheSportsDB API (requires THE_SPORTS_DB_KEY). If unavailable, use initials in a circular container with team primary color background."},
{t:"b",v:"Team crest: from ESPN API or TheSportsDB."},
{t:"b",v:"Country flag: from a centralized flag resolver (flagcdn.com or similar)."},
{t:"h2",v:"What Must NOT Be Copied"},
{t:"b",v:"The \u0027965\u0027, \u0027255%\u0027 or any specific numbers from the reference image."},
{t:"b",v:"Fake heatmap data. Only show heatmaps from real spatial data sources."},
{t:"b",v:"Cyrillic text or non-English labels."},
{t:"h2",v:"1366 x 768 Composition"},
{t:"p",v:"Left sidebar (240px, collapsible): player roster list with circular avatars, names, positions. Main content area: top 30% is the player identity hero strip (large avatar left, name/position/team/nationality center, key stat pills right). Middle 40% is the primary analytical area: a tabbed interface (Overview / Performance / Match History / Spatial). Overview shows key metrics in a compact grid. Performance shows available ESPN/TheSportsDB stats. Spatial shows pitch heatmap if data exists. Bottom 30% is contextual: comparison teaser (\u0027Compare with...\u0027), recent match appearances, or team context."},
{t:"h2",v:"States"},
{t:"p",v:"Loading: skeleton matching hero strip + tabbed area. Empty (no players): \u0027No players found\u0027 with search/filter guidance. Unavailable metric: \u0027Match rating data not available from current provider\u0027 within the metric cell, not replacing the entire section."},
{t:"h2",v:"Acceptance Criteria"},
{t:"b",v:"Real player data from ESPN/TheSportsDB, not fabricated ratings or stats."},
{t:"b",v:"Player avatar uses real image or professional initial fallback, never a colored circle."},
{t:"b",v:"Unavailable metrics show honest empty states, not fake numbers."},
{t:"b",v:"The dossier hierarchy (identity > performance > detail > context) is clear at first glance."},
]},{
num:7, title:"Match Analysis", role:"Deep analytical workspace", ref:"Image 04 (Tactical pitch + KPI cards + radar chart)",
sections:[
{t:"h2",v:"Purpose and Primary Question"},
{t:"p",v:"This screen provides a deeper analytical workspace for match analysis beyond the Live Match view. While the Live Match is for following a match in real-time, Match Analysis is for studying a completed match or preparing for an upcoming one. The primary question is: what happened in this match and what patterns emerge? This screen should reveal the underlying analytical engine."},
{t:"h2",v:"What to Preserve from Reference"},
{t:"b",v:"The top row of KPI metric cards with icon + large number + secondary label. These create immediate visual anchors."},
{t:"b",v:"The tactical pitch visualization with player nodes and movement/zone indicators. This is the analytical centerpiece."},
{t:"b",v:"The bottom row split between a performance bar chart and a radar chart for multi-dimensional comparison."},
{t:"b",v:"The contextual legends below the pitch suggesting toggleable layers."},
{t:"h2",v:"What to Change"},
{t:"b",v:"The reference uses fictional team names (Aether FC, Zenith United). ELASTICO uses real teams from ESPN/DB."},
{t:"b",v:"The reference shows an idealized dataset. ELASTICO must only show metrics that its engines actually compute: xG, xT, PPDA, pressing, pass accuracy, shot quality, Voronoi spatial dominance."},
{t:"b",v:"The radar chart should only appear with real multi-dimensional data. If ELASTICO's engine does not produce enough comparable dimensions for a radar, use a bar chart comparison instead."},
{t:"h2",v:"Existing Components and Data Sources"},
{t:"d",l:"Match detail",v:"match-detail-view.tsx is the existing match analysis component. Already has tabs for Stats and xG with Recharts visualizations."},
{t:"d",l:"Advanced analytics",v:"/api/analytics (14+ actions: xT, Voronoi, game-state, shot analysis, pass analysis, PPDA, convex hull, team tactical snapshot)."},
{t:"d",l:"Prediction engine",v:"/api/prediction-engine/simulate for stochastic simulation. /api/predictions/compute for ELO/Poisson/Dixon-Coles."},
{t:"d",l:"Understat",v:"/api/understat for xG tables, shot maps, team match histories."},
{t:"h2",v:"What Must NOT Be Copied"},
{t:"b",v:"Fictional team names, player names, or metrics from the reference."},
{t:"b",v:"Hatched \u0027Pressing Zone\u0027 overlays unless real pressing data exists from the analytics engine."},
{t:"b",v:"Movement arrows on the pitch unless real tracking data is available."},
{t:"h2",v:"1366 x 768 Composition"},
{t:"p",v:"Top strip: match identifier (team crests, names, score, date, competition). Row 2 (compact): 4 KPI cards in a row showing the most important computed metrics (xG differential, possession, shot quality index, press intensity). Row 3 (primary, tallest): split between a tactical pitch (60% width) and a statistics panel (40% width). The pitch shows formations and player positions from ESPN rosters; tactical overlays (heatmaps, pass networks, pressing zones) only if real data exists. The stats panel shows a detailed metric comparison table. Row 4 (supporting): a wide chart showing the analytical metric of most interest (xG timeline, shot map, or probability progression)."},
{t:"h2",v:"Acceptance Criteria"},
{t:"b",v:"All displayed metrics come from real ELASTICO computation engines, not fabricated numbers."},
{t:"b",v:"Pitch visualization uses real ESPN roster data for player positions."},
{t:"b",v:"Tactical overlays (heatmaps, pressing zones) only appear when the analytics API returns real spatial data."},
{t:"b",v:"The screen proves ELASTICO has a real analytical engine, not just a pretty interface."},
]},{
num:8, title:"Compare Players", role:"Analytical comparison workspace", ref:"Image 05 (Bruno Fernandes detail + match context)",
sections:[
{t:"h2",v:"Purpose and Primary Question"},
{t:"p",v:"The compare screen exists to make differences between two entities obvious. The primary question is: how do these two players (or teams) compare across meaningful metrics? The philosophy is explicit: align comparable metrics side-by-side. Do not force users to jump between separate cards. This should be a specialized workspace, not a copy of the dashboard with two columns."},
{t:"h2",v:"What to Preserve from Reference"},
{t:"b",v:"The photographic integration approach: using player imagery as a structural layer with gradient overlays for readability."},
{t:"b",v:"The asymmetric composition with player identity on one side and analytical data on the other."},
{t:"b",v:"The comparative progress bars showing dual-color fills for each metric."},
{t:"b",v:"The match context card showing relevant recent performance data."},
{t:"h2",v:"What to Change"},
{t:"b",v:"The reference shows a single player (Bruno Fernandes). ELASTICO must extend this to a side-by-side comparison layout with a VS divider."},
{t:"b",v:"The reference uses international match context (Portugal vs France, Semi-Final). ELASTICO must use real match/league context from its data."},
{t:"b",v:"Replace all reference numbers with real ELASTICO metrics."},
{t:"h2",v:"Existing Components and Data Sources"},
{t:"d",l:"Compare view",v:"compare-view.tsx (483 lines). Has side-by-side team comparison with progress bars, team selectors, framer-motion animations. Currently compares teams, not players."},
{t:"d",l:"Player data",v:"/api/players for player stats. /api/the-sports-db for player details and images."},
{t:"d",l:"Team comparison",v:"compare-view.tsx already fetches team data including ELO, xG, possession, press intensity from the store."},
{t:"h2",v:"What Must NOT Be Copied"},
{t:"b",v:"Bruno Fernandes data, Portugal vs France context, or any specific numbers from the reference."},
{t:"b",v:"The \u0027LIVE\u0027 pulse badge unless the compared entities are actually in a live match."},
{t:"h2",v:"1366 x 768 Composition"},
{t:"p",v:"Top: two entity selector dropdowns with a VS badge between them. Below: a two-column layout (45% each with 10% gap). Left column: player/team A identity (crest/avatar, name, key stats) + detailed metric list. Right column: player/team B identity + detailed metric list. Each metric row has the same label on both sides with the values aligned for direct comparison. Progress bars show relative strength. Below the comparison: a chart area showing head-to-head visualization (bar chart for comparable metrics, or radar chart if enough dimensions exist). Bottom: contextual match history or recent form for both entities."},
{t:"h2",v:"Acceptance Criteria"},
{t:"b",v:"Metrics are aligned side-by-side for instant visual comparison."},
{t:"b",v:"All values come from real data sources, not fabricated numbers."},
{t:"b",v:"Entity selectors support both player and team comparison modes."},
{t:"b",v:"The workspace feels specialized for comparison, not like a re-skinned dashboard."},
]},{
num:9, title:"Predictions", role:"Decision environment", ref:"Image 01 (9-screen atlas, mid-right)",
sections:[
{t:"h2",v:"Purpose and Primary Question"},
{t:"p",v:"The predictions screen immediately communicates: match, model, probabilities, confidence, generation time, data freshness, match state, and outcome if completed. The philosophy is explicit that this should not look like a casino. ELASTICO is analytical. The primary question is: what does the model predict for this match, and how confident is it?"},
{t:"h2",v:"What to Preserve from Reference"},
{t:"b",v:"The probability visualization showing home/draw/away as a clear bar or pie chart."},
{t:"b",v:"The model confidence indicator showing how certain the prediction is."},
{t:"b",v:"The clean analytical presentation without gambling aesthetics."},
{t:"h2",v:"What to Change"},
{t:"b",v:"The reference (from the 9-screen atlas) shows a generic prediction layout. ELASTICO must wire in real ELO/Poisson/Dixon-Coles predictions from /api/predictions/compute."},
{t:"b",v:"The existing prediction-engine-view.tsx (1014 lines) has extensive mathematical controls (Monte Carlo, Kelly Criterion, market signals). This is the real prediction engine and must be preserved, but its UI must be elevated to match the visual target."},
{t:"h2",v:"Existing Components and Data Sources"},
{t:"d",l:"Predictions view",v:"predictions-view.tsx (321 lines). User prediction management, confidence slider, past predictions table, CSV export, Recharts bar chart."},
{t:"d",l:"Prediction engine",v:"prediction-engine-view.tsx (1014 lines). Full stochastic simulation UI with tabs for Simulate, Results, Kelly Criterion, Market Signals, Config."},
{t:"d",l:"Prediction compute",v:"/api/predictions/compute (ESPN + local math). ELO, Poisson, Dixon-Coles."},
{t:"d",l:"User predictions",v:"/api/predictions (Prisma). User's prediction history and accuracy."},
{t:"h2",v:"What Must NOT Be Copied"},
{t:"b",v:"Casino/betting aesthetics (green felt, slot-machine styling, flashy CTAs)."},
{t:"b",v:"Fake probability numbers. All probabilities must come from the real computation engine."},
{t:"h2",v:"1366 x 768 Composition"},
{t:"p",v:"Top: match selector dropdown + model selector. Main area: left 60% shows the selected match (team crests, names, date) with a large probability bar chart below it (home/draw/away percentages with colored fills). Right 40% shows model interpretation (confidence level, generation timestamp, data freshness, key factors). Below: a table of the user's past predictions with accuracy metrics, sortable by date/match/accuracy. The prediction engine controls (simulate, Kelly, market signals) are accessible via tabs or a secondary navigation row, not crowding the primary prediction view."},
{t:"h2",v:"Acceptance Criteria"},
{t:"b",v:"Probabilities come from the real ELO/Poisson/Dixon-Coles engine."},
{t:"b",v:"Confidence and data freshness are displayed alongside every prediction."},
{t:"b",v:"The screen feels like an analytical decision environment, not a betting interface."},
]},{
num:10, title:"AI Analyst", role:"Reasoning interface", ref:"Image 01 (9-screen atlas, bottom-center)",
sections:[
{t:"h2",v:"Purpose and Primary Question"},
{t:"p",v:"The AI chat interface should feel like talking to a knowledgeable analyst, not a generic chatbot. The philosophy is explicit: do not put \u0027AI INSIGHT\u0027 on every page. Use contextual analytical language. The primary question is: what analytical insight can I get about this match/player/tactical situation? The interface should support match context injection so the AI has real data to reason about."},
{t:"h2",v:"What to Preserve from Reference"},
{t:"b",v:"The chat bubble interface with typing indicators and message history."},
{t:"b",v:"The model selector allowing the user to choose which AI model to use."},
{t:"b",v:"The markdown rendering for structured analytical responses (tables, lists, code blocks)."},
{t:"h2",v:"What to Change"},
{t:"b",v:"The existing chat-view.tsx (606 lines) already implements most of this functionality. The redesign focuses on visual elevation to match the premium target, not functional rebuilding."},
{t:"b",v:"Add suggested analytical questions/prompts based on the current context (e.g., when viewing a match, suggest \u0027Analyze the key tactical battles\u0027 or \u0027Explain the xG differential\u0027)."},
{t:"b",v:"Match context injection is already implemented. Ensure it works correctly with real ESPN data."},
{t:"h2",v:"Existing Components and Data Sources"},
{t:"d",l:"Chat view",v:"chat-view.tsx (606 lines). AI chat with streaming, match context injection, model selector, chat history, copy messages, markdown rendering."},
{t:"d",l:"Chat API",v:"/api/chat (Prisma/DB + AI Gateway). Uses OpenAI/Gemini via the AI gateway with match context gathering."},
{t:"h2",v:"What Must NOT Be Copied"},
{t:"b",v:"Generic chatbot UI patterns (cute avatars, \u0027How can I help you?\u0027 greetings, marketing language)."},
{t:"b",v:"Fake AI responses. All responses must come from the real AI gateway."},
{t:"h2",v:"1366 x 768 Composition"},
{t:"p",v:"Full-height chat layout: left panel (30%) shows conversation history list with match context labels. Right panel (70%) is the active chat: message bubbles (user right-aligned in accent color, assistant left-aligned in surface color), a rich text input area at the bottom, and a top bar showing current context (match or player being discussed). Suggested prompts appear as tappable pills above the input when no conversation is active. The visual treatment must feel like a premium analytical tool, not a consumer chat app."},
{t:"h2",v:"Acceptance Criteria"},
{t:"b",v:"Chat responses stream in real-time via the AI gateway."},
{t:"b",v:"Match context injection provides real data to the AI model."},
{t:"b",v:"The interface feels like an analytical reasoning tool, not a chatbot."},
]},{
num:11, title:"Analytics", role:"Advanced metrics workspace", ref:"Image 01 (9-screen atlas, bottom-left)",
sections:[
{t:"h2",v:"Purpose and Primary Question"},
{t:"p",v:"This screen provides access to ELASTICO's advanced analytical engines: xT (Expected Threat), Voronoi spatial dominance, game-state analysis, PPDA, convex hull, and 15+ advanced metrics from the advanced-analytics-engine (CRI, SCS, ITI, narrative momentum, etc.). The primary question is: what advanced analytical insight can I extract from the available data? This is a specialized workspace, not a re-skin of the dashboard."},
{t:"h2",v:"What to Preserve from Reference"},
{t:"b",v:"The concept of a data-dense analytical workspace with multiple visualization types (charts, tables, spatial diagrams)."},
{t:"b",v:"The filter-driven approach: the user selects a metric, a team, or a match, and the workspace populates with the relevant analysis."},
{t:"h2",v:"What to Change"},
{t:"b",v:"The reference (from the 9-screen atlas) is a small preview. The actual implementation should be a full workspace with metric selector, entity selector, and visualization area."},
{t:"b",v:"This screen currently does not exist as a standalone view. The analytics API routes exist (/api/analytics with 14+ actions, /api/advanced-analytics with 15+ metrics) but there is no dedicated analytics view. This is a new build, leveraging existing API routes."},
{t:"h2",v:"Existing Components and Data Sources"},
{t:"d",l:"Analytics API",v:"/api/analytics: xT calculation/grid/match/leaderboard, Voronoi spatial dominance, game-state analysis, shot analysis, pass analysis, PPDA, convex hull, team tactical snapshot."},
{t:"d",l:"Advanced analytics",v:"/api/advanced-analytics: 15+ advanced metrics (CRI, SCS, ITI, referee drift, narrative momentum, etc.)."},
{t:"d",l:"Data sources",v:"StatsBomb (free/open data) for event data and 360 data. Understat for xG. ESPN for match/team context."},
{t:"h2",v:"What Must NOT Be Copied"},
{t:"b",v:"Fake advanced metrics. Every metric must come from the real computation engines."},
{t:"b",v"Charts that look impressive but show meaningless data."},
{t:"h2",v:"1366 x 768 Composition"},
{t:"p",v:"Top bar: metric category selector (tabs: xT / Spatial / Shot / Pass / Advanced / Team Snapshot) + entity selector (team/match dropdown). Main area: the selected visualization. For xT: a pitch grid heat map. For Voronoi: a spatial dominance diagram. For shot analysis: a shot map. For advanced metrics: a comparison table or radar chart. Right sidebar (collapsible): parameter controls, data source selector, and model explanation. The visualization must be the dominant element, with controls secondary."},
{t:"h2",v:"Acceptance Criteria"},
{t:"b",v:"At least 3 analytical visualizations are functional (e.g., xT grid, shot map, metric comparison)."},
{t:"b",v:"All displayed metrics come from real API computations."},
{t:"b",v:"Empty states are designed: \u0027Select a match and metric to begin analysis.\u0027},
]},{
num:12, title:"Settings", role:"Quiet utility", ref:"Image 01 (9-screen atlas, bottom-right)",
sections:[
{t:"h2",v:"Purpose and Primary Question"},
{t:"p",v:"Settings should be calm, organized, compact, predictable, and functional. The philosophy explicitly states: do not make Settings look like the dashboard. This is a utility screen where users manage their account, preferences, and configuration. The primary question is: how do I configure my ELASTICO experience?"},
{t:"h2",v:"What to Preserve from Reference"},
{t:"b",v:"The reference shows a clean tabbed settings layout. This is appropriate for ELASTICO's settings which already have extensive options."},
{t:"h2",v:"What to Change"},
{t:"b",v:"The existing settings-view.tsx (1260 lines) is extremely comprehensive with profile editing, display name, bio, favorite teams, notification preferences, theme toggle, password change, account deletion, and 2FA setup. The redesign focuses on visual consistency with the new design system, not functional rebuilding."},
{t:"b",v:"Apply the unified typography, spacing, surface, and border tokens from the design system foundation."},
{t:"b",v:"Ensure all form controls (inputs, selects, toggles, buttons) use the standardized component styles."},
{t:"h2",v:"Existing Components and Data Sources"},
{t:"d",l:"Settings view",v:"settings-view.tsx (1260 lines). Complete settings UI with all functionality implemented."},
{t:"d",l:"User data",v:"/api/auth/me for current user. Standard CRUD operations for profile updates."},
{t:"h2",v:"What Must NOT Be Copied"},
{t:"b",v:"Dashboard visual density or analytical charts. Settings is quiet utility."},
{t:"h2",v:"1366 x 768 Composition"},
{t:"p",v:"Centered content column (max-width 720px) with horizontal tabs for sections (Profile, Preferences, Security, Data, Danger Zone). Each section shows its form fields with consistent spacing, clear labels above inputs, and a single save button at the bottom. No cards, no charts, no analytics. Just clean, functional form layout with the design system's typography and spacing."},
{t:"h2",v:"Acceptance Criteria"},
{t:"b",v:"All existing functionality (profile, notifications, theme, password, 2FA, account deletion) is preserved."},
{t:"b",v:"The visual style is consistent with the design system but distinctly calmer than analytical screens."},
{t:"b",v:"Form controls are standardized using the design system tokens."},
]}
];

// ── BUILD DOCUMENT ──
const content = [];

// Section 1: Introduction
content.push(h1("1. Introduction"));
content.push(p("This document is the Visual Reference Execution Brief for ELASTICO. It bridges the UX/UI Philosophy document and the 9 visual reference images into concrete, implementable instructions for each screen of the application. The philosophy document defines what ELASTICO should feel like: precise, calm, fast, intelligent, spatial, football-native, premium, and purposeful. The visual references show the target quality level. This brief tells the implementer exactly how to translate each visual reference into the corresponding ELASTICO screen using the existing codebase."));
content.push(p("The images are visual references, not a single page. Each image represents a different ELASTICO experience. They must never be combined into one layout."));

content.push(h2("1.1 Critical Rules"));
content.push(b("Do not combine the 9 reference images into a single page. Each image represents a different ELASTICO experience."));
content.push(b("Do not copy sample data (player names, scores, team names) from the reference images. All data must come from real ELASTICO data sources."));
content.push(b("Do not invent metrics that do not exist in the codebase. If a reference shows a metric ELASTICO does not compute, omit it or show an elegant unavailable state."));
content.push(b("Do not replace the single-shell architecture (page.tsx > Zustand currentView > view switch). The philosophy explicitly preserves this pattern."));
content.push(b("Do not use the same visual composition for every screen. Each view has a different job and a different hierarchy, even though they share one design system."));
content.push(b("Build the design system first. Every screen must use the same typography, spacing, surfaces, borders, radius, buttons, tabs, tables, and chart styling. Different compositions, same DNA."));
content.push(b("Do not rebuild the backend. This brief covers UX architecture, information hierarchy, visual design, interaction design, and responsive behavior only."));
content.push(b("Laptop-first: the critical desktop target is 1366 x 768. Every composition must work at this resolution before being expanded or adapted."));

content.push(h2("1.2 How to Use This Brief"));
content.push(p("For each of the 9 screens, this document provides: (a) the visual reference it maps to, (b) what to preserve from that reference, (c) what to change, (d) what information belongs on the screen, (e) which existing ELASTICO component supplies it, (f) which API or store action supplies the data, (g) which assets should be sourced, (h) what must not be copied, (i) the 1366 x 768 composition layout, (j) responsive behavior rules, and (k) acceptance criteria. Read the Design System Foundation section (Section 3) first, then proceed screen by screen in the specified implementation order (Section 13)."));

// Section 2: Reference Atlas
content.push(h1("2. Reference Atlas: Image-to-Screen Mapping"));
content.push(p("The following table maps each visual reference to its corresponding ELASTICO experience. Images 02 through 05 provide high-fidelity detail for their respective screens. Image 01, the 9-screen atlas, provides composition guidance for screens 01, 06, 07, 08, and 09 at a smaller scale. The visual quality bar set by the detailed images applies equally to all 9 screens."));

const atlasRows = [
  ["01","Dashboard","Command center","Image 01 (top-left) + Image 02 (detail)"],
  ["02","Live Match","Hero experience","Image 02 (tactical view)"],
  ["03","Player Profile","Player dossier","Image 03 (analytics + heatmap)"],
  ["04","Match Analysis","Analytical workspace","Image 04 (pitch + KPI + radar)"],
  ["05","Compare Players","Analytical comparison","Image 05 (player detail + context)"],
  ["06","Predictions","Decision environment","Image 01 (mid-right)"],
  ["07","AI Analyst","Reasoning interface","Image 01 (bottom-center)"],
  ["08","Analytics","Advanced metrics","Image 01 (bottom-left)"],
  ["09","Settings","Quiet utility","Image 01 (bottom-right)"]
];
content.push(new Table({
  width:{size:100,type:WidthType.PERCENTAGE},layout:{type:"FIXED"},
  rows:[new TableRow({tableHeader:true,cantSplit:true,children:["Ref","Screen","Role","Source Image"].map(h=>mkCell(h,{header:true,center:true}))}),
  ...atlasRows.map((r,i)=>new TableRow({cantSplit:true,children:r.map((c,j)=>mkCell(c,{alt:i%2===0,center:j===0}))}))]
}));
content.push(sp());

// Section 3: Design System Foundation
content.push(h1("3. Design System Foundation"));
content.push(p("Before any screen is redesigned, a unified design system must be established. This system defines the visual grammar that all 9 screens share. Every surface, border, label, and interaction must be drawn from this system. The goal is one design system with different compositions, not nine different visual languages."));

content.push(h2("3.1 Color System"));
content.push(p("The application uses a dark-first premium palette. The existing globals.css defines CSS custom properties for a dark theme centered on deep charcoal (#0a0e17 to #0B0E14) with surface elevations at #111827 to #1a1f2e. The primary brand accent is emerald (#10B981), used sparingly for active states, positive indicators, and selection. Secondary data colors: blue (#3B82F6) for primary data, red (#EF4444) for negative, amber (#F59E0B) for caution, cyan (#06B6D4) for secondary. Text hierarchy: primary white (#F9FAFB), secondary muted gray (#9CA3AF), tertiary dark gray (#4B5563). The critical rule: if everything is highlighted, nothing is highlighted. Accent colors are reserved for semantic meaning (live status, positive/negative, model confidence, team identity). Never decorative."));

content.push(h2("3.2 Typography"));
content.push(p("Font stack: Geist Sans for UI, Geist Mono for code/data, JetBrains Mono for monospace (already configured in globals.css). Headings: restrained bold (600-700), white. Body: regular, 13-14px, line-height 1.4-1.5. Data labels: 11-12px, uppercase, 0.05em letter-spacing, muted color. Large KPI numbers: 28-48px bold, colored by sentiment (emerald for positive, red for negative). Numbers must use tabular figures (font-variant-numeric: tabular-nums) for column alignment. The most important typographic rule: restraint creates hierarchy. Never make every heading enormous or every label bold."));

content.push(h2("3.3 Spacing and Grid"));
content.push(p("Base unit: 4px. Card padding: 16-20px. Gutters: 16-20px. Section margins: 24-32px. Large gaps (48-64px) separate conceptual sections. Medium gaps (24-32px) group related information. Small gaps (8-12px) connect tightly related elements. Negative space communicates hierarchy. The 1366x768 viewport must be respected: no horizontal scroll, minimal vertical scroll. Use CSS Grid with named areas for complex layouts. The existing Tailwind utility classes (p-4, gap-4, space-y-6) already map to this grid."));

content.push(h2("3.4 Surfaces and Borders"));
content.push(p("Cards and containers: subtle 1px borders (rgba(255,255,255,0.06)), consistent 8-12px corner radius. Larger analytical surfaces (pitch, wide tables): minimal or no border, relying on background contrast. No glowing borders, no neon outlines, no gradient fills without purpose. Elevation is communicated through background shade difference, not shadows. The existing .glass-card utility in globals.css can be used for frosted-glass effects where appropriate, but sparingly. Avoid the anti-pattern of every element being a card. Sometimes a divider, whitespace, or continuous surface is better."));

content.push(h2("3.5 Buttons and Controls"));
content.push(p("Every screen: one primary action (emerald accent fill, white text), then secondary actions (ghost/outline, muted borders). Labels describe outcomes: \u0027Analyse Match\u0027, \u0027Compare Players\u0027, \u0027View Full Analysis\u0027. Not vague labels: \u0027Go\u0027, \u0027Submit\u0027, \u0027More\u0027. Icons improve recognition, not decorate empty space. Use the existing shadcn/ui Button component with custom CVA variants for ELASTICO-specific styles (primary-accent, secondary-ghost, analytical-action). Tabs: minimal underline style with emerald active indicator, not pill-style tabs."));

content.push(h2("3.6 Tables"));
content.push(p("Minimalist: subtle row hover, faint or no zebra striping, compact row height (40-48px), right/center-aligned numbers, left-aligned text. Headers: uppercase 11px, muted color, subtle sort indicators. The existing shadcn/ui Table component provides the foundation. Tables in dashboard-view.tsx (EspnStandingsCard) and tournament-view.tsx already exist and should be refined, not rebuilt."));

content.push(h2("3.7 Charts"));
content.push(p("Recharts is the existing library. Consistent styling: transparent or card-matching backgrounds, white/light axis labels, emerald/blue/red data colors, no 3D effects, meaningful hover tooltips, clear axis labels. Every chart must answer a specific question. A chart without a question is decoration and must be removed. Adopt the shadcn/ui Chart wrapper component as the standard interface for consistent theming. Chart types by use: bar charts for comparisons, line charts for time series, pie/donut for distributions, radar for multi-dimensional profiles (only when real dimensions exist)."));

content.push(h2("3.8 Navigation"));
content.push(p("Preserve the existing sidebar (sidebar.tsx) with three sections (Main, Analysis, System). Refine the active state: emerald icon + left border indicator + subtle background. Reorder navigation to match the user's mental model: Dashboard, Live Matches, Standings, Predictions, AI Chat as the primary flow. Analysis tools (Prediction Engine, Players, Compare, Analytics) as the secondary flow. System (Settings, Notifications, Subscription, Admin) as the tertiary flow. Simplify the header: view title left, notification bell + user avatar right. De-emphasize zoom controls and other chrome."));

content.push(h2("3.9 Asset Resolution"));
content.push(p("Centralize asset resolution into utility functions: resolveTeamLogo(team) checks ESPN logo URL first, then TheSportsDB, then professional fallback (team initials on primary color background). resolvePlayerImage(player) checks TheSportsDB headshot, then professional fallback (initials in circle). resolveCountryFlag(country) uses a real flag asset service (flagcdn.com), never emoji flags. resolveCompetitionLogo(competition) uses ESPN or a centralized asset store. These functions normalize dimensions, preserve aspect ratio, lazy-load, and provide consistent fallbacks. The UI should never call <img src={url}> directly; it should go through the resolution layer."));

content.push(h2("3.10 States"));
content.push(p("Loading: structural skeletons matching the eventual layout, not full-page spinners. The existing shadcn/ui Skeleton component provides the foundation. Empty states: communicate what is missing, why (when useful), and what the user can do next. Example: \u0027No live matches right now. [View upcoming matches]\u0027. Error states: calm, actionable, showing last verified data point and retry button. Example: \u0027Live data temporarily unavailable. Last update: 2 minutes ago. [Retry]\u0027. Live/upcoming/recent/historical must be visually distinct. Every state must be designed, not left as default."));

// Screen briefs
for (const s of screens) {
  content.push(h1(`${s.num}. Screen ${String(s.num-3).padStart(2,'0')}: ${s.title}`));
  content.push(pb("Design Role: ", s.role));
  content.push(pb("Visual Reference: ", s.ref));
  content.push(sp());
  for (const sec of s.sections) {
    if(sec.t==="h2") content.push(h2(sec.v));
    else if(sec.t==="h3") content.push(h3(sec.v));
    else if(sec.t==="p") content.push(p(sec.v));
    else if(sec.t==="b") content.push(b(sec.v));
    else if(sec.t==="d") content.push(d(sec.l,sec.v));
    else if(sec.t==="m") content.push(m(sec.v));
  }
}

// Section 13: Implementation Sequence
content.push(h1("13. Implementation Sequence"));
content.push(p("The philosophy prescribes a specific build order. This sequence is non-negotiable because later screens depend on the design system established by earlier ones. Each step must be verified before proceeding to the next."));

content.push(h2("Phase 1: Design System (Pre-requisite)"));
content.push(b("Establish the design tokens in globals.css: finalize the color palette, typography scale, spacing scale, border/radius values, and state colors as CSS custom properties."));
content.push(b("Create the asset resolution layer: resolveTeamLogo, resolvePlayerImage, resolveCountryFlag utility functions in a new file src/lib/asset-resolver.ts."));
content.push(b("Standardize button, tab, table, and chart components with CVA variants matching the design tokens."));
content.push(b("Create standardized loading skeleton, empty state, and error state components."));

content.push(h2("Phase 2: Global Shell"));
content.push(b("Refine sidebar.tsx: reorder navigation items, update active state styling, apply design tokens."));
content.push(b("Refine header.tsx: simplify to view title + notification bell + user dropdown, apply design tokens."));
content.push(b("Establish the laptop-first CSS Grid layout system for the main content area."));
content.push(b("Verify the complete shell at 1366x768 before touching any view content."));

content.push(h2("Phase 3: Dashboard"));
content.push(b("Redesign dashboard-view.tsx to the visual target. This is the most critical screen because it establishes ELASTICO's visual grammar for the user."));
content.push(b("Wire real ESPN data throughout. Verify team crests render. Verify the live ticker updates."));
content.push(b("Stop after Dashboard. Verify it at 1366x768. Use the resulting design language to propagate to remaining views."));

content.push(h2("Phase 4: Live Match"));
content.push(b("Redesign match-detail-view.tsx as the hero experience. This is where all intelligence converges."));
content.push(b("Implement the tab system (Overview, Stats, xG, Tactical, Prediction). Wire real data to each tab."));
content.push(b("This screen proves whether the implementer has understood the philosophy. If this screen feels incredible, the approach is working."));

content.push(h2("Phase 5: Player + Match Analysis"));
content.push(b("Redesign player-view.tsx as a player dossier with honest data states."));
content.push(b("Enhance match-detail-view.tsx with the Match Analysis depth (KPI cards, tactical pitch, statistical comparison)."));
content.push(b("Build the new Analytics view (screen 08) leveraging the existing /api/analytics and /api/advanced-analytics routes."));

content.push(h2("Phase 6: Specialized Workspaces"));
content.push(b("Redesign compare-view.tsx for analytical comparison."));
content.push(b("Elevate predictions-view.tsx and prediction-engine-view.tsx visual design."));
content.push(b("Elevate chat-view.tsx visual design."));

content.push(h2("Phase 7: Utility Screens"));
content.push(b("Apply design system to settings-view.tsx (visual consistency, calmer density)."));
content.push(b("Apply design system to remaining views: notifications, subscription, export, leaderboard, news, tournament."));

content.push(h2("Phase 8: Responsive Refinement"));
content.push(b("Test and fix every screen at 1366x768 first, then 1280x720, 1440x900, tablet, and mobile."));
content.push(b("Ensure no horizontal overflow, no clipped cards, no hidden buttons, no microscopic controls at any breakpoint."));
content.push(b("The page itself must not overflow horizontally. Fix actual layout issues, do not use blanket overflow-x: hidden."));

content.push(h2("Phase 9: Motion and Polish"));
content.push(b("Add meaningful transitions: probability shifts, live event arrivals, tab movements, chart reveals."));
content.push(b("Remove any decorative motion (floating cards, perpetual glows, bouncing icons)."));
content.push(b("Conduct the quality bar review from the philosophy (Section 44) for each screen."));

// Section 14: Cross-Cutting Acceptance Criteria
content.push(h1("14. Cross-Cutting Acceptance Criteria"));
content.push(p("These criteria apply to every screen. A screen is not considered complete until all of these are satisfied."));

content.push(h2("14.1 UX Quality"));
content.push(b("Can the user understand the screen in 2-3 seconds? Do they know where they are?"));
content.push(b("Do they know what matters? Do they know what they can do?"));
content.push(b("Is the primary action obvious? Is the button hierarchy clear?"));

content.push(h2("14.2 Visual Quality"));
content.push(b("Does the composition feel intentional? Is there enough negative space?"));
content.push(b("Are there too many cards? Are too many elements competing for attention?"));
content.push(b("Does it feel premium without being flashy? Does it feel like ELASTICO, not a template?"));

content.push(h2("14.3 Data Integrity"));
content.push(b("Is every number real? Is every image legitimate?"));
content.push(b("Is current information actually current? Are historical and live states visually distinct?"));
content.push(b("Are missing metrics handled with honest empty states rather than fabricated numbers?"));

content.push(h2("14.4 Technical Quality"));
content.push(b("Does it fit 1366x768 without horizontal scroll? Does it work at 1280x720?"));
content.push(b("Are charts constrained to their containers? Are controls reachable on mobile?"));
content.push(b("Are images optimized (lazy-loaded, proper sizing)? Does the page load fast?"));

content.push(h2("14.5 Product Quality"));
content.push(b("Would a football analyst want to return to this screen?"));
content.push(b("Does the interface make analysis easier, not harder?"));
content.push(b("Should ELASTICO be recognizable without its logo? The answer must be yes, through composition, hierarchy, spacing, typography, football intelligence, visual restraint, interaction quality, and confidence."));

// ── Assemble document ──
const doc = new Document({
  styles: { default: { document: {
    run: { font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}, size:22, color:c(P.body) },
    paragraph: { spacing:{line:312} }
  }}},
  sections: [
    { properties: { page: { size:{width:11906,height:16838}, margin:{top:0,bottom:0,left:0,right:0} } },
      children: buildCover({ title:"ELASTICO Visual Reference Execution Brief", subtitle:"Translating visual references into implementable screen specifications", englishLabel:"VISUAL REFERENCE  |  EXECUTION BRIEF  |  ELASTICO", metaLines:["Version 1.0", "9 Screens  |  1 Design System  |  Laptop-First"], footerLeft:"ELASTICO", footerRight:"Confidential" , palette: P })
    },
    { properties: { type: SectionType.NEXT_PAGE, page: { size:{width:11906,height:16838}, margin:{top:1440,bottom:1440,left:1701,right:1417}, pageNumbers:{start:1,formatType:"DECIMAL"} } },
      headers: { default: new Header({ children: [new Paragraph({ alignment:AlignmentType.RIGHT, children: [new TextRun({ text:"ELASTICO  |  Visual Reference Execution Brief", size:16, color:c(P.secondary), font:{ascii:"Calibri"} })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment:AlignmentType.CENTER, children: [new TextRun({ text:"PAGE  \* arabic  \* MERGEFORMAT", size:16, color:c(P.secondary), font:{ascii:"Calibri"} })] })] }) },
      children: [
        new Paragraph({ spacing:{after:200}, children:[new TextRun({text:"Table of Contents",bold:true,size:32,color:c(P.body),font:{ascii:"Calibri",eastAsia:"SimHei"}})] }),
        new TableOfContents("Table of Contents", { hyperlink:true, headingStyleRange:"1-3" }),
        new Paragraph({ spacing:{before:200,after:200}, children:[new TextRun({text:"(Right-click the Table of Contents and select \u0027Update Field\u0027 to refresh page numbers.)",size:18,color:c(P.secondary),font:{ascii:"Calibri",italics:true}})] }),
        new Paragraph({ children:[new PageBreak()] }),
        ...content
      ]
    }
  ]
});

Packer.toBuffer(doc).then(buf => { fs.writeFileSync("/home/z/my-project/download/ELASTICO_Visual_Reference_Execution_Brief.docx", buf); console.log("Document generated successfully."); });
