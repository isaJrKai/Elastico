# ELASTICO — PREDICTION CAPABILITY TRANSFER DIRECTIVE
## GLM 5 Implementation Command

### Mission

You are GLM 5 working inside the existing ELASTICO football intelligence application.

A separate football prediction project was created with GitHub Copilot. It is NOT a second product to merge blindly. Treat it as a **capability reference**.

Your mission is:

> **Study the Copilot project → extract its valuable capabilities → compare them with ELASTICO → adapt only what materially improves ELASTICO → integrate those capabilities into ELASTICO's existing architecture → verify everything.**

**DO NOT BUILD ANOTHER APP. UPGRADE ELASTICO.**

---

## 1. PRESERVE ELASTICO

ELASTICO remains the product, architecture, database authority, UX, and source of truth.

Before changing anything, inspect the existing ELASTICO implementation, especially:

- prediction-engine.ts
- advanced-analytics-engine.ts
- elite-math-engine.ts
- xT engine
- Voronoi engine
- game-state engine
- AI gateway
- prediction/match/odds APIs
- StatsBomb and Understat integrations
- Prisma/PostgreSQL schema
- Dashboard
- Predictions
- Match Analysis
- Live Match
- Player
- Tactical
- Compare
- AI Analyst

Do not assume the Copilot project is better simply because it is newer or separate.

---

## 2. REFERENCE PROJECT

The Copilot project reportedly contains:

### Documentation
- README.md
- CONTRIBUTING.md
- LICENSE

### Configuration
- .env.example
- docker-compose.yml
- Dockerfile
- docker/.dockerignore
- .gitignore
- requirements.txt

### Database
- database/schema.sql
- database/init.sql

Its schema covers concepts such as:
- leagues
- teams
- players
- matches
- statistics
- odds
- predictions
- audit tables

### Backend
- src/main.py
- src/api/app.py
- src/api/routes/predictions.py
- src/api/routes/matches.py
- src/api/routes/stats.py
- src/api/routes/admin.py

### Configuration
- config/settings.py
- config/logger.py

Do not trust the file list alone. **Inspect the actual implementation.**

---

# 3. PHASE 1 — AUDIT THE REFERENCE PROJECT

Before writing integration code, inspect the project completely.

Trace actual implementations of:

- prediction models
- statistical methods
- formulas
- feature engineering
- inputs
- outputs
- probability calculations
- confidence calculations
- simulations
- historical features
- team features
- player features
- odds/market features
- database models
- API contracts
- validation
- evaluation
- backtesting
- calibration
- logging
- external dependencies
- configuration
- error handling

For every meaningful capability determine:

```text
CAPABILITY
PURPOSE
INPUTS
OUTPUTS
METHOD / FORMULA
DATA DEPENDENCIES
IMPLEMENTATION QUALITY
STRENGTHS
WEAKNESSES
ELASTICO EQUIVALENT
ELASTICO GAP
INTEGRATION VALUE
INTEGRATION RISK
RECOMMENDATION
```

---

# 4. PHASE 2 — AUDIT ELASTICO

Determine exactly what ELASTICO already provides.

Create a capability comparison:

```text
REFERENCE PROJECT        ELASTICO
------------------       ------------------
Capability A             Existing / Missing
Capability B             Existing / Better
Capability C             Partial
Capability D             Duplicate
Capability E             Unsupported
```

Do not duplicate capabilities that already exist.

---

# 5. CLASSIFY EVERY CAPABILITY

Every useful capability must be classified as one of:

### A. KEEP ELASTICO
Already equal or better.

### B. IMPROVE ELASTICO
Existing capability can be materially improved using the reference methodology.

### C. ADD TO ELASTICO
Genuinely missing and valuable.

### D. REJECT — DUPLICATE
No meaningful additional value.

### E. REJECT — WEAKER
Reference implementation is inferior.

### F. REJECT — UNSUPPORTED
Requires data ELASTICO does not actually possess.

For F, do not fabricate data.

---

# 6. NO DUPLICATE ENGINES

Do NOT create:

- prediction-engine-v2
- prediction-engine-new
- another xG engine
- another ELO engine
- another simulation engine
- another prediction database
- duplicate APIs
- duplicate authentication
- duplicate user systems

unless a genuine architectural requirement is proven.

The objective is one stronger ELASTICO prediction layer.

---

# 7. ARCHITECTURE PRESERVATION

Preserve ELASTICO's:

- Next.js structure
- React UI
- Zustand state
- Prisma/PostgreSQL
- API conventions
- authentication
- AI gateway
- existing analytical engines
- existing providers
- navigation
- design system

The Copilot project uses Python/FastAPI. **Do not automatically introduce a second Python application.**

If a Python capability is genuinely valuable, evaluate:

1. porting its methodology to the existing ELASTICO stack;
2. creating a clean service boundary;
3. another justified integration approach.

Choose the solution that keeps ELASTICO coherent.

---

# 8. DATABASE

ELASTICO's database remains authoritative.

Do NOT blindly import the reference project's schema.sql or init.sql.

Instead:

1. inspect the reference schema;
2. identify genuinely useful fields/entities;
3. compare them with Prisma;
4. add only necessary changes;
5. use proper Prisma migrations;
6. preserve existing relationships and data;
7. avoid duplicate sources of truth.

Do not create a second PostgreSQL database for prediction.

---

# 9. API

Do not blindly copy the reference project's:

- prediction routes
- match routes
- statistics routes
- admin routes

Map their useful functionality into ELASTICO's existing API conventions.

Existing consumers must continue working.

Any new endpoint must follow ELASTICO's:

- naming
- validation
- authentication
- authorization
- response structure
- error handling

---

# 10. PREDICTION CAPABILITY

Evaluate whether the combined ELASTICO prediction system can meaningfully use:

### Team strength
- ELO
- form
- home/away performance
- scoring/conceding
- opponent strength

### Expected performance
- xG
- xGA
- shot quality
- shot volume
- chance creation

### Tactical
- possession
- pressing
- defensive structure
- spatial dominance
- progression
- tactical matchups

### Player
- availability when real data exists
- injuries/suspensions when real data exists
- minutes
- form
- contribution

### Market
- odds
- implied probabilities
- market movement when real data exists
- value signals where justified

### Simulation
- Monte Carlo/stochastic methods
- scoreline distributions
- outcome probabilities

### Context
- competition
- venue
- schedule
- rest
- environmental factors where real data exists

Every feature requires:

**real source → transformation → rationale → validation**

---

# 11. PREDICTION OUTPUT

Where supported, ELASTICO should represent:

- home probability
- draw probability
- away probability
- expected goals
- likely scorelines
- confidence
- uncertainty
- model agreement/disagreement
- important factors
- risk factors
- market comparison
- value signal where justified
- data freshness
- prediction timestamp
- model/version provenance

Always distinguish:

**prediction ≠ fact**

**confidence ≠ certainty**

---

# 12. MODEL ENSEMBLE

If multiple useful prediction methodologies exist, evaluate whether an ensemble improves performance.

Potential architecture:

```text
MATCH DATA
    ↓
ELO / xG / FORM / OTHER VALID MODELS
    ↓
ENSEMBLE
    ↓
CALIBRATION
    ↓
FINAL PROBABILITIES
    ↓
UNCERTAINTY
    ↓
ELASTICO
```

Do not call something an ensemble unless the models are actually combined.

---

# 13. BACKTESTING & CALIBRATION

If the reference project contains these capabilities, evaluate and integrate only if methodologically sound.

Useful metrics may include:

- log loss
- Brier score
- calibration
- accuracy
- ROI where appropriate
- expected vs actual outcomes
- performance by competition
- performance by market
- historical drift

Never present historical performance as guaranteed future performance.

Never display impressive percentages without sample size, evaluation period, methodology, and leakage controls.

---

# 14. DATA HONESTY

Never fabricate:

- injuries
- statistics
- odds
- xG
- predictions
- historical matches
- tactical events
- spatial coordinates
- confidence
- model accuracy
- market movement
- current season information

If a capability requires unavailable data:

> **Show it as unavailable. Do not invent it.**

Example:

> “Player availability data unavailable for this fixture.”

---

# 15. TEMPORAL TRUTH

Football data changes.

Track where possible:

- data timestamp
- fixture timestamp
- last update
- model version
- prediction timestamp

Do not represent an old prediction as though it incorporated later information.

Current season, competition, fixtures, teams, and standings must come from real data/system context, not stale hardcoding.

---

# 16. UI INTEGRATION

Integrate the capabilities into the existing ELASTICO experience:

- Dashboard
- Predictions
- Match Detail
- Live Match
- Match Analysis
- Compare
- Player
- Tactical
- AI Analyst

Do not create a separate generic prediction dashboard.

The UI should answer:

> **What does ELASTICO predict?**
>
> **Why?**
>
> **How strong is the evidence?**
>
> **What could change the prediction?**

Do not bury useful predictions under decorative charts.

---

# 17. EXPLAINABILITY

For meaningful predictions, expose evidence when supported.

Example:

```text
ELASTICO PREDICTION

Home       61%
Draw       23%
Away       16%

Expected goals:
Home        1.82
Away        0.91

Confidence  Medium-High

Main signals:
+ Home xG advantage
+ Recent defensive performance
+ ELO differential

Risks:
- Player availability unresolved
- Small recent sample
```

Only display fields actually supported by the underlying data.

---

# 18. AI INTEGRATION

Use this architecture:

```text
REAL DATA
   ↓
PREDICTION ENGINE
   ↓
STRUCTURED PREDICTION
   ↓
AI INTERPRETATION
   ↓
USER
```

The AI may explain and contextualize predictions.

It must not invent a different prediction and present it as the engine's output.

---

# 19. MODEL DISAGREEMENT

If models materially disagree, preserve the disagreement when useful.

Example:

> “The statistical model favors Arsenal, while the market model is less confident.”

Only explain the cause when actual model outputs support it.

---

# 20. SECURITY

Do not weaken ELASTICO security.

Never commit:
- API keys
- passwords
- tokens
- private keys

Review reference admin routes before adapting them.

---

# 21. PERFORMANCE

Do not move expensive prediction calculations unnecessarily into the client.

Evaluate:

- caching
- server-side calculation
- precomputation
- asynchronous jobs
- memoization
- persistence

Do not introduce unnecessary UI latency.

---

# 22. PROVENANCE & OBSERVABILITY

Where practical, retain:

- model version
- feature/input snapshot
- prediction timestamp
- source data timestamp
- outcome
- evaluation metrics
- error information

ELASTICO should eventually be able to answer:

> “Why did we make this prediction?”

and:

> “How did that prediction perform?”

---

# 23. DO NOT REDESIGN ELASTICO

This task is a **capability transfer**, not a visual rebuild.

Do not replace ELASTICO's established design system.

Do not create generic AI dashboard patterns.

Use the existing ELASTICO product philosophy and visual language.

---

# 24. EXECUTION ORDER

Follow this order exactly:

### STEP 1
Inspect the reference project completely.

### STEP 2
Inspect ELASTICO's current prediction/data architecture.

### STEP 3
Create the capability matrix.

### STEP 4
Identify duplicates.

### STEP 5
Identify genuine improvements.

### STEP 6
Identify missing high-value capabilities.

### STEP 7
Design the smallest coherent integration architecture.

### STEP 8
Implement only the highest-value integrations.

### STEP 9
Run type checking.

### STEP 10
Run linting.

### STEP 11
Run tests.

### STEP 12
Run production build.

### STEP 13
Inspect affected UI.

### STEP 14
Verify existing ELASTICO functionality was not broken.

### STEP 15
Document what was transferred, improved, rejected, and why.

---

# 25. DEFINITION OF DONE

Complete only when:

- reference capabilities have been audited;
- duplicates are avoided;
- valuable capabilities are integrated;
- ELASTICO remains one coherent application;
- existing engines continue working;
- existing predictions continue working;
- database integrity is preserved;
- APIs remain coherent;
- predictions use real data;
- unsupported capabilities remain unavailable;
- prediction provenance exists where appropriate;
- type checking/lint/tests/build have been run;
- UI exposes useful prediction intelligence;
- no fake statistics were introduced;
- no secrets were introduced;
- the integration is documented.

---

# FINAL COMMAND

You are NOT merging two products.

You are performing:

**STUDY → COMPARE → SELECT → ADAPT → INTEGRATE → VERIFY**

The Copilot project is the **source of potentially useful capabilities**.

ELASTICO is the **destination product**.

Do not copy blindly.
Do not duplicate.
Do not replace working ELASTICO systems without evidence.
Do not fabricate unsupported data.
Do not rebuild the application.

**Upgrade ELASTICO.**
