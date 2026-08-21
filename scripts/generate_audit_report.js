const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, PageBreak, SectionType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  TableOfContents, Tab, TabStopType, TabStopPosition } = require("docx");

// ── Palette: DM-1 (Deep Cyan) for tech/AI audit report ──
const palette = {
  bg: "162235", primary: "FFFFFF", accent: "37DCF2",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
  body: "1A2B40", secondary: "5A6080", surface: "F4F8FC",
};
const c = (hex) => hex.replace("#", "");
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ── Utility: table helpers ──
function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: c(palette.table.headerBg) },
    borders: { top: noBorders.top, bottom: { style: BorderStyle.SINGLE, size: 2, color: c(palette.table.accentLine) }, left: noBorders.left, right: noBorders.right },
    children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text, bold: true, size: 20, color: c(palette.table.headerText), font: { ascii: "Calibri" } })] })],
  });
}
function dataCell(text, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: opts.shaded ? { type: ShadingType.CLEAR, fill: c(palette.table.surface) } : undefined,
    borders: { top: noBorders.top, bottom: { style: BorderStyle.SINGLE, size: 1, color: c(palette.table.innerLine) }, left: noBorders.left, right: noBorders.right },
    children: [new Paragraph({ spacing: { before: 30, after: 30 }, children: [new TextRun({ text, size: 20, color: opts.red ? "CC0000" : opts.green ? "1A7A3A" : c(palette.body), font: { ascii: "Calibri" }, bold: !!opts.bold })] })],
  });
}

// ── Utility: body paragraph ──
function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    indent: opts.noIndent ? undefined : { firstLine: 480 },
    children: [new TextRun({ text, size: 24, color: c(palette.body), font: { ascii: "Calibri" } })],
  });
}
function bodyBold(text) {
  return new Paragraph({
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, color: c(palette.body), font: { ascii: "Calibri" }, bold: true })],
  });
}

// ── Cover: R1 Pure Paragraph ──
function calcTitleLayout(title, maxW, pref = 40, min = 24) {
  const cw = (pt) => pt * 20;
  const cpl = (pt) => Math.floor(maxW / cw(pt));
  let pt = pref, lines;
  while (pt >= min) { const c = cpl(pt); if (c < 2) { pt -= 2; continue; } lines = [title]; if (title.length <= c) break; const mid = Math.ceil(title.length / 2); lines = [title.slice(0, mid), title.slice(mid)]; if (lines[lines.length-1].length <= 2) { lines[0] += lines.pop(); } if (lines.length <= 3) break; pt -= 2; }
  if (!lines || lines.length > 3) { lines = [title.slice(0, Math.ceil(title.length/2)), title.slice(Math.ceil(title.length/2))]; pt = min; }
  return { titlePt: pt, titleLines: lines };
}
function calcCoverSpacing(p) {
  const S = 1200, H = 16838 - (p.marginTop||0) - (p.marginBottom||0) - S;
  const tH = (p.titleLineCount||1) * ((p.titlePt||36)*23 + 200);
  const sH = p.hasSubtitle ? (12*23+600) : 0;
  const eH = p.hasEnglishLabel ? (9*23+600) : 0;
  const mH = (p.metaLineCount||0) * (10*23+100);
  const cH = tH + sH + eH + mH + (p.fixedHeight||800) + 900;
  const rem = Math.max(H - cH, 400);
  const FM = 800;
  const rawB = Math.floor(rem * 0.45);
  const bS = Math.max(rawB, FM);
  const tS = Math.max(Math.floor(rem * 0.45) - Math.max(0, FM - rawB), 400);
  return { topSpacing: tS, bottomSpacing: bS };
}
function buildCoverR1(config) {
  const P = config.palette; const padL = 1200, padR = 800;
  const aw = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, aw);
  const titleSize = titlePt * 2;
  const sp = calcCoverSpacing({ titleLineCount: titleLines.length, titlePt, hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel, metaLineCount: (config.metaLines||[]).length, fixedHeight: 400 });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: c(P.accent), space: 12 };
  const ch = [];
  ch.push(new Paragraph({ spacing: { before: sp.topSpacing } }));
  if (config.englishLabel) {
    ch.push(new Paragraph({ indent: { left: padL, right: padR }, spacing: { after: 500 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: c(P.accent), space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: c(P.accent), font: { ascii: "Calibri" }, characterSpacing: 40 })] }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    ch.push(new Paragraph({ indent: { left: padL }, spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: c(P.cover.titleColor), font: { ascii: "Calibri" } })] }));
  }
  if (config.subtitle) {
    ch.push(new Paragraph({ indent: { left: padL }, spacing: { after: 800 }, children: [new TextRun({ text: config.subtitle, size: 24, color: c(P.cover.subtitleColor), font: { ascii: "Calibri" } })] }));
  }
  for (const line of (config.metaLines || [])) {
    ch.push(new Paragraph({ indent: { left: padL + 200 }, spacing: { after: 80 }, border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: c(P.cover.metaColor), font: { ascii: "Calibri" } })] }));
  }
  ch.push(new Paragraph({ spacing: { before: sp.bottomSpacing } }));
  ch.push(new Paragraph({ indent: { left: padL, right: padR }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: c(P.accent), space: 8 } }, spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: c(P.cover.footerColor), font: { ascii: "Calibri" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: c(P.cover.footerColor), font: { ascii: "Calibri" } }),
    ] }));
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: require("docx").TableLayoutType.FIXED, borders: allNoBorders,
    rows: [new TableRow({ height: { value: 16838, rule: "exact" }, children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: c(P.bg) }, borders: noBorders, children: ch })] })] })];
}

// ── Simple table builder ──
function buildTable(headers, rows, colWidths) {
  const totalW = colWidths.reduce((a,b) => a+b, 0);
  return new Table({ width: { size: totalW, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true,
        children: headers.map((h, i) => headerCell(h, colWidths[i])) }),
      ...rows.map((row, ri) => new TableRow({ cantSplit: true,
        children: row.map((cell, ci) => dataCell(cell, colWidths[ci], { shaded: ri % 2 === 1 })) })),
    ] });
}

// ══════════════════════════════════════════════════════════════════════════
// DOCUMENT CONTENT
// ══════════════════════════════════════════════════════════════════════════

const coverConfig = {
  title: "ELASTICO Project State Audit",
  subtitle: "Comprehensive Status Assessment — August 2026",
  englishLabel: "FOOTBALL INTELLIGENCE WORKSTATION",
  metaLines: ["Audit Date: 2026-08-21", "Scope: Frontend + Backend + Infrastructure + ML Pipeline", "Method: Full codebase inspection, live endpoint testing, runtime verification"],
  footerLeft: "ELASTICO Confidential",
  footerRight: "Build Phase Readiness Gate",
  palette,
};

const bodyChildren = [];

// ── TOC ──
bodyChildren.push(new Paragraph({ spacing: { before: 200, after: 200 }, children: [new TextRun({ text: "Table of Contents", size: 32, bold: true, color: c(palette.body), font: { ascii: "Calibri" } })] }));
bodyChildren.push(new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }));
bodyChildren.push(new Paragraph({ spacing: { before: 100, after: 100 }, children: [new TextRun({ text: "Right-click the table of contents and select \"Update Field\" to refresh page numbers.", size: 18, italics: true, color: c(palette.secondary), font: { ascii: "Calibri" } })] }));
bodyChildren.push(new Paragraph({ children: [new PageBreak()] }));

// ══════════════════════════════════════════════════════════════════════════
// 1. EXECUTIVE SUMMARY
// ══════════════════════════════════════════════════════════════════════════
bodyChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text: "1. Executive Summary", bold: true, size: 32, color: c(palette.body), font: { ascii: "Calibri" } })] }));

bodyChildren.push(body("This audit provides a comprehensive assessment of the ELASTICO Football Intelligence Workstation as of August 21, 2026. The project has progressed through nine completed phases (0 through 6A) plus an initial build phase, but remains far from production readiness. The core finding is that while significant analytical and audit work has been completed, the actual running application still contains substantial fabrication, dead features, and disconnected infrastructure that must be resolved before the platform can serve real users with honest, trustworthy football intelligence data."));

bodyChildren.push(body("The ML pipeline has been thoroughly validated through five temporal windows, producing a clear verdict: raw bookmaker odds outperform all engineered models on every metric. The XGBoost model achieves 51.3% test accuracy with significant overfitting (train 85.7%), while LSTM catastrophically failed and was excluded from the ensemble. The Phase 6A forensic audit identified 63 fabrications across 9 frontend views, of which approximately 60 have been addressed in the initial build phase. However, the build was applied to only one of three codebase copies, and 10+ additional views and backend endpoints remain unaddressed."));

bodyChildren.push(body("The most critical immediate risks are: (1) the primary prediction endpoint crashes on every call due to a Python attribute name bug, (2) the database is completely empty with no seed data, (3) zero API keys are configured for any external data source, (4) three redundant copies of the frontend codebase exist with divergent states, and (5) the backend FastAPI server is not running. The frontend Next.js dev server compiles and serves on port 3000 with zero TypeScript errors, which represents the strongest foundation element in the project."));

// Key metrics table
bodyChildren.push(bodyBold("Key Metrics at a Glance"));
bodyChildren.push(buildTable(
  ["Metric", "Value", "Status"],
  [
    ["Frontend TypeScript Errors", "0", "PASS"],
    ["Backend /predict Endpoint", "CRASH (AttributeError)", "FAIL"],
    ["Backend /super-ensemble Endpoint", "5 of 6 models active", "PARTIAL"],
    ["Database (SQLite)", "17 tables, 0 rows", "EMPTY"],
    ["API Keys Configured", "0 of 13", "MISSING"],
    ["Fabrications (Phase 6A count)", "63 across 9 views", "DOCUMENTED"],
    ["Fabrications Fixed (Build Phase 1)", "~60 in 7 rebuilt views", "PARTIAL"],
    ["Views NOT Rebuilt", "10 views untouched", "REMAINING"],
    ["Frontend Dev Server", "Running on :3000", "ACTIVE"],
    ["Backend FastAPI Server", "Not running", "INACTIVE"],
    ["ESPN Live Scores API", "Working (1 event today)", "ACTIVE"],
    ["LSTM Model", "Failed, excluded", "DEAD"],
    ["XGBoost Model Accuracy", "51.3% (test)", "VALIDATED"],
    ["Codebase Copies", "3 divergent copies", "RISK"],
  ],
  [4000, 4000, 1800]
));

// ══════════════════════════════════════════════════════════════════════════
// 2. PROJECT STRUCTURE & CODEBASE COPIES
// ══════════════════════════════════════════════════════════════════════════
bodyChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 }, children: [new TextRun({ text: "2. Project Structure and Codebase Copies", bold: true, size: 32, color: c(palette.body), font: { ascii: "Calibri" } })] }));

bodyChildren.push(body("The most significant structural risk in the project is the existence of three divergent copies of the frontend codebase. During the development process, the code was cloned and modified in multiple locations without establishing a single canonical source of truth. This has led to a situation where the Build Phase 1 changes were applied to only one copy, while the other two remain in the pre-build state with all original fabrications intact. Any future development must begin by consolidating these copies to prevent further divergence and ensure that all changes propagate correctly."));

bodyChildren.push(bodyBold("Three Frontend Copies"));
bodyChildren.push(buildTable(
  ["Location", "Role", "Node Modules", "Build Phase 1?", "Size"],
  [
    ["/home/z/my-project/src/", "ACTIVE (running :3000)", "Via parent (1.2 GB)", "YES (Aug 20)", "Source only"],
    ["/home/z/my-project/elastico-work/Elastico-main/src/", "Clean reference", "NO", "NO (Aug 16)", "3.7 MB"],
    ["/home/z/my-project/elastico-source/src/", "Stale build cache", "NO", "Partial", "350 MB total"],
  ],
  [2800, 1800, 1500, 1600, 1100]
));

bodyChildren.push(body("The active running code at /home/z/my-project/src/ is the only copy that received Build Phase 1 fixes. This is the code served by the Next.js dev server on port 3000. The elastico-work copy is a clean pre-build snapshot that preserves the original audited state, which has value as a reference but creates confusion about which copy is authoritative. The elastico-source copy is the most problematic: it contains its own .next build cache, a Vercel OIDC token in .env.local, and has had some independent modifications (4 modified files including next.config.ts and prisma schema) that may conflict with the active copy."));

bodyChildren.push(body("The backend exists as a single copy at /home/z/my-project/football-prediction-mega/ with 19 unstaged modified files and 4 untracked directories. It uses system Python packages (no virtual environment) and has 8 of 22 required dependencies missing, including torch (for LSTM), sqlalchemy (for the entire database layer), and several auth-related packages. Despite these missing dependencies, the FastAPI app loads and registers 30 routes because the database and auth modules use lazy imports that are never triggered by any current route."));

// ══════════════════════════════════════════════════════════════════════════
// 3. BUILD PHASE 1 ASSESSMENT
// ══════════════════════════════════════════════════════════════════════════
bodyChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 }, children: [new TextRun({ text: "3. Build Phase 1 Assessment", bold: true, size: 32, color: c(palette.body), font: { ascii: "Calibri" } })] }));

bodyChildren.push(body("Build Phase 1 was executed on August 20, 2026, deploying three parallel subagents to rewrite the seven most fabrication-dense views. The worklog confirms TypeScript compilation passed (zero errors) and the Next.js dev server compiled successfully, serving 48,950 bytes of HTML with a 200 status code. Seven view files were rewritten with the goal of eliminating all fabricated data patterns. However, verification against the running code reveals a more nuanced picture."));

bodyChildren.push(bodyBold("Views Rebuilt in Build Phase 1"));
bodyChildren.push(buildTable(
  ["View", "Original Lines", "Rebuilt Lines", "Original Fabrications", "Remaining Issues"],
  [
    ["dashboard-view.tsx", "709", "629", "11", "0 detected"],
    ["matches-view.tsx", "505", "585", "6", "0 detected"],
    ["predictions-view.tsx", "434", "895", "20", "0 detected"],
    ["compare-view.tsx", "525", "416", "13", "0 detected"],
    ["chat-view.tsx", "611", "631", "4", "Mock fallback (honest)"],
    ["news-view.tsx", "593", "530", "3", "0 detected"],
    ["settings-view.tsx", "1343", "1319", "0", "Model count corrected"],
  ],
  [2000, 1400, 1400, 1800, 2200]
));

bodyChildren.push(body("The rebuild successfully eliminated all detected fabrication patterns (MOCK_ constants, hardcoded values, Math.random() calls, hashCode-based probability generation, and fake model comparisons) from the seven targeted views. Grep searches for common fabrication patterns return zero hits across all rebuilt files. The views now implement proper four-state handling (LOADING, EMPTY, ERROR, SUCCESS) and present honest empty states when data is unavailable rather than fabricating plausible-looking numbers."));

bodyChildren.push(body("However, two significant caveats apply. First, the chat API route still falls back to hardcoded mock responses when no AI provider is configured, though it now honestly labels these as 'mock-fallback' with provider: 'none' headers, making the mock nature transparent to any consumer inspecting the response metadata. Second, the predictions-view.tsx more than doubled in size (434 to 895 lines) because the rebuild added extensive honest empty-state UI, data type labels, and input validation that the original lacked entirely."));

// ══════════════════════════════════════════════════════════════════════════
// 4. UNBUILT VIEWS AND REMAINING ISSUES
// ══════════════════════════════════════════════════════════════════════════
bodyChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 }, children: [new TextRun({ text: "4. Unbuilt Views and Remaining Issues", bold: true, size: 32, color: c(palette.body), font: { ascii: "Calibri" } })] }));

bodyChildren.push(body("Build Phase 1 targeted the seven fabrication-dense views identified in the Phase 6A audit, but the application contains 21 view components total. The remaining 14 views fall into several categories: views that were already stubbed out before the build, views that still contain original fabrications, and views that have moderate issues. This section catalogs every unbuilt view with its current state and the specific issues that must be addressed in subsequent build steps."));

bodyChildren.push(bodyBold("Pre-Build Stubs (Honestly Empty)"));
bodyChildren.push(body("Two views were reduced to honest stubs before Build Phase 1, on August 14. The social-view.tsx was reduced from 548 lines to just 21 lines, showing only a centered message that social features are under development. The achievements-view.tsx was similarly reduced from 617 lines to 18 lines, stating that achievement tracking is being developed. These stubs represent the correct approach: rather than presenting fabricated data, they honestly disclose that the features do not yet exist. No further action is needed for these two views."));

bodyChildren.push(bodyBold("Views with Remaining Fabrications or Dead Features"));
bodyChildren.push(buildTable(
  ["View", "Lines (Running)", "Lines (Original)", "Key Issues"],
  [
    ["leaderboard-view.tsx", "312", "347", "MOCK_GOLDEN_BOOT (5 fake entries), random rank changes"],
    ["prediction-engine-view.tsx", "1014", "1432", "Complex view with 4 tabs, largely pre-built state"],
    ["match-detail-view.tsx", "692", "612", "Was 20 fabrications in audit; modified Aug 15 pre-build"],
    ["tactical-view.tsx", "714", "528", "3 fabrications fixed pre-build; 714 vs 528 = expansion"],
    ["admin-view.tsx", "1719", "2247", "Fabricated model performance data, fake system health"],
    ["subscription-view.tsx", "255", "257", "Advertises non-existent Dixon-Coles model"],
    ["notifications-view.tsx", "364", "422", "Fabricated feature announcements"],
    ["system-monitor-view.tsx", "1266", "1617", "Fabricated forecast data, fake system metrics"],
    ["tournament-view.tsx", "273", "408", "Reduced but may contain stale data references"],
    ["player-view.tsx", "928", "860", "0 fabrications per audit; honest empty states"],
  ],
  [2200, 1200, 1200, 5200]
));

bodyChildren.push(body("The leaderboard, admin, subscription, notifications, and system-monitor views all contain fabrications that promote non-existent features, particularly the Dixon-Coles model, which is frequently cited in UI text, feature lists, and fake social proof despite never being deployed as a distinct user-facing feature (it exists only as one of three mathematical models inside the backend ensemble). The subscription view explicitly lists Dixon-Coles as a Pro/Elite tier feature, which is misleading. The admin view contains fabricated model performance entries and a system health endpoint that reports 'database: connected' without actually checking any connection."));

bodyChildren.push(body("The match-detail-view and tactical-view are in an ambiguous state. Both were modified on August 15, before the Phase 6A audit and before Build Phase 1. The tactical view shows evidence of early remediation (honest data notes replacing fabricated analysis), but the match detail view expanded from 612 to 692 lines, and its modifications predate the systematic audit, making it unclear whether all 20 originally documented fabrications were properly addressed. Both views require fresh inspection against the audit checklist."));

// ══════════════════════════════════════════════════════════════════════════
// 5. BACKEND STATUS
// ══════════════════════════════════════════════════════════════════════════
bodyChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 }, children: [new TextRun({ text: "5. Backend Status", bold: true, size: 32, color: c(palette.body), font: { ascii: "Calibri" } })] }));

bodyChildren.push(body("The FastAPI backend at /home/z/my-project/football-prediction-mega/ is in a partially functional state. The application loads successfully and registers 30 routes across 6 routers, but several critical endpoints are broken or non-functional. The most severe issue is that the primary prediction endpoint (POST /api/predictions/predict) crashes on every invocation due to an attribute name mismatch that was not caught by the Phase 6A audit."));

bodyChildren.push(bodyBold("Critical Bug: /predict Endpoint Crash"));
bodyChildren.push(body("The file src/api/routes/predictions.py at lines 229-232 references settings.ensemble_weights_elo, settings.ensemble_weights_poisson, settings.ensemble_weights_dixon_coles, and settings.ensemble_weights_market (all plural). However, the Settings class in config/settings.py defines these as singular: ensemble_weight_elo, ensemble_weight_poisson, ensemble_weight_dixon_coles. Additionally, ensemble_weights_market does not exist in Settings at all. This means every call to /api/predictions/predict triggers an AttributeError. The fix is trivial (change plural to singular in 4 lines), but this bug was introduced after the Phase 6A audit and has never been caught or fixed."));

bodyChildren.push(bodyBold("Prediction Engine Status"));
bodyChildren.push(buildTable(
  ["Model", "Location", "Status", "Notes"],
  [
    ["ELO", "/predict + /super-ensemble", "WORKS", "Standard logistic formula with home advantage"],
    ["Poisson", "/predict + /super-ensemble", "WORKS", "Independent Poisson, max_goals=10"],
    ["Dixon-Coles", "/predict + /super-ensemble", "WORKS", "Correlated Poisson with rho=-0.1"],
    ["Monte Carlo", "/simulate", "WORKS", "10K-100K simulations"],
    ["Stochastic (Merton+GARCH)", "/super-ensemble only", "WORKS", "716-line engine, 150K simulations"],
    ["XGBoost", "/super-ensemble only", "WORKS", "Trained on 3,657 matches, 79 iterations"],
    ["LSTM", "/super-ensemble", "DEAD (no torch)", "Model file exists but torch not installed"],
    ["3-Model Ensemble", "/predict", "CRASHES", "settings attribute name bug"],
    ["6-Model Super-Ensemble", "/super-ensemble", "WORKS (5/6)", "LSTM weight redistributed to others"],
  ],
  [1800, 2200, 1600, 3200]
));

bodyChildren.push(body("The super-ensemble endpoint is the only fully working prediction path, using its own EnsembleConfig with per-model weights rather than reading from settings.py. With 5 active models (ELO 15%, Poisson 15%, Dixon-Coles 15%, Stochastic 20%, XGBoost 20%, plus LSTM's 15% redistributed), it produces reasonable probability outputs. The XGBoost model was trained on 3,657 matches from 2021-2024 with 50 engineered features and achieves 51.3% accuracy on the 2024-2025 test set. The stochastic Merton Jump-Diffusion + GARCH engine is the most sophisticated component, running 150,000 simulations with Cholesky decomposition, but it exists only in the super-ensemble path."));

bodyChildren.push(bodyBold("Broken and Stub Endpoints"));
bodyChildren.push(buildTable(
  ["Endpoint", "Status", "Root Cause"],
  [
    ["GET /api/stats/team/{id}", "501 NotImplementedError", "Database connection required but not built"],
    ["GET /api/matches/{id}", "501 NotImplementedError", "Database connection required but not built"],
    ["POST /api/data/odds/current", "400 Bad Request", "ODDS_API_KEY not configured"],
    ["GET /api/data/api-football/fixtures", "400 Bad Request", "API_FOOTBALL_KEY not configured"],
    ["GET /api/training/evaluation/{name}", "404 Not Found", "saved_metrics/ directory is empty"],
    ["GET /admin/system/health", "200 (LIES)", "Returns database: connected without checking"],
    ["GET /admin/models", "200 (STALE)", "Lists 4 models, missing stochastic/xgboost/lstm"],
    ["GET /api/predictions/history", "200 (EMPTY)", "Returns empty list, no DB storage"],
  ],
  [3200, 2200, 3400]
));

bodyChildren.push(body("The entire database layer (src/db.py with async SQLAlchemy, src/models.py with 37KB of ORM models) is dead code. No route uses the get_db dependency, sqlalchemy is not installed, and the database URL from the parent .env points to a local SQLite file that has 17 tables but zero rows. The ORM models define 10+ entity types including League, Team, Player, Match, and Prediction, but none of these are ever instantiated in any route handler. This means the backend operates entirely statelessly: predictions are computed on-the-fly from request parameters, and no historical data is persisted."));

// ══════════════════════════════════════════════════════════════════════════
// 6. ML PIPELINE STATUS
// ══════════════════════════════════════════════════════════════════════════
bodyChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 }, children: [new TextRun({ text: "6. ML Pipeline Status", bold: true, size: 32, color: c(palette.body), font: { ascii: "Calibri" } })] }));

bodyChildren.push(body("The ML pipeline has been the most rigorously validated component of the project, progressing through six phases of increasingly sophisticated testing. The training dataset contains 7,536 matches from five European leagues (EPL, La Liga, Serie A, Bundesliga, Ligue 1) spanning September 2020 to May 2025, with 50 engineered features computed under strict temporal ordering to prevent data leakage. A 20-check validation gate confirmed zero temporal leakage violations, zero duplicates, and proper chronological splitting."));

bodyChildren.push(body("The XGBoost model represents the primary ML contribution. Trained with early stopping at round 79 (best validation log-loss 0.9766), it achieves 51.3% test accuracy with an ECE (Expected Calibration Error) of 0.0485, indicating reasonable probability calibration. However, the stress test in Phase 3.5 revealed a fundamental finding: market/odds features (implied probabilities from bookmaker odds) are the dominant predictive signal, and football-specific features (form, xG, ELO trends, possession) add negligible independent value. The market-only XGBoost model wins log-loss in 3 of 5 temporal windows, while the football-only model wins in zero. The combined model is inconsistent, winning in 2 of 5 windows but hurting in others."));

bodyChildren.push(body("The LSTM model was trained as a two-branch BiLSTM with attention (93,796 parameters) on sequential match histories. It failed catastrophically: test log-loss of 3.1-3.8 compared to XGBoost's approximately 1.0, with an extreme overfitting gap (train LL 0.03 vs test LL 3.48, a gap of 3.45 compared to XGBoost's 0.5). The root cause is that temporal patterns in football features do not transfer between seasons with only 3,000-4,000 training sequences available. The model file (lstm_v1.pt, 384KB) is preserved for record-keeping but has been excluded from the ensemble."));

bodyChildren.push(body("Phase 5 calibration testing produced the definitive strategic finding: raw bookmaker probabilities dominate all models on all metrics in all 5 temporal windows (average log-loss 0.959 vs best model 1.100). This means that the path to differentiation lies not in better algorithms but in better data: real xG from providers like Understat, injury data, lineup information, and opening-vs-closing odds movements that are already present in the source CSVs but unused."));

bodyChildren.push(bodyBold("ML Experiment Summary"));
bodyChildren.push(buildTable(
  ["Phase", "Experiment", "Key Result", "Verdict"],
  [
    ["Phase 2", "Data Foundation", "7,536 rows, 50 features, 0 leakage", "PASS"],
    ["Phase 2.5", "Validation Gate", "20/20 checks passed", "PASS"],
    ["Phase 3", "XGBoost Training", "51.3% accuracy, ECE 0.0485", "MARGINAL"],
    ["Phase 3.5", "Stress Test", "Market features dominate", "MARKET WINS"],
    ["Phase 4", "LSTM BiLSTM", "LL 3.1-3.8, catastrophic overfit", "FAILED"],
    ["Phase 5", "Calibration", "Raw odds LL 0.959 beats all", "ODDS DOMINATE"],
    ["Phase 6", "Data Advantage Audit", "Bottleneck is information, not algorithms", "STRATEGIC"],
  ],
  [1200, 2000, 3200, 2400]
));

// ══════════════════════════════════════════════════════════════════════════
// 7. INFRASTRUCTURE & SECURITY
// ══════════════════════════════════════════════════════════════════════════
bodyChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 }, children: [new TextRun({ text: "7. Infrastructure and Security", bold: true, size: 32, color: c(palette.body), font: { ascii: "Calibri" } })] }));

bodyChildren.push(body("The infrastructure layer reveals several concerning security and configuration issues. The most critical is that hardcoded Neon PostgreSQL credentials (database URL with password npg_8zPlbIK5NwaR) exist in config/settings.py line 15, committed to the git history. Although the parent .env overrides this with a local SQLite path at runtime, the credentials remain exposed in the source code and in commit fc80d9a of the backend repository. These credentials should be rotated immediately regardless of whether they are currently used."));

bodyChildren.push(body("A Vercel OIDC token was found in /home/z/my-project/elastico-source/.env.local, which is another sensitive credential that should not exist in any codebase copy. The frontend .env.example file lists 13 required environment variables, but the actual .env file contains only the DATABASE_URL directive pointing to the local SQLite database. Zero API keys are configured for any external service: no FOOTBALL_DATA_API_KEY, no API_SPORTS_KEY, no THE_ODDS_API_KEY, no NEWSDATA_API_KEY, and no AI provider keys (GOOGLE_AI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY, NVIDIA_API_KEY). This means every external data integration falls back to empty responses or mock data."));

bodyChildren.push(bodyBold("Environment Configuration Status"));
bodyChildren.push(buildTable(
  ["Variable", "Status", "Impact When Missing"],
  [
    ["DATABASE_URL", "CONFIGURED (SQLite)", "DB works but empty (0 rows)"],
    ["JWT_SECRET", "NOT CONFIGURED", "Authentication non-functional"],
    ["SETUP_TOKEN", "NOT CONFIGURED", "DB seeding route unprotected"],
    ["FOOTBALL_DATA_API_KEY", "NOT CONFIGURED", "European league data unavailable"],
    ["API_SPORTS_KEY", "NOT CONFIGURED", "API-Sports data unavailable"],
    ["THE_ODDS_API_KEY", "NOT CONFIGURED", "Betting odds unavailable"],
    ["NEWSDATA_API_KEY", "NOT CONFIGURED", "News falls back to seed data"],
    ["GOOGLE_AI_API_KEY", "NOT CONFIGURED", "AI chat falls to mock responses"],
    ["GROQ_API_KEY", "NOT CONFIGURED", "AI chat falls to mock responses"],
    ["NVIDIA_API_KEY", "NOT CONFIGURED", "TimesFM prediction falls to mock"],
    ["MEGA_PREDICT_API_URL", "NOT CONFIGURED", "Backend prediction returns 503"],
  ],
  [2600, 2200, 5000]
));

bodyChildren.push(body("The disk usage is 2.2 GB total, with 1.2 GB consumed by node_modules, 406 MB by the .next build cache, and 350 MB by the redundant elastico-source copy. Cleanup of the redundant codebase copy and stale build caches would reclaim approximately 812 MB. The Docker Compose files exist for production deployment (frontend: Caddy reverse proxy with SQLite, backend: full stack with PostgreSQL 16 and pgAdmin), but Docker is not available in the current sandbox environment."));

bodyChildren.push(body("The git state shows 23 unpushed commits on the frontend repository with UUID-style auto-generated commit messages that provide no human-readable context. The backend has 19 unstaged modified files and 4 untracked directories that have never been committed. Both repositories use GitHub remotes with embedded authentication tokens in the remote URLs, which is a security concern as these tokens are visible in git config."));

// ══════════════════════════════════════════════════════════════════════════
// 8. BUILD PHASE READINESS
// ══════════════════════════════════════════════════════════════════════════
bodyChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 }, children: [new TextRun({ text: "8. Build Phase Readiness Assessment", bold: true, size: 32, color: c(palette.body), font: { ascii: "Calibri" } })] }));

bodyChildren.push(body("The original 13-step build order from the 28-section directive placed the project at Step 3 (Connect Live Data) after completing Steps 1-2 (Audit UI and Audit Data Flows). However, Build Phase 1 (executed out of sequence) partially addressed Steps 4-9 for seven views. This creates an irregular state where some views are rebuilt but the underlying data infrastructure they depend on remains non-functional. The following assessment maps each build step to its current status and identifies the prerequisites that must be satisfied before proceeding."));

bodyChildren.push(buildTable(
  ["Step", "Description", "Status", "Blockers"],
  [
    ["1", "Audit UI", "COMPLETE", "None"],
    ["2", "Audit data flows", "COMPLETE", "None"],
    ["3", "Connect live data", "NOT STARTED", "No API keys, backend not running"],
    ["4", "Truthful dashboard", "DONE (Build 1)", "Depends on Step 3 for real data"],
    ["5", "Truthful match center", "DONE (Build 1)", "Depends on Step 3 for real data"],
    ["6", "Truthful prediction engine", "DONE (Build 1)", "Backend /predict crashes"],
    ["7", "Match intelligence page", "PARTIAL (pre-build)", "Needs re-audit post Aug 15 changes"],
    ["8", "Team intelligence", "DONE (Build 1)", "Depends on real team data"],
    ["9", "Player intelligence", "NOT STARTED", "0 fabrications; needs real data"],
    ["10", "Fix navigation/micro-interactions", "NOT STARTED", "Depends on Steps 3-9"],
    ["11", "Remove placeholder/fake/dead UI", "PARTIAL", "10+ views still have issues"],
    ["12", "Responsive audit", "NOT STARTED", "Depends on stable views"],
    ["13", "AI-generated app audit", "NOT STARTED", "Depends on all above"],
  ],
  [600, 2800, 2000, 3400]
));

bodyChildren.push(body("The critical path through the remaining build steps is blocked by two infrastructure prerequisites: (1) the backend must be running and serving predictions, which requires fixing the /predict endpoint bug and optionally creating a backend .env file, and (2) at least one external data API must be connected with valid credentials to provide real match, team, and player data. Without these, the rebuilt views will continue showing empty states regardless of how well-designed their UI is. The recommended approach is to consolidate the three codebase copies into a single canonical location, fix the backend /predict bug, connect the ESPN live scores API (which works without a key and returned 1 event during testing), and then proceed through the remaining build steps sequentially."));

// ══════════════════════════════════════════════════════════════════════════
// 9. RISK REGISTER
// ══════════════════════════════════════════════════════════════════════════
bodyChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 }, children: [new TextRun({ text: "9. Risk Register", bold: true, size: 32, color: c(palette.body), font: { ascii: "Calibri" } })] }));

bodyChildren.push(buildTable(
  ["Severity", "Risk", "Impact", "Mitigation"],
  [
    ["CRITICAL", "Backend /predict crashes on every call", "No predictions work via primary path", "Fix 4 lines: plural to singular attribute names"],
    ["CRITICAL", "Neon DB credentials in git history", "Credential exposure", "Rotate credentials, remove from source, git history scrub"],
    ["CRITICAL", "Vercel OIDC token in .env.local", "Token exposure", "Remove file, add to .gitignore"],
    ["HIGH", "3 divergent codebase copies", "Changes applied to wrong copy", "Consolidate to single canonical location"],
    ["HIGH", "Database completely empty (0 rows)", "No data for any DB-backed feature", "Run seed script or connect live data source"],
    ["HIGH", "Zero API keys configured", "All external integrations dead", "Configure at minimum: one AI key, one data key"],
    ["HIGH", "10+ unbuilt views with fabrications", "User sees fake data in half the app", "Continue build phase for remaining views"],
    ["MEDIUM", "Backend not running", "Frontend backend calls fail", "Install missing deps, create .env, start uvicorn"],
    ["MEDIUM", "xG training data is SOT x 0.1 proxy", "XGBoost trained on fake xG", "Document as PROXY, retrain if real xG acquired"],
    ["MEDIUM", "23 unpushed frontend commits", "Work loss risk", "Squash with meaningful messages, push"],
    ["LOW", "812 MB reclaimable disk waste", "Disk space", "Remove elastico-source, clean build caches"],
    ["LOW", "TEST_ARTIFACT_DO_NOT_USE in saved_models", "Confusion", "Delete stale test artifact"],
  ],
  [1200, 2600, 2200, 3800]
));

// ══════════════════════════════════════════════════════════════════════════
// 10. RECOMMENDED NEXT ACTIONS
// ══════════════════════════════════════════════════════════════════════════
bodyChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 }, children: [new TextRun({ text: "10. Recommended Next Actions", bold: true, size: 32, color: c(palette.body), font: { ascii: "Calibri" } })] }));

bodyChildren.push(body("The following actions are prioritized by impact and dependency order. Each action addresses a specific blocker identified in this audit and creates the foundation for subsequent steps. The first three actions are prerequisites for all remaining build work and should be executed before any further view rebuilding."));

bodyChildren.push(body("Action 1: Consolidate Codebase Copies. Identify /home/z/my-project/src/ as the single canonical frontend location. Delete or archive elastico-source/ (350 MB saved). Keep elastico-work/Elastico-main/ as a read-only reference of the pre-build audited state. Update any scripts or documentation that reference the old paths to point to the canonical location."));

bodyChildren.push(body("Action 2: Fix the /predict Endpoint Bug. In /home/z/my-project/football-prediction-mega/src/api/routes/predictions.py, change lines 229-232 from ensemble_weights_elo (plural) to ensemble_weight_elo (singular) to match the Settings class. This is a 4-line fix that unblocks the primary prediction path. Verify by calling the endpoint with test data after the fix."));

bodyChildren.push(body("Action 3: Security Remediation. Rotate the Neon DB credentials exposed in config/settings.py line 15 and git commit fc80d9a. Remove the Vercel OIDC token from elastico-source/.env.local. Consider using git filter-branch or BFG to scrub sensitive data from history if the repositories are public."));

bodyChildren.push(body("Action 4: Configure Minimum API Keys. At minimum, configure one AI provider key (e.g., GOOGLE_AI_API_KEY or GROQ_API_KEY) to enable the chat feature, and the NEWSDATA_API_KEY to enable live news. The ESPN API works without a key and is already functional for live scores. The FOOTBALL_DATA_API_KEY would enable European league data import."));

bodyChildren.push(body("Action 5: Seed the Database. Run the Prisma seed script (or a revised version with real data) to populate the SQLite database with initial teams, matches, and player records. Alternatively, if the architectural decision is to rely entirely on external APIs rather than local storage, remove the database-dependent code and update views to consume API responses directly."));

bodyChildren.push(body("Action 6: Continue Build Phase for Remaining Views. Rebuild the 10 unbuilt views (leaderboard, prediction-engine, match-detail, admin, subscription, notifications, system-monitor, tournament, plus re-audit tactical and player views) following the same honest-data principles applied in Build Phase 1. Priority should be given to views accessible from the navigation sidebar that users are most likely to encounter."));

// ══════════════════════════════════════════════════════════════════════════
// ASSEMBLE DOCUMENT
// ══════════════════════════════════════════════════════════════════════════
const doc = new Document({
  styles: {
    default: { document: {
      run: { font: { ascii: "Calibri" }, size: 24, color: c(palette.body) },
      paragraph: { spacing: { line: 312 } },
    }},
    heading1: { run: { font: { ascii: "Calibri" }, size: 32, bold: true, color: c(palette.body) } },
    heading2: { run: { font: { ascii: "Calibri" }, size: 28, bold: true, color: c(palette.body) } },
  },
  sections: [
    // Cover section
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1(coverConfig),
    },
    // Body section
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 } },
      },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "ELASTICO Project State Audit", size: 16, color: c(palette.secondary), font: { ascii: "Calibri" } })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Page ", size: 16, color: c(palette.secondary), font: { ascii: "Calibri" } }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: c(palette.secondary), font: { ascii: "Calibri" } })] })] }) },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/home/z/my-project/download/ELASTICO_Project_State_Audit_2026-08-21.docx", buf);
  console.log("Document generated successfully");
});
