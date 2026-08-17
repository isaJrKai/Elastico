# Task 6: Data Source Integration Services

## Summary
Created 5 files in `src/services/` providing data source integration for the football prediction mega project.

## Files Created

### 1. `src/services/__init__.py` (empty)
Package marker.

### 2. `src/services/espn_service.py` — ESPN API Client
- **Class**: `ESPNService`
- **Endpoints**: League scoreboard, team info, league news
- **`fetch_league_scores(league_code)`**: Fetches scores for a single league via ESPN public API
- **`fetch_all_league_scores(leagues)`**: Concurrent fetch across multiple leagues using `asyncio.gather`
- **`fetch_team_info(league_code, team_id)`**: Detailed team info including record, venue, logo
- **`fetch_league_news(league_code, limit)`**: News articles with headlines, images, URLs
- **`normalize_match(event, league_code)`**: Converts ESPN's nested event format to flat dict: `{id, home_team, away_team, home_score, away_score, status, date, venue, competition, minute, home_abbr, away_abbr}`
- Supports 11 leagues (PL, La Liga, Serie A, Bundesliga, Ligue 1, UCL, + 2nd divisions)
- Status mapping from ESPN types to normalized statuses
- Async context manager support

### 3. `src/services/api_football_service.py` — API-Football v3 Client
- **Class**: `APIFootballService`
- **Auth**: `x-apisports-key` header
- **`fetch_fixtures(league_id, season, status)`**: Fixtures with full score breakdown (HT, FT, ET, penalties)
- **`fetch_fixture_statistics(fixture_id)`**: In-match stats (possession, shots, corners, etc.)
- **`fetch_odds(fixture_id)`**: Pre-match odds from multiple bookmakers, h2h market flattened
- **`fetch_predictions(fixture_id)`**: API-Football's own predictions with comparison data
- **`fetch_team_statistics(team_id, league_id, season)`**: Comprehensive team stats (W/D/L, goals for/against, clean sheets, form, lineups, cards, streaks)
- **`fetch_head_to_head(team_a, team_b, limit)`**: H2H fixtures
- **`_safe_stat_value()`**: Handles mixed-type stat values ("62%" → 62, "12'" → 12)
- Rate limit detection via response headers

### 4. `src/services/odds_service.py` — The Odds API Client
- **Class**: `OddsService`
- **`fetch_odds(sport, markets, regions)`**: Current odds with quota tracking
- **`fetch_historical_odds(sport, fixture_id, markets)`**: Historical odds snapshots
- **`normalize_market_odds(odds_data)`**: Extracts best odds across bookmakers for h2h/spreads/totals
- **`compute_market_signals(opening, current)`**: Detects steam moves, RLM, and sharp action by comparing opening vs current odds
- Label normalisation for bookmaker-specific h2h labels

### 5. `src/services/csv_ingestion.py` — Football-data.co.uk CSV Loader
- **Class**: `CSVIngestionService`
- **16 leagues** mapped from football-data.co.uk codes (E0, SP1, I1, D1, F1, etc.)
- **`load_league_season(league_code, season)`**: Loads specific CSV with flexible season format matching
- **`load_all_available()`**: Scans directory, loads and concatenates all CSVs
- **`normalize_dataframe(df, league_code)`**: Date parsing (dd/mm/yyyy + fallback), numeric coercion, odds float parsing, result encoding (H→0, D→1, A→2)
- **`to_match_dicts(df)`**: Converts to list of JSON-serializable dicts for ML pipeline
- **`compute_team_stats(df, window=10)`**: Rolling stats per team — form string, points avg, goals for/against avg, shot accuracy, clean sheet %, win/loss/unbeaten streaks, home/away splits
- Handles encoding issues (utf-8-sig → latin-1 fallback)
- 9 odds provider preferences (Pinnacle > Bet365 > Betway > ...)

## Technical Notes
- All services use `httpx.AsyncClient` for non-blocking I/O
- All services implement async context managers (`__aenter__`/`__aexit__`)
- Error handling: all API calls return empty results on failure (never raise)
- Logging via project's `config.logger` pattern
- All files pass `ast.parse()` syntax validation
