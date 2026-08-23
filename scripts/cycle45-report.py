#!/usr/bin/env python3
"""ELASTICO Cycle 4.5 Data Population Verification Report"""

import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# Font setup
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')

pdfmetrics.registerFont(TTFont('Inter', f'{FONT_DIR}/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Inter-Bold', f'{FONT_DIR}/truetype/liberation/LiberationSans-Bold.ttf'))

# Colors
C_BG = HexColor('#f1f2f2')
C_PRIMARY = HexColor('#1c1e1f')
C_ACCENT = HexColor('#1b6d97')
C_ERROR = HexColor('#94524c')
C_SUCCESS = HexColor('#3c7d52')
C_WARNING = HexColor('#9f844e')
C_MUTED = HexColor('#7f8689')
C_BORDER = HexColor('#b9c5cb')
C_HEADER = HexColor('#4a636f')

OUTPUT = '/home/z/my-project/download/ELASTICO-Cycle-4.5-Verification-Report.pdf'

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=20*mm, rightMargin=20*mm,
    topMargin=25*mm, bottomMargin=20*mm,
)

W = A4[0] - 40*mm  # content width

# Styles
styles = getSampleStyleSheet()

title_style = ParagraphStyle('Title', parent=styles['Title'],
    fontName='NotoSerifSC-Bold', fontSize=28, leading=34,
    textColor=C_PRIMARY, spaceAfter=4*mm, alignment=TA_LEFT)

subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'],
    fontName='Inter', fontSize=12, leading=16,
    textColor=C_MUTED, spaceAfter=8*mm)

h1_style = ParagraphStyle('H1', parent=styles['Heading1'],
    fontName='NotoSerifSC-Bold', fontSize=16, leading=22,
    textColor=C_ACCENT, spaceBefore=8*mm, spaceAfter=3*mm,
    borderWidth=0, borderPadding=0)

h2_style = ParagraphStyle('H2', parent=styles['Heading2'],
    fontName='NotoSerifSC-Bold', fontSize=12, leading=16,
    textColor=C_PRIMARY, spaceBefore=5*mm, spaceAfter=2*mm)

body_style = ParagraphStyle('Body', parent=styles['Normal'],
    fontName='Inter', fontSize=9.5, leading=14,
    textColor=C_PRIMARY, spaceAfter=2*mm, alignment=TA_JUSTIFY)

mono_style = ParagraphStyle('Mono', parent=styles['Normal'],
    fontName='Inter', fontSize=8.5, leading=12,
    textColor=C_PRIMARY, backColor=HexColor('#f7f8f8'),
    borderWidth=0.5, borderColor=C_BORDER, borderPadding=6,
    spaceAfter=2*mm)

label_style = ParagraphStyle('Label', parent=styles['Normal'],
    fontName='Inter', fontSize=8.5, leading=12,
    textColor=C_MUTED, spaceAfter=1*mm)

result_pass = ParagraphStyle('Pass', parent=styles['Normal'],
    fontName='Inter-Bold', fontSize=9, leading=13,
    textColor=C_SUCCESS, spaceAfter=1*mm)

result_fail = ParagraphStyle('Fail', parent=styles['Normal'],
    fontName='Inter-Bold', fontSize=9, leading=13,
    textColor=C_ERROR, spaceAfter=1*mm)

result_warn = ParagraphStyle('Warn', parent=styles['Normal'],
    fontName='Inter-Bold', fontSize=9, leading=13,
    textColor=C_WARNING, spaceAfter=1*mm)

# Helper functions
def h1(text):
    return Paragraph(text, h1_style)

def h2(text):
    return Paragraph(text, h2_style)

def body(text):
    return Paragraph(text, body_style)

def label(text):
    return Paragraph(text, label_style)

def pass_msg(text):
    return Paragraph('PASS: ' + text, result_pass)

def fail_msg(text):
    return Paragraph('FAIL: ' + text, result_fail)

def warn_msg(text):
    return Paragraph('WARN: ' + text, result_warn)

def code(text):
    return Paragraph(text.replace('<', '&lt;').replace('>', '&gt;'), mono_style)

def divider():
    return HRFlowable(width='100%', thickness=0.5, color=C_BORDER, spaceBefore=3*mm, spaceAfter=3*mm)

def kv_table(data, col_widths=None):
    if col_widths is None:
        col_widths = [W*0.35, W*0.65]
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (0,-1), 'Inter-Bold'),
        ('FONTNAME', (1,0), (1,-1), 'Inter'),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('LEADING', (0,0), (-1,-1), 12),
        ('TEXTCOLOR', (0,0), (0,-1), C_MUTED),
        ('TEXTCOLOR', (1,0), (1,-1), C_PRIMARY),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LINEBELOW', (0,0), (-1,-2), 0.3, C_BORDER),
    ]))
    return t

# Build story
story = []

# ═══════ COVER PAGE ═══════
story.append(Spacer(1, 80*mm))
story.append(Paragraph('ELASTICO', ParagraphStyle('CoverPre', parent=title_style, fontSize=14, textColor=C_MUTED, spaceAfter=2*mm)))
story.append(Paragraph('Cycle 4.5', ParagraphStyle('CoverTitle', parent=title_style, fontSize=36, leading=42, textColor=C_ACCENT)))
story.append(Paragraph('Data Population and<br/>End-to-End Verification', ParagraphStyle('CoverSub', parent=title_style, fontSize=18, leading=24, textColor=C_PRIMARY, spaceAfter=8*mm)))
story.append(divider())
story.append(Paragraph('2026-08-23', label_style))
story.append(Paragraph('Internal Technical Report', label_style))
story.append(Paragraph('STOP CONDITION: BLOCKER IDENTIFIED', ParagraphStyle('Blocker', parent=label_style, textColor=C_ERROR, fontName='Inter-Bold', fontSize=10)))
story.append(PageBreak())

# ═══════ 1. ENVIRONMENT ═══════
story.append(h1('1. Environment'))
story.append(body(
    'Environment verification confirms which external services are configured and reachable. '
    'No actual key values are exposed in this report. The checks below were performed by '
    'testing for the presence of non-empty environment variables (for API keys) and '
    'HTTP reachability (for Understat).'
))
story.append(kv_table([
    ['FOOTBALL_DATA_API_KEY', 'CONFIGURED'],
    ['THE_ODDS_API_KEY', 'CONFIGURED'],
    ['API_SPORTS_KEY', 'NOT CONFIGURED (empty value in .env)'],
    ['NEWSDATA_API_KEY', 'NOT CONFIGURED (empty value in .env)'],
    ['DATABASE_URL', 'CONFIGURED'],
    ['DIRECT_URL', 'CONFIGURED'],
    ['UNDERSTAT (understat.com)', 'AVAILABLE (HTTP 200, ~2s response)'],
]))
story.append(Spacer(1, 2*mm))
story.append(fail_msg('API_SPORTS_KEY is empty. API-Sports sync has never completed successfully.'))
story.append(fail_msg('NEWSDATA_API_KEY is empty. News sync cannot function.'))
story.append(pass_msg('DATABASE_URL and DIRECT_URL are configured and connection verified (670 teams in DB).'))
story.append(pass_msg('Understat getLeagueData endpoint responds with HTTP 200.'))

# ═══════ 2. UNDERSTAT SYNC ═══════
story.append(h1('2. Understat Sync'))
story.append(body(
    'A controlled sync test was performed targeting the Premier League (EPL) for the 2024 season. '
    'The test followed the exact code path used by the production cron sync: fetch league teams, '
    'resolve to DB entities, then fetch match-level xG data to compute per-game averages.'
))
story.append(h2('2.1 League Team Fetch'))
story.append(pass_msg('getLeagueData/EPL/2024 returned 20 teams with valid IDs and names.'))
story.append(body(
    'All 20 Premier League teams for the 2024/25 season were returned successfully. '
    'Team IDs ranged from 71 (Aston Villa) to 285 (Ipswich). Notable: short_title field is empty '
    'for all teams, indicating the new API returns only basic identity data.'
))
story.append(h2('2.2 Entity Resolution'))
story.append(pass_msg('First 3 teams resolved via EXACT name match to API-Sports teams in DB.'))
story.append(body(
    'The DB contains 23 PL teams (primarily from API-Sports). The entity resolution system correctly '
    'matched "Aston Villa", "Everton", and "Bournemouth" via exact case-insensitive name matching. '
    'The alias table and normalized matching paths are available for teams with name discrepancies '
    '(e.g., "Brighton" to "Brighton and Hove Albion").'
))
story.append(h2('2.3 Match-Level xG Fetch (BLOCKER)'))
story.append(fail_msg('getTeamData/{id}/2024 returns HTTP 404 for ALL tested team IDs.'))
story.append(fail_msg('getMatchData/{id} returns HTTP 404 for ALL tested match IDs.'))
story.append(body(
    'This is the critical blocker. After the successful getLeagueData call, all subsequent requests '
    'to getTeamData and getMatchData return 404 (serving HTML error pages instead of JSON). '
    'This was tested with multiple team IDs (71, 83, 87), multiple match IDs (53002), '
    'with and without delays between requests, and with different Referer headers. '
    'The endpoints consistently return 404.'
))
story.append(body(
    'The getTeamData endpoint is the only source of match-level xG data in the Understat '
    'integration. Without it, computeTeamXgFromMatches() cannot function. The pipeline '
    'cannot produce team-level xG per game or match-level homeXg/awayXg values.'
))
story.append(h2('2.4 Player Stats Endpoint (Partial Success)'))
story.append(warn_msg('POST /main/getPlayersStats/ works and returns real player xG data (e.g., Salah xG=27.71).'))
story.append(body(
    'The player stats POST endpoint is the only Understat endpoint that currently returns xG data. '
    'It provides player-level xG, xA, xGChain, and xGBuildup aggregated by season. However, the '
    'current pipeline architecture does not use this endpoint for team-level xG computation. '
    'Aggregating player xG by team would be a new development task.'
))
story.append(kv_table([
    ['Teams Requested', '20 (EPL 2024)'],
    ['Teams Resolved (first 3 tested)', '3 (all EXACT)'],
    ['Teams Unresolved', '0 (in tested sample)'],
    ['Matches Fetched', '0 (endpoint 404)'],
    ['Matches with xG', '0 (endpoint 404)'],
    ['TeamAnalytic Rows Created', '0'],
    ['Errors', 'getTeamData HTTP 404, getMatchData HTTP 404'],
    ['Elapsed Time', '7,244ms'],
]))

# ═══════ 3. CANONICAL ENTITY RESOLUTION ═══════
story.append(h1('3. Canonical Entity Resolution'))
story.append(body(
    'The canonical entity model (CanonicalTeam + SourceIdentity) exists in the Prisma schema and '
    'has corresponding build/link logic in canonical-entity.ts. However, the model has never been '
    'populated in the production database.'
))
story.append(fail_msg('CanonicalTeam count: 0 (table is empty)'))
story.append(fail_msg('SourceIdentity count: 0 (table is empty)'))
story.append(body(
    'The buildCanonicalEntities() function is called during the cron sync (step 2.5, after API-Sports '
    'team sync). However, because API-Sports sync has never completed successfully (API_SPORTS_KEY is empty), '
    'no teams from the primary data source exist to canonicalize. The ESPN-sourced teams (which do exist) '
    'have never been through the canonicalization process because the sync always times out before reaching '
    'the canonical build step.'
))
story.append(body(
    'The sync log analysis confirms this: all 15 recorded syncs are ESPN-only (standings and fixtures). '
    'No API-Sports, canonical, or Understat sync operations have ever logged a successful completion. '
    'Three syncs recorded "partial" status with the error "approaching Vercel timeout, stopping early".'
))
story.append(kv_table([
    ['Canonical Teams Created', '0'],
    ['Source Identities Created', '0'],
    ['Teams Linked', '0'],
    ['Teams Unresolved', 'N/A (no sync attempted)'],
    ['Potential Duplicate Identities', '0 (no data to duplicate)'],
    ['Existing Teams in DB', '670 (23 PL, mostly ESPN-sourced)'],
]))

# ═══════ 4. REAL xG VERIFICATION ═══════
story.append(h1('4. Real xG Verification'))
story.append(body(
    'TeamAnalytic rows are the primary storage location for team-level xG data sourced from Understat. '
    'The schema supports truthClass, dataFreshness, sourceTeamId, sourceTeamName, and canonicalTeamId '
    'fields for full provenance tracking.'
))
story.append(fail_msg('Total TeamAnalytic rows: 0'))
story.append(fail_msg('Understat-sourced analytics: 0'))
story.append(fail_msg('No TeamAnalytic rows exist to verify truthClass, source, or numerical values.'))
story.append(body(
    'The expected state for genuine Understat data is truthClass=REAL, source=UNDERSTAT, with numerical '
    'xgPerGame and xgaPerGame values derived from match-level data. However, since the Understat '
    'getTeamData endpoint returns 404, no xG data has ever been computed or persisted. The pipeline '
    'has never progressed past the entity resolution step.'
))

# ═══════ 5. MATCH xG VERIFICATION ═══════
story.append(h1('5. Match xG Verification'))
story.append(body(
    'The Match model has homeXg, awayXg, homeXgSource, awayXgSource, homeXgTruthClass, and awayXgTruthClass '
    'fields. These are designed to store per-match xG with full provenance. The verification checked '
    'all 27 matches in the database.'
))
story.append(fail_msg('10 matches have homeXg/awayXg not null, but ALL have xG=0 with null source/truthClass.'))
story.append(fail_msg('0 matches have xG > 0.'))
story.append(fail_msg('0 matches have homeXgSource or awayXgSource set.'))
story.append(body(
    'The 10 matches with non-null xG values are all from source="unknown" with xG=0. These appear to be '
    'demo/simulated data that was seeded with default zero values. They represent future World Cup 2026 '
    'matches (Canada vs Mexico, Germany vs USA, etc.) with no real xG data. The remaining 17 matches '
    'from source="api-sports" correctly have null xG values.'
))
story.append(body(
    'The presence of xG=0 (rather than null) in the "unknown" source matches is itself a concern. '
    'Zero is a valid xG value that could be confused with real data. The expected state for missing '
    'data is null, not 0. This suggests the demo data was created with explicit zero values rather '
    'than leaving the fields null.'
))

# ═══════ 6. API VERIFICATION ═══════
story.append(h1('6. API Verification'))
story.append(body(
    'The /api/teams endpoint includes xG provenance fields when serving from the database. It includes '
    'xgPerGame, xgaPerGame, npxGPerGame, xgTruthClass, xgSource, xgFreshness, and xgSyncedAt for each '
    'team, sourced from the most recent Understat TeamAnalytic row. This is correctly implemented.'
))
story.append(pass_msg('/api/teams returns provenance fields (xgTruthClass, xgSource, xgFreshness, xgSyncedAt).'))
story.append(body(
    'The /api/matches/[id] endpoint also includes homeXg, awayXg, homeXgSource, awayXgSource, '
    'homeXgTruthClass, and awayXgTruthClass in its response. Additionally, it fetches Understat TeamAnalytic '
    'data for both the home and away teams and includes xgPerGame, xgaPerGame, xgTruthClass, xgSource, '
    'and xgFreshness on the nested team objects. When falling back to ESPN live data, it correctly '
    'labels xgTruthClass as "MISSING" and sets xgPerGame/xgaPerGame to null.'
))
story.append(pass_msg('/api/matches/[id] returns match-level xG provenance (homeXgSource, homeXgTruthClass).'))
story.append(pass_msg('/api/matches/[id] returns team-level xG analytics from Understat TeamAnalytic.'))
story.append(pass_msg('ESPN fallback correctly labels xG as MISSING (not 0) when no DB data exists.'))

# ═══════ 7. UI VERIFICATION ═══════
story.append(h1('7. UI Verification'))
story.append(body(
    'The UI components were inspected for proper handling of null/missing xG data and correct display '
    'of truth class and source information. The compare view and match detail view were the primary '
    'focus, as these are the two components identified in the data flow chain.'
))
story.append(h2('7.1 Compare View'))
story.append(pass_msg('Compare view uses "?? null" for xG data (does not transform null to 0).'))
story.append(pass_msg('Compare view displays truthClass badges (REAL in green, non-REAL in yellow, MISSING suppressed).'))
story.append(pass_msg('Null xG values display as "--" with a clear "No xG data available" message.'))
story.append(h2('7.2 Match Detail View'))
story.append(fail_msg('Match detail uses "?? 0" in 6 locations, silently transforming MISSING xG to 0.'))
story.append(body(
    'Lines 207-208: hXg = match.homeXg ?? 0 and aXg = match.awayXg ?? 0. These variables are used '
    'for the share text and the cumulative xG timeline chart. When xG is null (MISSING), the chart '
    'would display a flat line at 0 rather than showing "no data".'
))
story.append(body(
    'Lines 411, 416: xG {(match.homeXg ?? 0).toFixed(1)} and xG {(match.awayXg ?? 0).toFixed(1)}. '
    'These display "xG 0.0" in the match score header when no xG data exists. A user would see "xG 0.0" '
    'and might reasonably assume this is real data, when it is actually MISSING.'
))
story.append(h2('7.3 Tactical View'))
story.append(fail_msg('Tactical view uses "(xgPerGame ?? 0).toFixed(2)" in 2 locations (lines 411, 418).'))
story.append(body(
    'When team xG data is MISSING, the tactical view displays "0.00" instead of "--" or "MISSING". '
    'This is the same class of bug as the match detail view.'
))

# ═══════ 8. ZERO FABRICATION TEST ═══════
story.append(h1('8. Zero-Fabrication Test'))
story.append(body(
    'A comprehensive search was performed across all source files for patterns indicating fabricated, '
    'hardcoded, or proxy xG data. The following patterns were searched: "shots_on_target * 0.1", '
    '"Math.random()", hardcoded xG values (1.5, 1.3, 1.45, 1.10), "default xG", "fake xG", '
    '"demo xG", "proxy xG", and "hardcoded xG".'
))
story.append(pass_msg('No "shots_on_target * 0.1" patterns found in any source file.'))
story.append(pass_msg('No "default xG", "fake xG", "demo xG", or "proxy xG" patterns found.'))
story.append(warn_msg('4 files contain Math.random(): predictions.ts, prediction-engine.ts, sidebar.tsx, simulate route.'))
story.append(body(
    'The Math.random() occurrences in predictions.ts and prediction-engine.ts are used for Monte Carlo '
    'simulation sampling (Poisson random variate generation), which is a legitimate statistical technique. '
    'The sidebar.tsx and simulate route usage should be verified but are likely for UI randomization.'
))
story.append(h2('8.1 Lambda Value Origins'))
story.append(body(
    'The prediction models use hardcoded league-average goal values as lambda parameters. In predictions.ts, '
    'the ELO model uses leagueAvgGoals = 1.35 to map ELO expected scores to goal expectations. In the '
    'Dixon-Coles model, baseHome = 1.35 and baseAway = 1.15 are used as baseline averages. These are '
    'standard football analytics constants representing the long-run average goals per team per match, '
    'not fabricated xG values. They are model parameters, not data claims.'
))
story.append(pass_msg('Lambda values trace to standard league-average constants (1.35 home, 1.15 away), not fabricated xG.'))
story.append(h2('8.2 UI Null-to-Zero Transforms (Fabrication Risk)'))
story.append(fail_msg('6 instances of "xG ?? 0" in match-detail-view.tsx silently transform MISSING to 0.'))
story.append(fail_msg('2 instances of "xgPerGame ?? 0" in tactical-view.tsx silently transform MISSING to 0.'))
story.append(body(
    'While these are not "fabrication" in the sense of generating fake data, they are a form of silent '
    'data falsification: the UI displays "xG 0.0" when the truthful state is "xG MISSING". A user cannot '
    'distinguish between a team that genuinely has 0 xG (extremely rare) and a team for which no xG data '
    'has been sourced. This violates the principle that MISSING should be displayed honestly.'
))

# ═══════ 9. FRESHNESS TEST ═══════
story.append(h1('9. Freshness Test'))
story.append(body(
    'Data freshness classification is implemented in canonical-entity.ts via the classifyFreshness() '
    'function. It categorizes data into FRESH (less than 24 hours), CURRENT (less than 7 days), '
    'SEASON (less than 90 days), and STALE (older than 90 days) based on the syncedAt timestamp.'
))
story.append(body(
    'However, no TeamAnalytic rows exist in the database, so the freshness classification cannot be '
    'verified against actual data. The classifyFreshness function itself has correct logic: it uses '
    'the current time (Date.now()) minus the syncedAt time to compute age in hours, then applies the '
    'thresholds. This would produce accurate freshness labels when data is eventually populated.'
))
story.append(warn_msg('Freshness classification logic is correct but untestable: 0 TeamAnalytic rows exist.'))

# ═══════ 10. FAILURE TEST ═══════
story.append(h1('10. Failure Test'))
story.append(body(
    'The Understat pipeline was tested with an unavailable/error condition (HTTP 404 from getTeamData). '
    'The observed behavior was as follows.'
))
story.append(pass_msg('Understat fetch returns null on HTTP 404 (does not throw or crash).'))
story.append(pass_msg('computeTeamXgFromMatches returns null when no match data is available.'))
story.append(pass_msg('The cron sync catches Understat errors and logs them without crashing.'))
story.append(warn_msg('Existing valid data is not overwritten: no valid data exists to overwrite.'))
story.append(body(
    'The sync code in syncUnderstatAnalytics() checks for null xgData and matchesPlayed === 0, '
    'skipping the upsert entirely. This means failed syncs do not corrupt existing data. However, since '
    'no data has ever been successfully synced, the "do not overwrite valid data" behavior is untested '
    'against a scenario where valid data already exists and a subsequent sync fails.'
))

# ═══════ 11. DATABASE INTEGRITY ═══════
story.append(h1('11. Database Integrity'))
story.append(body(
    'Database integrity checks verify the schema constraints, uniqueness, and referential integrity of the '
    '22 tables in the Prisma schema. The checks were performed via direct database queries.'
))
story.append(kv_table([
    ['Duplicate CanonicalTeams', '0 (unique constraint on displayName+leagueCode holds)'],
    ['Duplicate SourceIdentities', '0 (unique constraint on source+externalId holds)'],
    ['Duplicate Matches (by source+sourceId)', '0 (unique constraint holds)'],
    ['Duplicate Teams (by source+sourceId)', '0 (unique constraint holds)'],
    ['Total Teams', '670'],
    ['Total Matches', '27'],
    ['Total Players', '0'],
    ['Total Standings', '192'],
    ['Total Odds Snapshots', '0'],
    ['Total News Articles', '0'],
    ['Total Sync Logs', '15'],
    ['Total Team Analytics', '0'],
]))
story.append(pass_msg('All unique constraints are enforced. Zero duplicates across all tables.'))
story.append(warn_msg('0 Player rows exist (API-Sports player sync has never completed).'))
story.append(warn_msg('0 OddsSnapshot rows (The Odds API sync has never been triggered).'))
story.append(warn_msg('0 NewsArticle rows (Newsdata.io sync has never been triggered).'))

# ═══════ 12. BUILD ═══════
story.append(h1('12. Build'))
story.append(body(
    'A full production build was executed to verify there are no TypeScript errors, schema errors, or '
    'import errors. The build uses Next.js standalone output mode.'
))
story.append(pass_msg('Build compiled successfully in 22.6 seconds.'))
story.append(pass_msg('33 static pages generated in 170.8ms.'))
story.append(pass_msg('51 API routes compiled (all dynamic).'))
story.append(pass_msg('0 TypeScript errors, 0 schema errors, 0 import errors.'))

# ═══════ 13. SECURITY VERIFICATION ═══════
story.append(h1('13. Security Verification'))
story.append(body(
    'A search was performed across all client-side components (src/components/) for exposed API keys, '
    'key patterns, or credentials. Only environment variable names (not values) were found in documentation '
    'strings within settings-view.tsx and system-monitor-view.tsx. No actual key values reach the frontend.'
))
story.append(pass_msg('No API key values exposed in client-side code.'))
story.append(pass_msg('Only key NAMES appear in UI documentation text (e.g., "set NVIDIA_API_KEY").'))

# ═══════ BLOCKER SUMMARY ═══════
story.append(h1('BLOCKER: Real xG Cannot Be Populated'))
story.append(body(
    'Based on the verification results above, the data flow chain cannot be completed:'
))
story.append(code(
    'Understat getLeagueData  -- WORKS (team names/IDs only, NO xG)\n'
    '       |\n'
    '       v\n'
    'Understat getTeamData   -- FAILS (HTTP 404, ALL team IDs)\n'
    'Understat getMatchData  -- FAILS (HTTP 404, ALL match IDs)\n'
    '       |\n'
    '       v\n'
    'computeTeamXgFromMatches -- CANNOT COMPUTE (no match data)\n'
    '       |\n'
    '       v\n'
    'TeamAnalytic persist    -- NEVER REACHED (no xG to persist)\n'
    '       |\n'
    '       v\n'
    'API response             -- NO REAL xG DATA TO SERVE\n'
    '       |\n'
    '       v\n'
    'UI (Compare/Match Detail) -- DISPLAYS NOTHING OR 0 (not real xG)'
))
story.append(Spacer(1, 3*mm))
story.append(body(
    'The Understat service changed their site architecture (noted in the codebase as "Aug 2025"). '
    'The getTeamData and getMatchData AJAX endpoints that previously provided match-level xG data '
    'now return 404. Only the getLeagueData (team identity only) and main/getPlayersStats (player xG) '
    'endpoints remain functional.'
))
story.append(body(
    'Without match-level xG data, the pipeline cannot produce team-level xG per game or match-level '
    'homeXg/awayXg values. The canonical entity model cannot be verified because the sync that populates '
    'it (buildCanonicalEntities) has never executed successfully.'
))
story.append(body(
    'Additionally, two empty API keys (API_SPORTS_KEY and NEWSDATA_API_KEY) block the primary data '
    'source from functioning. Without API-Sports team data, entity resolution has no reference database '
    'to resolve against, and the canonical entity model cannot be built.'
))

story.append(h2('Per the Cycle 4.5 directive: STOP.'))
story.append(body(
    'Real Understat xG cannot be populated reliably. No data is being fabricated, no proxy xG is being '
    'substituted, and no alternative provider is being silently used. The exact blockers are reported above.'
))

story.append(h2('Issues Found (Separate from Blocker)'))
story.append(body(
    'Beyond the primary blocker, the following issues were discovered during verification that should be '
    'addressed independently:'
))
story.append(kv_table([
    ['UI: match-detail ?? 0', '6 locations transform null xG to 0 (fabrication risk)'],
    ['UI: tactical ?? 0', '2 locations transform null xgPerGame to 0 (fabrication risk)'],
    ['DB: demo matches xG=0', '10 "unknown" source matches have xG=0 with null provenance'],
    ['Keys: API_SPORTS_KEY', 'Empty in .env, blocks all API-Sports sync'],
    ['Keys: NEWSDATA_API_KEY', 'Empty in .env, blocks all News sync'],
    ['Schema: Match.homeXg', 'Defaults to null (correct), but demo data has explicit 0'],
]))

# Build
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
doc.build(story)
print(f'Report generated: {OUTPUT}')
