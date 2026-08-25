#!/usr/bin/env python3
"""
ELASTICO Comprehensive Project Report — PDF Generator
Generates a full audit-style report covering architecture, ML pipeline,
UI/UX, data integrity, and blockers.
"""

import os, sys, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, HRFlowable, CondPageBreak,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus import SimpleDocTemplate
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ─── Paths ───
OUTPUT_PDF = "/home/z/my-project/download/ELASTICO_Comprehensive_Project_Report.pdf"
PDF_SKILL_DIR = "/home/z/my-project/elastico-source/skills/pdf"

# ─── Cascade Palette ───
PAGE_BG       = colors.HexColor("#f5f5f4")
SECTION_BG    = colors.HexColor("#ecebe9")
CARD_BG       = colors.HexColor("#eae9e5")
TABLE_STRIPE  = colors.HexColor("#efeeed")
HEADER_FILL   = colors.HexColor("#524c3b")
COVER_BLOCK   = colors.HexColor("#786e51")
BORDER_CLR    = colors.HexColor("#d3cec1")
ICON_CLR      = colors.HexColor("#877339")
ACCENT        = colors.HexColor("#96771c")
ACCENT2       = colors.HexColor("#3e94b1")
TEXT_PRIMARY   = colors.HexColor("#181715")
TEXT_MUTED    = colors.HexColor("#8e8c85")
SUCCESS       = colors.HexColor("#457755")
WARNING       = colors.HexColor("#8a7449")
ERROR_CLR     = colors.HexColor("#97554f")
INFO_CLR      = colors.HexColor("#497199")

# ─── Font Registration ───
pdfmetrics.registerFont(TTFont("FreeSerif", "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Bold", "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Italic", "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-BoldItalic", "/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf"))
pdfmetrics.registerFont(TTFont("FreeSans", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("FreeSans-Bold", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
pdfmetrics.registerFontFamily(
    "FreeSerif",
    normal="FreeSerif",
    bold="FreeSerif-Bold",
    italic="FreeSerif-Italic",
    boldItalic="FreeSerif-BoldItalic",
)
pdfmetrics.registerFontFamily(
    "FreeSans",
    normal="FreeSans",
    bold="FreeSans-Bold",
)
pdfmetrics.registerFontFamily(
    "DejaVuSans",
    normal="DejaVuSans",
    bold="DejaVuSans-Bold",
)

# ─── Styles ───
styles = getSampleStyleSheet()

s_h1 = ParagraphStyle(
    "H1", parent=styles["Normal"],
    fontName="FreeSans-Bold", fontSize=20, leading=26,
    textColor=TEXT_PRIMARY, spaceBefore=18, spaceAfter=10,
)
s_h2 = ParagraphStyle(
    "H2", parent=styles["Normal"],
    fontName="FreeSans-Bold", fontSize=14, leading=19,
    textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=6,
)
s_h3 = ParagraphStyle(
    "H3", parent=styles["Normal"],
    fontName="FreeSans-Bold", fontSize=11.5, leading=15,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=4,
)
s_body = ParagraphStyle(
    "Body", parent=styles["Normal"],
    fontName="FreeSerif", fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY,
    spaceBefore=0, spaceAfter=6,
)
s_body_left = ParagraphStyle(
    "BodyLeft", parent=s_body,
    alignment=TA_LEFT,
)
s_bullet = ParagraphStyle(
    "Bullet", parent=s_body,
    leftIndent=24, bulletIndent=12,
    alignment=TA_LEFT,
)
s_callout = ParagraphStyle(
    "Callout", parent=s_body,
    leftIndent=14, borderPadding=(6, 6, 6, 6),
    backColor=colors.HexColor("#f5f3ee"),
    borderColor=ACCENT, borderWidth=3, borderRadius=2,
)
s_caption = ParagraphStyle(
    "Caption", parent=styles["Normal"],
    fontName="FreeSerif-Italic", fontSize=8.5, leading=12,
    textColor=TEXT_MUTED, alignment=TA_CENTER,
    spaceBefore=3, spaceAfter=6,
)
s_toc_h1 = ParagraphStyle(
    "TOCH1", fontName="FreeSerif", fontSize=13, leftIndent=20, leading=22,
    textColor=TEXT_PRIMARY,
)
s_toc_h2 = ParagraphStyle(
    "TOCH2", fontName="FreeSerif", fontSize=11, leftIndent=40, leading=18,
    textColor=TEXT_MUTED,
)

# Table styles
s_th = ParagraphStyle(
    "TH", fontName="FreeSans-Bold", fontSize=9.5, leading=13,
    textColor=colors.white, alignment=TA_CENTER,
)
s_td = ParagraphStyle(
    "TD", fontName="FreeSerif", fontSize=9.5, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER,
)
s_td_left = ParagraphStyle(
    "TDLeft", parent=s_td, alignment=TA_LEFT,
)

# ─── Doc Template with TOC support ───

class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, "bookmark_name"):
            level = getattr(flowable, "bookmark_level", 0)
            text = getattr(flowable, "bookmark_text", "")
            key = getattr(flowable, "bookmark_key", "")
            self.notify("TOCEntry", (level, text, self.page, key))


doc = TocDocTemplate(
    OUTPUT_PDF,
    pagesize=A4,
    leftMargin=0.85 * inch,
    rightMargin=0.85 * inch,
    topMargin=0.75 * inch,
    bottomMargin=0.75 * inch,
    title="ELASTICO Comprehensive Project Report",
    author="Z.ai",
    creator="Z.ai",
    subject="Full architecture, ML pipeline, UI/UX, and data integrity audit of the ELASTICO football prediction platform",
)

PAGE_W = A4[0]
AVAIL_W = PAGE_W - doc.leftMargin - doc.rightMargin
H1_ORPHAN = (A4[1] - doc.topMargin - doc.bottomMargin) * 0.15

# ─── Helpers ───

def heading(text, style, level=0):
    key = "h_%s" % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p


def h1(text):
    return [CondPageBreak(H1_ORPHAN), heading(text, s_h1, 0)]


def h2(text):
    return [heading(text, s_h2, 1)]


def h3(text):
    return [heading(text, s_h3, 2)]


def body(text):
    return Paragraph(text, s_body)


def bullet(text):
    return Paragraph("\u2022 " + text, s_bullet)


def callout(text):
    return Paragraph(text, s_callout)


def caption(text):
    return Paragraph(text, s_caption)


def divider():
    return HRFlowable(width="100%", color=BORDER_CLR, thickness=0.5, spaceBefore=6, spaceAfter=6)


def safe_keep(elements):
    total = 0
    for el in elements:
        w, h = el.wrap(AVAIL_W, A4[1])
        total += h
    if total <= A4[1] * 0.4:
        return [KeepTogether(elements)]
    elif len(elements) >= 2:
        return [KeepTogether(elements[:2])] + list(elements[2:])
    return list(elements)


def make_table(headers, rows, col_ratios=None):
    """Build a styled table with Paragraph cells."""
    if col_ratios is None:
        col_ratios = [1.0 / len(headers)] * len(headers)
    col_widths = [r * AVAIL_W for r in col_ratios]
    header_row = [Paragraph("<b>%s</b>" % h, s_th) for h in headers]
    data = [header_row]
    for row in rows:
        data.append([Paragraph(str(c), s_td if i > 0 else s_td_left) for i, c in enumerate(row)])
    t = Table(data, colWidths=col_widths, hAlign="CENTER")
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_FILL),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_CLR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = colors.white if i % 2 == 1 else TABLE_STRIPE
        style_cmds.append(("BACKGROUND", (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t


def status_badge(status, label):
    clr = SUCCESS if status == "PASS" else (ERROR_CLR if status == "FAIL" else WARNING)
    return '<font color="#%s"><b>[%s]</b></font> %s' % (clr.hexval()[2:], status, label)


# ─── Page template callbacks ───

def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont("FreeSans", 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(doc.leftMargin, A4[1] - 0.45 * inch, "ELASTICO Comprehensive Project Report")
    canvas.drawRightString(PAGE_W - doc.rightMargin, A4[1] - 0.45 * inch, "August 2026")
    canvas.setStrokeColor(BORDER_CLR)
    canvas.setLineWidth(0.5)
    canvas.line(doc.leftMargin, A4[1] - 0.52 * inch, PAGE_W - doc.rightMargin, A4[1] - 0.52 * inch)
    # Footer
    canvas.setFont("FreeSans", 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(doc.leftMargin, 0.45 * inch, "Z.ai")
    canvas.drawRightString(PAGE_W - doc.rightMargin, 0.45 * inch, "Page %d" % doc.page)
    canvas.setStrokeColor(BORDER_CLR)
    canvas.line(doc.leftMargin, 0.58 * inch, PAGE_W - doc.rightMargin, 0.58 * inch)
    canvas.restoreState()


def on_first_page(canvas, doc):
    pass  # No header/footer on cover (cover is separate PDF)


# ══════════════════════════════════════════════════════════════════════
# STORY
# ══════════════════════════════════════════════════════════════════════

story = []

# ─── Table of Contents ───
toc = TableOfContents()
toc.levelStyles = [s_toc_h1, s_toc_h2]
story.append(Paragraph("<b>Table of Contents</b>", ParagraphStyle(
    "TOCTitle", parent=s_h1, alignment=TA_LEFT, fontSize=22, spaceBefore=0, spaceAfter=18,
)))
story.append(toc)
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 1. EXECUTIVE SUMMARY
# ══════════════════════════════════════════════════════════════════════
story.extend(h1("1. Executive Summary"))
story.append(body(
    "ELASTICO is a full-stack football (soccer) analytics and prediction platform built on Next.js 16, React 19, "
    "Prisma 6, and PostgreSQL. The system integrates six external data providers (ESPN, football-data.org, "
    "TheSportsDB, The Odds API, Understat, and Newsdata.io) to deliver match intelligence, expected goals (xG) "
    "analysis, tactical visualizations, AI-powered chat, and a Python-based machine learning prediction engine. "
    "The platform comprises 171 TypeScript source files totaling 41,769 lines of code, with 50 API routes, 21 "
    "feature views, 48 shadcn/ui components, and 8 design-system primitives. A companion Python ML pipeline "
    "(29 modules) implements XGBoost, LSTM, ensemble, and Kelly Criterion engines trained on 7,537 matches."
))
story.append(Spacer(1, 6))
story.append(body(
    "The project has undergone 14 major development phases documented in 76 design decisions (DS-001 through "
    "DS-067), progressing from raw feature development through a rigorous design-system foundation, asset "
    "resolution pipeline, shell/navigation redesign, dashboard and live-matches rebuild, full DS compliance audit "
    "across all views, and a data-truth audit that eliminated fabricated defaults, silent catch blocks, and null-to-zero "
    "transforms. The codebase compiles with zero TypeScript errors and zero <b>as any</b> casts in any view file."
))
story.append(Spacer(1, 6))
story.append(callout(
    "<b>Critical Blocker (Cycle 4.5):</b> Real expected-goals data cannot be populated. The Understat getTeamData "
    "endpoint returns HTTP 404 for all team IDs, blocking the entire xG computation pipeline. Additionally, "
    "API_SPORTS_KEY and NEWSDATA_API_KEY are unconfigured, preventing entity resolution and news sync. "
    "Zero TeamAnalytic rows and zero real xG values exist in the production database."
))

# ══════════════════════════════════════════════════════════════════════
# 2. TECHNICAL ARCHITECTURE
# ══════════════════════════════════════════════════════════════════════
story.extend(h1("2. Technical Architecture"))

story.extend(h2("2.1 Technology Stack"))
story.append(body(
    "The frontend is a single-page application built with Next.js 16.1.1 (App Router) and React 19, styled "
    "with Tailwind CSS 4 and shadcn/ui. The data layer uses Prisma 6.19.3 with PostgreSQL (Neon) as the primary "
    "database, while Zustand manages client-side state. The application deploys to Vercel with standalone output "
    "mode, generating 33 static pages and 51 dynamic API routes at build time. The production build compiles in "
    "approximately 22.6 seconds with zero TypeScript errors, zero schema errors, and zero import errors."
))
story.append(Spacer(1, 6))
story.append(make_table(
    ["Layer", "Technology", "Version", "Purpose"],
    [
        ["Framework", "Next.js", "16.1.1", "App Router, SSR, API routes"],
        ["UI Library", "React", "19.0.0", "Component rendering"],
        ["Styling", "Tailwind CSS", "4.x", "Utility-first CSS"],
        ["Component System", "shadcn/ui", "latest", "48 UI primitives"],
        ["Database ORM", "Prisma", "6.19.3", "Type-safe data access"],
        ["Database", "PostgreSQL (Neon)", "--", "Primary data store"],
        ["State", "Zustand", "--", "Client-side state"],
        ["Charts", "Recharts", "--", "Data visualization"],
        ["Deployment", "Vercel", "--", "Standalone output mode"],
        ["ML Pipeline", "Python 3", "3.12+", "XGBoost, LSTM, ensemble"],
    ],
    col_ratios=[0.15, 0.22, 0.13, 0.50],
))
story.append(caption("Table 1: Core technology stack"))

story.extend(h2("2.2 Application Structure"))
story.append(body(
    "The codebase follows a layered architecture with clear separation of concerns. The <b>src/app/api/</b> directory "
    "contains 50 API route files organized by domain (matches, teams, players, predictions, analytics, admin, "
    "auth, sync, etc.), each handling a single REST endpoint. The <b>src/components/elastico/</b> directory holds "
    "21 view-level components (e.g., dashboard-view.tsx, matches-view.tsx, tactical-view.tsx), each responsible "
    "for a full screen of the application. Shared reusable components live in <b>src/components/ui/</b> (48 files) "
    "from shadcn/ui, while domain-specific design primitives (TeamCrest, PlayerHeadshot, FlagIcon, StatusBadge, "
    "etc.) are isolated in <b>src/components/elastico/primitives/</b> (8 files). Business logic, data transformations, "
    "and external API integrations are encapsulated in <b>src/lib/</b> (30+ modules totaling 10,930 lines), "
    "covering everything from the design system token definitions to entity resolution, prediction engines, "
    "and provider-specific API clients for each data source."
))
story.append(Spacer(1, 6))
story.append(make_table(
    ["Directory", "Files", "Lines", "Role"],
    [
        ["src/components/elastico/", "21 views + 10 other", "15,539", "Feature screens, shell, primitives"],
        ["src/lib/", "30+ modules", "10,930", "Business logic, API clients, engines"],
        ["src/app/api/", "50 routes", "8,693", "REST API endpoints"],
        ["src/components/ui/", "48 components", "~6,000", "shadcn/ui design system"],
        ["src/store/", "1 module", "523", "Zustand global state"],
        ["src/hooks/", "2 modules", "353", "Custom React hooks"],
        ["football-prediction-mega/", "29 Python files", "~4,500", "ML training pipeline"],
    ],
    col_ratios=[0.28, 0.18, 0.12, 0.42],
))
story.append(caption("Table 2: Codebase structure and size"))

story.extend(h2("2.3 Data Providers and Integration"))
story.append(body(
    "ELASTICO integrates six external data providers, each serving a distinct role in the data pipeline. "
    "ESPN provides the primary match, team, and standings data through public API endpoints, and serves as "
    "the most reliable source for team logos and league badges. football-data.org offers structured match and "
    "competition data with a configured API key. TheSportsDB supplements with player images, team badges, "
    "and player biographical data. The Odds API delivers pre-match and live betting odds for the prediction "
    "engine and Kelly Criterion calculations. Understat provides expected goals (xG) data for tactical analysis, "
    "though as of the Cycle 4.5 verification, the getTeamData and getMatchData endpoints return HTTP 404, "
    "blocking the entire xG pipeline. Newsdata.io is intended to supply football news articles, but its API key "
    "is unconfigured, preventing any news data from being synced."
))
story.append(Spacer(1, 6))
story.append(body(
    "A canonical entity resolution system (CanonicalTeam + SourceIdentity models in Prisma) was designed to "
    "unify team identities across these providers. However, this system has never been populated in the production "
    "database because the API-Sports sync (which triggers entity resolution) has never completed successfully "
    "due to the missing API_SPORTS_KEY. Currently, 670 teams exist in the database, but zero have been linked "
    "through the canonical entity model. Asset resolution for team crests, player headshots, and national flags "
    "follows a priority chain defined in DS-011 through DS-017, with ESPN logos preferred for crests, TheSportsDB "
    "cutouts for headshots, and flagcdn.com for national flags, all with graceful fallbacks."
))

story.extend(h2("2.4 Database Schema"))
story.append(body(
    "The Prisma schema defines 23 models covering the full domain: Team, Match, Player, Standing, Prediction, "
    "TeamAnalytic, OddsSnapshot, NewsArticle, SyncLog, User, Session, Announcement, FeatureFlag, Bookmark, "
    "Achievement, UserAchievement, Notification, Subscription, CanonicalTeam, SourceIdentity, and provider-"
    "specific models. The Match model supports full provenance tracking for xG data with homeXg, awayXg, "
    "homeXgSource, awayXgSource, homeXgTruthClass, and awayXgSource fields. The TeamAnalytic model supports "
    "truthClass (REAL, DERIVED, SIMULATION, DEMO), dataFreshness classification (FRESH, CURRENT, SEASON, "
    "STALE), and source tracking. Currently, the database holds 670 teams, 27 matches, 192 standings rows, "
    "15 sync logs, and zero rows in TeamAnalytic, Player, OddsSnapshot, and NewsArticle tables."
))

# ══════════════════════════════════════════════════════════════════════
# 3. DESIGN SYSTEM AND UI/UX
# ══════════════════════════════════════════════════════════════════════
story.extend(h1("3. Design System and UI/UX"))

story.extend(h2("3.1 Design Tokens and Foundation"))
story.append(body(
    "The design system is codified in <b>src/lib/design-system.ts</b> as the single source of truth, eliminating "
    "magic numbers scattered across 26 views. It defines a 10-level typography scale (display through monoSm), "
    "a 4px-base spacing system with 7 named presets (xs through 2xl), a 4-level surface hierarchy (base "
    "through sunken), and 8 size presets for assets (xs=16px through 3xl=64px). All chart theming is unified "
    "through <b>src/lib/chart-theme.ts</b>, which provides consistent axisProps, cartesianGridProps, "
    "tooltipContentStyle, and a cycling 8-color palette (DS-006, DS-007). Match status rendering follows a "
    "5-state model (live, halftime, finished, upcoming, postponed) with specific color, background, border, "
    "and pulse configurations (DS-008). Form colors follow universal football conventions: W=emerald, "
    "D=amber, L=red (DS-009). Data classification uses 5 badges (REAL, DERIVED, SIMULATION, DEMO, BUG) "
    "enforcing the data honesty principle across all views (DS-010)."
))

story.extend(h2("3.2 Navigation and Shell"))
story.append(body(
    "The sidebar navigation is organized by football workflow rather than technical category (DS-022): "
    "Intelligence (Dashboard, Live Matches, Match Analysis), Analysis (Tactical, Players, Compare, "
    "Predictions, Prediction Engine), Leagues (Standings, Leaderboard), Tools (AI Chat, News, Export, Social), "
    "and System (Settings, Notifications, Subscription, Admin, System Monitor, Achievements). All 22 views are "
    "mapped in the sidebar with no orphaned screens. The command palette (Cmd+K) covers all 19 navigable "
    "views, grouped by workflow when no search query is active. The header was stripped to a minimal context bar, "
    "removing zoom controls and plan badge (DS-028), and view titles were standardized (e.g., match-detail became Match Analysis, tournament became Standings). Keyboard shortcuts were realigned: Cmd+T opens Tactical, Cmd+S opens Standings."
))

story.extend(h2("3.3 Design Decision Audit"))
story.append(body(
    "Over 14 development phases, 67 formal design decisions (DS-001 through DS-067) were recorded in the "
    "living DESIGN_STATE.md document. These decisions span five major categories: Design System Foundation "
    "(DS-001 to DS-010, 10 decisions covering tokens, typography, spacing, surfaces, charts, colors, status, "
    "form colors, data classification), Asset System (DS-011 to DS-021, 11 decisions covering resolution priority "
    "chains, caching, fallbacks, and the no-raw-img rule), Shell/Navigation Redesign (DS-022 to DS-038e, 17 "
    "decisions covering workflow groups, header minimalism, command palette, grid alignment, and footer data "
    "credits), Dashboard and Feature Screen Rebuilds (DS-039 to DS-062, 24 decisions covering component "
    "compliance, chart theme enforcement, data classification badges, and zero-fabrication rules), and Data-Truth "
    "Audit (DS-063 to DS-067, 5 decisions covering error logging, fabricated default removal, and null-coalescing "
    "fixes). Each decision records the component or area affected, the specific choice made, and the rationale."
))

story.extend(h2("3.4 Data Honesty and Zero-Fabrication"))
story.append(body(
    "A core architectural principle, enforced through Phase 14, is that the UI must never present fabricated "
    "data as real. This was implemented through three major changes. First, 20 silent catch blocks across 9 views "
    "were converted to log console.error or console.warn (DS-065), ensuring errors reach the debugging surface "
    "rather than being silently swallowed. Second, fabricated defaults were removed from admin-view: the old "
    "code used || 28 for proCount, || 12 for eliteCount, and || 24 for matches, which presented fake numbers "
    "as real metrics (DS-066). Third, 25 instances of || 0 were replaced with ?? 0 (for mathematical operations) "
    "or ?? '--' (for display) across admin, player, and system-monitor views (DS-067), preventing falsy values "
    "like empty strings from masquerading as zero. The data classification badge system (DS-010, DS-061) now "
    "covers predictions, tournament, leaderboard, and prediction-engine views, with every data-displaying view "
    "showing REAL, DERIVED, SIMULATION, or DEMO badges alongside its metrics."
))

# ══════════════════════════════════════════════════════════════════════
# 4. MACHINE LEARNING PIPELINE
# ══════════════════════════════════════════════════════════════════════
story.extend(h1("4. Machine Learning Pipeline"))

story.extend(h2("4.1 Training Data"))
story.append(body(
    "The ML pipeline operates on a processed dataset of 7,537 football matches stored in both CSV (5.4 MB) "
    "and Parquet (1.6 MB) formats. The data was prepared through a multi-phase pipeline: Phase 2 established "
    "the data foundation with quality checks, Phase 2.5 added a validation gate, and Phase 3.5 subjected the "
    "pipeline to stress testing. The feature schema is defined in football-prediction-mega/src/ml/features.py, "
    "covering match-level features (home/away team statistics, form, league position) and engineered features "
    "derived from historical performance data. The training pipeline (training_pipeline.py) handles data splitting, "
    "feature engineering, and model training orchestration."
))

story.extend(h2("4.2 Model Architecture and Performance"))
story.append(body(
    "The prediction system employs an ensemble approach combining multiple model architectures. The primary "
    "model is XGBoost (xgboost_engine.py), trained on the full feature set with three-class classification "
    "(Home Win, Draw, Away Win). On the training set (3,657 samples), XGBoost achieves 85.7% accuracy with "
    "macro F1 of 0.858, but validation performance (1,219 samples) drops to 50.9% accuracy with macro F1 of "
    "0.465, indicating significant overfitting. The Expected Calibration Error (ECE) on validation is 0.040, "
    "suggesting reasonable probability calibration despite the accuracy gap. The LSTM engine (lstm_engine.py) "
    "processes sequential match data using sliding windows (build_sequences.py), with LSTM metrics recorded "
    "in phase4_lstm_metrics.json. The ensemble engine (ensemble.py) combines XGBoost and LSTM predictions "
    "using weighted averaging, with the stochastic engine adding controlled randomness for Monte Carlo "
    "uncertainty estimation."
))
story.append(Spacer(1, 6))
story.append(make_table(
    ["Model", "Split", "Accuracy", "Macro F1", "ECE"],
    [
        ["XGBoost", "Train (n=3,657)", "85.7%", "0.858", "0.192"],
        ["XGBoost", "Validation (n=1,219)", "50.9%", "0.465", "0.040"],
        ["LSTM", "See phase4_lstm_metrics.json", "--", "--", "--"],
        ["Ensemble", "Weighted average", "--", "--", "--"],
    ],
    col_ratios=[0.15, 0.30, 0.15, 0.15, 0.15],
))
story.append(caption("Table 3: ML model performance summary"))

story.extend(h2("4.3 Kelly Criterion and Market Integration"))
story.append(body(
    "The prediction engine includes a Kelly Criterion implementation (kelly.py) that calculates optimal "
    "stake sizes based on model-predicted probabilities and available market odds. The market signals engine "
    "(market_signals.py) detects value bets by comparing model probabilities against bookmaker odds, "
    "identifying situations where the model believes the market has mispriced a match outcome. The frontend "
    "prediction-engine view provides interactive simulation controls, Kelly fraction visualization, and a "
    "comparison of model vs. market probabilities. The calibration analysis (Phase 5) produced calibration "
    "metrics and reliability diagrams (phase5_plots/ directory) to assess how well model probabilities "
    "match actual outcome frequencies across different confidence bins."
))

# ══════════════════════════════════════════════════════════════════════
# 5. DATA INTEGRITY AND VERIFICATION (CYCLE 4.5)
# ══════════════════════════════════════════════════════════════════════
story.extend(h1("5. Data Integrity and Verification"))

story.extend(h2("5.1 Environment Status"))
story.append(body(
    "The Cycle 4.5 verification (August 23, 2026) performed a comprehensive end-to-end audit of the "
    "production environment. Of the four external API keys required, two are configured (FOOTBALL_DATA_API_KEY, "
    "THE_ODDS_API_KEY) and two are empty (API_SPORTS_KEY, NEWSDATA_API_KEY). The database connection is "
    "verified with 670 teams in the database. Understat's getLeagueData endpoint responds with HTTP 200, "
    "confirming basic reachability, though the deeper getTeamData and getMatchData endpoints return 404."
))
story.append(Spacer(1, 6))
story.append(make_table(
    ["Service", "Status", "Impact"],
    [
        ["FOOTBALL_DATA_API_KEY", "CONFIGURED", "Match data operational"],
        ["THE_ODDS_API_KEY", "CONFIGURED", "Odds data operational"],
        ["API_SPORTS_KEY", "NOT CONFIGURED", "Blocks team sync, entity resolution"],
        ["NEWSDATA_API_KEY", "NOT CONFIGURED", "Blocks news sync"],
        ["DATABASE_URL", "CONFIGURED", "670 teams, 27 matches"],
        ["Understat (HTTP 200)", "PARTIAL", "League data works, team/match 404"],
    ],
    col_ratios=[0.25, 0.25, 0.50],
))
story.append(caption("Table 4: External service configuration status"))

story.extend(h2("5.2 Understat xG Pipeline Blocker"))
story.append(body(
    "The most critical finding from the Cycle 4.5 verification is the complete failure of the Understat xG "
    "pipeline. While the getLeagueData endpoint successfully returns 20 Premier League teams for the 2024/25 "
    "season with valid IDs and names, and all three tested teams (Arsenal ID=164, Chelsea ID=167, Liverpool "
    "ID=228) resolved correctly through the entity resolution system, the getTeamData endpoint returns HTTP 404 "
    "for every team ID tested. This means the computeTeamXgFromMatches() function cannot execute, as it "
    "depends on match-level xG data that is only available through this failed endpoint. The getPlayersStats "
    "POST endpoint does work (e.g., Salah xG=27.71), but the current pipeline architecture does not use "
    "player-level xG for team-level computation, making this a new development task rather than a quick fix."
))
story.append(Spacer(1, 6))
story.append(body(
    "The downstream consequences are severe: zero TeamAnalytic rows exist in the database, zero matches "
    "have real xG values (10 matches have xG=0 from demo/seeded data with null provenance), and the "
    "canonical entity model (CanonicalTeam + SourceIdentity tables) remains completely empty because entity "
    "resolution depends on API-Sports sync, which cannot proceed without an API key. The tactical view, "
    "match detail view, and compare view all have xG display logic, but every xG value shown is either 0 (from "
    "demo data) or '--' (from null), never a real Understat-sourced value."
))

story.extend(h2("5.3 UI Data Handling Issues"))
story.append(body(
    "The Cycle 4.5 verification identified eight specific locations where the UI silently transforms null/missing "
    "xG data into displayed zero values, creating a fabrication risk. In match-detail-view.tsx, six instances "
    "of 'homeXg ?? 0' and 'awayXg ?? 0' cause the xG timeline chart to display a flat line at 0 and the match "
    "header to show 'xG 0.0' when no xG data exists, which a user could reasonably interpret as real data. In "
    "tactical-view.tsx, two instances of 'xgPerGame ?? 0' display '0.00' instead of '--' or 'MISSING' when team "
    "xG data is unavailable. These are not fabrications in the sense of generating fake data, but they represent "
    "a form of silent data falsification: the UI displays 'xG 0.0' when the truthful state is 'xG MISSING'. The "
    "compare view correctly uses '?? null' and displays '--' with a clear 'No xG data available' message, "
    "serving as the reference implementation for proper null handling."
))

story.extend(h2("5.4 Database State Summary"))
story.append(body(
    "The production database contains 670 teams, 27 matches (10 demo/unknown source with xG=0 defaults, 17 "
    "from API-Sports with null xG), 192 standings rows, 15 sync logs, and zero rows in Player, TeamAnalytic, "
    "OddsSnapshot, and NewsArticle tables. All unique constraints are enforced with zero duplicates. The zero "
    "Player rows reflect the fact that API-Sports player sync has never completed. The zero OddsSnapshot rows "
    "indicate that The Odds API sync has never been triggered despite the key being configured. The 15 sync "
    "logs document attempted synchronization runs, with the most recent ones reflecting the Understat 404 errors."
))

# ══════════════════════════════════════════════════════════════════════
# 6. FEATURE INVENTORY
# ══════════════════════════════════════════════════════════════════════
story.extend(h1("6. Feature Inventory"))
story.append(body(
    "ELASTICO provides 21 distinct feature views organized into five workflow groups. Each view is a "
    "self-contained React component that fetches its own data through dedicated API routes. The Intelligence "
    "group (Dashboard, Live Matches, Match Analysis) forms the core match-day workflow, providing at-a-glance "
    "KPIs, a live match ticker, clickable match cards, and a detailed match analysis screen with xG timelines, "
    "team statistics, and possession charts. The Analysis group (Tactical Board, Players, Compare, Predictions, "
    "Prediction Engine) supports deep-dive investigation with tactical formations, player profiles and headshots, "
    "side-by-side team comparison, prediction history tracking, and an interactive Kelly Criterion simulator."
))
story.append(Spacer(1, 6))
story.append(body(
    "The Leagues group (Standings, Leaderboard) provides competition-wide context with league tables and "
    "user prediction rankings. The Tools group (AI Chat, News, Export, Social) offers an AI-powered football "
    "assistant, a news feed with category filtering, CSV/PDF data export, and social features. The System group "
    "(Settings, Notifications, Subscription, Admin, System Monitor, Achievements) handles application management "
    "with user preferences, notification center, subscription tiers, admin user management with RBAC, real-time "
    "system health monitoring, and a gamification system. The dashboard was redesigned in the most recent cycle "
    "as a command center with a KPI strip, live ticker, and asymmetric 2:1 split layout featuring a primary match "
    "panel and a compact news rail."
))

# ══════════════════════════════════════════════════════════════════════
# 7. KNOWN ISSUES AND BLOCKERS
# ══════════════════════════════════════════════════════════════════════
story.extend(h1("7. Known Issues and Blockers"))

story.extend(h2("7.1 Critical Blockers"))
story.append(body(
    "The following issues are classified as blockers because they prevent core functionality from operating. "
    "Each blocker has a clear root cause and requires specific external action or development work to resolve."
))
story.append(Spacer(1, 6))
story.append(make_table(
    ["ID", "Issue", "Root Cause", "Resolution Required"],
    [
        ["B1", "No real xG data", "Understat getTeamData 404", "New xG source or API fix"],
        ["B2", "No entity resolution", "API_SPORTS_KEY empty", "Configure API-Sports key"],
        ["B3", "No news data", "NEWSDATA_API_KEY empty", "Configure Newsdata.io key"],
        ["B4", "No odds snapshots", "Sync never triggered", "Implement odds sync cron"],
    ],
    col_ratios=[0.06, 0.22, 0.28, 0.44],
))
story.append(caption("Table 5: Critical blockers"))

story.extend(h2("7.2 UI Data Display Issues"))
story.append(body(
    "Eight locations in the codebase silently transform null xG data into zero, which misleads users into "
    "believing real data exists. These should be changed to display '--' or a 'No data' indicator consistent "
    "with the compare view's implementation. Additionally, 10 demo matches from the 'unknown' source have "
    "explicit xG=0 values with null provenance fields (homeXgSource, awayXgSource, homeXgTruthClass, "
    "awayXgTruthClass all null), which should be cleaned to either null xG or properly tagged as DEMO data."
))

story.extend(h2("7.3 ML Pipeline Overfitting"))
story.append(body(
    "The XGBoost model exhibits significant overfitting: training accuracy of 85.7% drops to 50.9% on "
    "validation (a 34.8 percentage-point gap). The macro F1 drops from 0.858 to 0.465. This suggests the model "
    "is memorizing training patterns rather than learning generalizable features. Potential mitigations include "
    "increased regularization (max_depth reduction, min_child_weight increase), feature selection to reduce "
    "dimensionality, cross-validated hyperparameter tuning, and incorporating domain-specific features that "
    "capture more fundamental aspects of football match outcomes rather than surface-level statistics."
))

# ══════════════════════════════════════════════════════════════════════
# 8. RECOMMENDATIONS
# ══════════════════════════════════════════════════════════════════════
story.extend(h1("8. Recommendations"))

story.extend(h2("8.1 Immediate (Unblock Data Pipeline)"))
story.append(bullet(
    "<b>Configure API_SPORTS_KEY:</b> This single action unblocks team/player sync, canonical entity resolution, "
    "and the entire data provenance chain. Without it, the 670 teams in the database cannot be linked to their "
    "identities across providers."
))
story.append(bullet(
    "<b>Configure NEWSDATA_API_KEY:</b> Restores the news pipeline, which provides contextual match previews "
    "and editorial content for the dashboard news rail and dedicated news view."
))
story.append(bullet(
    "<b>Fix Understat xG pipeline or find alternative source:</b> The getTeamData 404 may be a temporary API "
    "change or a permanent deprecation. Investigate whether the playersStats endpoint can be aggregated for "
    "team-level xG, or evaluate alternative xG providers (e.g., FotMob, Sofascore, xG by Opta via fbref scraping)."
))
story.append(bullet(
    "<b>Implement odds sync cron job:</b> The Odds API key is configured but the sync has never been triggered. "
    "A scheduled job should fetch pre-match odds for upcoming fixtures and store them as OddsSnapshot rows."
))

story.extend(h2("8.2 Short-Term (Data Quality)"))
story.append(bullet(
    "<b>Fix 8 null-to-zero xG transforms:</b> Replace '?? 0' with '?? null' in match-detail-view.tsx (6 locations) "
    "and tactical-view.tsx (2 locations), then display '--' when null, consistent with the compare view."
))
story.append(bullet(
    "<b>Clean demo match xG data:</b> Set xG to null for the 10 'unknown' source matches that have explicit 0 "
    "values, and add proper truthClass=DEMO tagging."
))
story.append(bullet(
    "<b>Populate canonical entity model:</b> Once API_Sports sync is operational, run the entity resolution "
    "pipeline to link all 670 teams across providers. This enables accurate cross-provider data merging."
))

story.extend(h2("8.3 Medium-Term (ML Improvement)"))
story.append(bullet(
    "<b>Address XGBoost overfitting:</b> Implement cross-validated hyperparameter search with reduced max_depth "
    "(try 3-5 instead of default 6), increased min_child_weight, and L1/L2 regularization. Target a validation "
    "accuracy above 55% with a train-validation gap below 15 percentage points."
))
story.append(bullet(
    "<b>Add feature importance analysis:</b> Use SHAP values to identify which features drive predictions and "
    "remove noise features that contribute to overfitting."
))
story.append(bullet(
    "<b>Explore alternative xG sources for model features:</b> Once real xG data flows into the database, "
    "retrain models with xG-based features which are more predictive than raw goal statistics."
))

# ══════════════════════════════════════════════════════════════════════
# 9. BUILD AND DEPLOYMENT
# ══════════════════════════════════════════════════════════════════════
story.extend(h1("9. Build and Deployment"))
story.append(body(
    "The production build uses Next.js standalone output mode, generating 33 static pages and 51 API "
    "routes. The build completes in approximately 22.6 seconds with zero TypeScript errors, zero schema "
    "errors, and zero import errors. The application deploys to Vercel with environment variables for database "
    "connection, API keys, and auth secrets. The most recent commit (1c2e341) fixed match analysis navigation "
    "by adding the fd: prefix to football-data.org IDs and redesigned the dashboard as a command center. "
    "The build has been verified to pass after each of the 14 development phases, with the design system "
    "compliance changes (DS-055 through DS-067) maintaining the zero-error build standard throughout."
))
story.append(Spacer(1, 6))
story.append(body(
    "The deployment configuration includes a Caddyfile for reverse proxy, a docker-compose.yml for containerized "
    "development, and a Vercel configuration for production. The PWA manifest and service worker (sw.js) "
    "are present in the public directory, indicating planned offline/mobile support. Security verification "
    "confirmed that no API key values are exposed in client-side code; only key names appear in settings and "
    "system monitor documentation text."
))

# ══════════════════════════════════════════════════════════════════════
# 10. CONCLUSION
# ══════════════════════════════════════════════════════════════════════
story.extend(h1("10. Conclusion"))
story.append(body(
    "ELASTICO represents a substantial engineering achievement: a full-stack football analytics platform with "
    "41,769 lines of TypeScript, 50 API routes, 21 feature views, a Python ML pipeline with multiple model "
    "architectures, and a rigorously documented design system with 67 formal decisions. The codebase quality is "
    "high, with zero TypeScript errors, zero type-unsafe casts in views, unified chart theming, consistent data "
    "classification badges, and a strict no-fabrication principle enforced through dedicated audit phases."
))
story.append(Spacer(1, 6))
story.append(body(
    "However, the platform's analytical value is fundamentally constrained by the data pipeline blockers identified "
    "in Cycle 4.5. Without real xG data, the tactical analysis, match detail, and prediction features operate on "
    "empty or demo data. Without API-Sports sync, the canonical entity model remains unpopulated, preventing "
    "accurate cross-provider data merging. The ML models show promising calibration (ECE 0.040) but suffer from "
    "significant overfitting that limits real-world predictive value. Addressing these blockers, particularly the xG "
    "data source and API key configuration, should be the immediate priority to unlock the platform's full potential."
))


# ─── Build ───
doc.multiBuild(story, onFirstPage=on_first_page, onLaterPages=on_page)
print(f"Body PDF generated: {OUTPUT_PDF}")
