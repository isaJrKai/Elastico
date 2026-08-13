# ELASTICO — UX / UI PHILOSOPHY & VISUAL EXECUTION DIRECTIVE

## COMMAND

**BUILD THE EXPERIENCE, NOT THE MOCKUP.**

Claude has built and repaired the intelligence foundation. Your responsibility is now to turn that intelligence into a serious, coherent, premium football product.

Do not rebuild the backend. Do not replace the existing single-shell architecture. Do not invent data.

Your job is:

- UX architecture
- information hierarchy
- navigation
- button organization
- interaction design
- visual hierarchy
- spacing
- typography
- responsive behavior
- data visualization
- asset sourcing
- motion
- composition
- visual identity
- product psychology

---

# 1. WHAT ELASTICO IS

ELASTICO is a **football intelligence workstation**.

It is not:

- a generic SaaS dashboard
- an AI chatbot with football colors
- a fantasy football website
- an admin panel
- a collection of cards
- a collection of charts
- an "AI-generated dashboard"

It should feel like a place where a serious football analyst could spend hours.

The feeling should be:

**precise · calm · fast · intelligent · spatial · football-native · premium · purposeful**

The intelligence should be felt through the quality of the experience rather than repeatedly advertised as "AI".

---

# 2. THE ANTI-AI-GENERATED-DESIGN RULE

AI-generated interfaces often have:

- cards everywhere
- identical rounded rectangles
- gradients for no reason
- glowing borders
- excessive neon
- giant headings
- too many badges
- random statistics
- charts with no purpose
- icons beside everything
- excessive pills
- "AI Insight" boxes everywhere
- five equally important buttons
- symmetrical layouts everywhere
- fake-looking avatars
- fake-looking logos
- placeholder content
- decorative empty space
- animations without purpose

**ELASTICO must deliberately avoid this.**

For every element ask:

> Why is this here?
> Why is it this size?
> Why is it positioned here?
> Why does it appear before that information?
> What does the user gain from seeing it?

If there is no strong answer, remove it.

---

# 3. DESIGN FOR HUMAN THINKING

Do not start by asking how many cards a page needs.

Ask what the user is trying to understand.

The core ELASTICO cognitive flow is:

```text
WHERE AM I?
      ↓
WHAT IS HAPPENING?
      ↓
WHAT MATTERS?
      ↓
WHY IS IT HAPPENING?
      ↓
WHAT EVIDENCE SUPPORTS IT?
      ↓
WHAT CAN I DO NEXT?
```

Every major screen should support this progression.

---

# 4. INFORMATION HIERARCHY

Every screen needs:

### Orientation
Where am I? What entity? What state? What time/context?

### Primary information
The single most important thing.

### Supporting evidence
Metrics, charts, events, tactical information, model factors.

### Exploration
Secondary information for deeper investigation.

### Actions
Actions placed where they become useful, not dumped at the top.

Never make every section visually equal.

---

# 5. BUTTON PSYCHOLOGY

Every screen gets:

### One primary action

Then secondary actions.

Example:

```text
Arsenal vs Chelsea

[ Analyse Match ]     ← primary

Add prediction
Compare teams
Explore tactics
Share
```

Do not make five buttons equally bright.

Button labels should describe outcomes:

- Analyse Match
- Compare Players
- View Full Analysis
- Explore Tactics
- Run Simulation
- Open Prediction
- View Match

Avoid vague labels such as:

- Go
- Continue
- Submit
- More
- AI

Icons should improve recognition, not decorate empty space.

---

# 6. NAVIGATION PSYCHOLOGY

Preserve the existing single-shell structure:

```text
page.tsx
   ↓
Zustand currentView
   ↓
ELASTICO views
```

Do not convert it into route-per-page architecture as part of this redesign.

The navigation should feel like an analytical workspace, not an administration menu.

The user should think:

> I want to see what is happening.

Then:

> I want to understand this match.

Then:

> I want to understand this player.

Then:

> I want to investigate a prediction.

Group and order navigation according to the user's mental model, not according to the order in which components happened to be written.

---

# 7. THE DASHBOARD IS A COMMAND CENTER

The dashboard answers:

> **What matters right now?**

Prioritize:

1. Live football
2. Upcoming matches
3. Important current intelligence
4. Current model/prediction information
5. Recent results/performance
6. Deeper analysis

Do not summarize every database table.

A useful conceptual composition:

```text
┌───────────────────────────────────────────────────────────────┐
│ ELASTICO     Dashboard                         Time / Status │
├───────────┬───────────────────────────────────────────────────┤
│           │ CURRENT FOOTBALL STATE                            │
│           ├───────────────────────────────────────────────────┤
│ NAV       │ LIVE / UPCOMING MATCHES                           │
│           ├───────────────────────────┬───────────────────────┤
│           │ PRIMARY ANALYTICAL AREA   │ MODEL / INSIGHT       │
│           ├───────────────────────────┴───────────────────────┤
│           │ SUPPORTING ANALYTICS                              │
│           ├──────────────────────┬────────────────────────────┤
│           │ PLAYERS / TRENDS     │ TABLE / RECENT ACTIVITY   │
└───────────┴──────────────────────┴────────────────────────────┘
```

This is a composition principle, not a requirement to literally draw these boxes.

---

# 8. STOP MAKING EVERYTHING A CARD

Use a card only when a boundary improves comprehension.

Sometimes a divider is enough.

Sometimes whitespace is enough.

Sometimes several analytical elements should belong to one continuous surface.

Avoid:

```text
CARD
CARD
CARD
CARD
CARD
```

Prefer:

```text
ANALYTICAL SURFACE
   ├── primary evidence
   ├── supporting evidence
   └── contextual evidence
```

The product should feel spatially composed rather than assembled from components.

---

# 9. SPATIAL DESIGN LANGUAGE

Use architectural principles:

- flow
- continuity
- movement
- asymmetry
- geometry
- proportion
- negative space
- layering
- rhythm
- controlled tension

Do not literally copy an architect's style.

A large analytical surface can anchor a page.

A narrow model panel can sit beside it.

A lower evidence strip can span the workspace.

A player list can be compact.

The page should have rhythm rather than a perfectly symmetrical grid.

Never sacrifice usability for asymmetry.

---

# 10. NEGATIVE SPACE

Do not fill every pixel.

Spacing communicates hierarchy:

- large gap = new conceptual section
- medium gap = related group
- small gap = tightly related information

Do not use identical spacing everywhere.

---

# 11. TYPOGRAPHY

Typography should establish hierarchy without shouting.

Use:

- restrained headings
- readable body text
- compact analytical labels
- highly legible numbers
- tabular/monospaced treatment where useful for data
- restrained uppercase labels

Do not make everything bold.

Do not make every heading enormous.

Numbers are important because ELASTICO is analytical.

---

# 12. COLOR

Use a restrained premium dark foundation.

Color should primarily communicate:

- state
- hierarchy
- selection
- positive/negative movement
- team identity
- model confidence
- live status

Do not use neon everywhere.

Do not make every border glow.

If everything is highlighted, nothing is highlighted.

---

# 13. LIVE / CURRENT / HISTORICAL

ELASTICO has both memory and a present.

Make these visually distinct:

### LIVE
Happening now.

### UPCOMING
Scheduled.

### RECENT
Recently completed.

### HISTORICAL
Past context.

Completed World Cup data can remain valuable historical data.

It must never silently become today's football.

---

# 14. CHARTS MUST ANSWER QUESTIONS

Never add a chart merely because analytics products have charts.

Every visualization must answer a question.

Bad:

> Performance

with a random line.

Good:

> Chance Creation

showing meaningful xG/shot-quality information.

Good:

> Spatial Dominance

only when genuine spatial data exists.

Good:

> Why did the model move?

only if real model-history data exists.

A visualization without a question is decoration.

---

# 15. DATA VISUALIZATION

Prefer:

- direct labels
- useful annotations
- restrained grids
- clear axes
- contextual legends
- meaningful hover states
- comparisons
- changes over time

Avoid:

- decorative 3D charts
- meaningless gauges
- unnecessary rings
- excessive chart chrome
- charts where colors are the only distinction

The visualization must help the analyst think.

---

# 16. AI SHOULD LIVE INSIDE THE ANALYSIS

Do not put:

> AI INSIGHT

on every page.

Instead use contextual analytical language.

Example:

### MODEL INTERPRETATION

> Arsenal's probability increased from 54% to 61%. The largest contribution came from attacking efficiency and home advantage.

Then:

**Why?**

[View model factors]

That feels like analysis, not marketing.

Do not invent explainability when the underlying engine cannot support it.

---

# 17. UNCERTAINTY IS A FEATURE

A serious intelligence product does not pretend to know everything.

If data is unavailable:

> Data unavailable for this match.

If spatial data is unavailable:

> Spatial data not available for this match.

If there is no prediction:

> No prediction yet.

If the provider is stale:

> Data delayed.

Design these states beautifully.

Never fill missing information with fake numbers.

---

# 18. REAL ASSETS ARE PART OF THE DESIGN

This is non-negotiable.

Do not use generic circles where real assets exist.

Use legitimate real assets for:

- team crests
- player headshots
- country flags
- competition logos
- news imagery where appropriate

Build an asset-resolution layer instead of hardcoding image URLs inside components.

Conceptually:

```text
Entity
   ↓
Verified provider image
   ↓
Local cached asset where licensing permits
   ↓
Professional fallback
```

Prefer:

- assets already supplied by ELASTICO's real data providers
- properly licensed/open-source assets
- maintained local assets where licensing permits
- established flag libraries for country flags

Do not scrape arbitrary copyrighted images merely because a search engine can find them.

Do not use AI-generated faces to represent real players.

If no legitimate image exists, use:

- initials
- verified crest
- neutral silhouette
- competition mark
- verified flag where nationality is known

A professional fallback is better than a fake photograph.

---

# 19. COUNTRY FLAGS

Do not use emoji flags.

Use a consistent real flag-asset system.

Do not mix different flag styles or proportions.

If nationality is unavailable, do not guess.

---

# 20. PLAYER HEADSHOTS

If an upstream provider legitimately exposes a player image:

- use it
- normalize its rendering
- preserve aspect ratio
- crop consistently
- lazy-load it
- provide a fallback

Never fabricate a real player's face.

Never use a random person.

---

# 21. TEAM CRESTS

Team crests are strong visual anchors.

Use verified provider/team assets.

Normalize:

- dimensions
- visual padding
- aspect ratio
- background treatment

Never stretch a crest.

---

# 22. CENTRALIZE ASSET RESOLUTION

Do not repeatedly write:

```tsx
<img src="random-url" />
```

Use functions/components conceptually like:

```text
resolveTeamLogo(team)
resolvePlayerImage(player)
resolveCountryFlag(country)
resolveCompetitionLogo(competition)
```

The UI asks for an asset.

The asset layer decides where it comes from.

---

# 23. PLAYER PAGE = PLAYER DOSSIER

The player screen should feel like opening a dossier.

Concept:

```text
PLAYER IDENTITY
photo / name / position / team / nationality
        ↓
CURRENT PERFORMANCE
        ↓
KEY METRICS
        ↓
SHOOTING / PASSING / PROGRESSION
        ↓
TACTICAL ROLE
        ↓
COMPARISON
        ↓
MATCH HISTORY
```

Never fill unavailable FIFA-style attributes with random values.

If an attribute is not a real ELASTICO metric:

- derive it from a legitimate documented engine, or
- omit it.

---

# 24. MATCH PAGE = LIVE ANALYTICAL ROOM

Hierarchy:

```text
MATCH IDENTITY
      ↓
CURRENT MATCH STATE
      ↓
SCORE / TIME
      ↓
PRIMARY LIVE ANALYSIS
      ↓
TACTICAL / STATISTICAL EVIDENCE
      ↓
MODEL INTERPRETATION
      ↓
EVENTS / PLAYERS / DEEP ANALYSIS
```

Possible modes:

- Overview
- Match Stats
- xG
- Tactical
- Players
- Events
- Prediction

Do not show every analytical layer simultaneously.

---

# 25. TACTICAL PAGE = SPATIAL LABORATORY

The pitch should be the analytical surface.

Where real data supports it, visualize:

- spatial dominance
- shot locations
- passing
- zones
- team shape
- player influence
- xT
- Voronoi-derived space

Never add fake dots just to make a pitch look populated.

Real spatial data:

```text
real source
   ↓
real coordinates
   ↓
normalized pitch
   ↓
visualization
```

No spatial data:

> Spatial data unavailable for this match.

---

# 26. PREDICTIONS = DECISION ENVIRONMENT

Immediately communicate:

- match
- model
- probabilities
- confidence
- generation time
- data freshness
- match state
- outcome if completed

Do not make the page look like a casino.

ELASTICO is analytical.

---

# 27. COMPARE = MAKE DIFFERENCES OBVIOUS

Align comparable metrics.

Example:

```text
                 PLAYER A       PLAYER B
Goals               18             15
xG                  14.2           16.1
xT                   7.8            9.2
Progressive         ...            ...
```

Do not force users to jump between separate cards to compare values.

---

# 28. SETTINGS = QUIET UTILITY

Settings should be:

- calm
- organized
- compact
- predictable
- functional

Do not make Settings look like the dashboard.

---

# 29. LAPTOP-FIRST DESIGN

The critical desktop target is:

**1366 × 768**

Also test:

```text
1280 × 720
1366 × 768
1440 × 900
1536 × 864
1920 × 1080
1024 × 768
768
430
390
375
320
```

At 1366×768:

- navigation remains usable
- primary information is visible
- important controls are reachable
- typography remains readable
- the screen is not crushed
- the user does not need to zoom out

Do not design for a giant monitor and then shrink everything.

---

# 30. RESPONSIVE INTEGRITY

No:

- accidental horizontal scrolling
- clipped cards
- charts escaping containers
- buttons disappearing
- dropdowns cut off
- modals extending beyond viewport
- fixed navigation covering content
- microscopic controls

Use `min-width: 0` where needed.

Tables may intentionally scroll.

The page itself must not overflow horizontally.

Do not solve layout problems with blanket `overflow-x: hidden`.

Fix the actual layout.

---

# 31. MOTION

Motion communicates:

- change
- transition
- causality
- live state
- hierarchy
- feedback

Good:

- probability transitions
- live event arrival
- selected-tab movement
- subtle chart reveal
- meaningful page transitions

Bad:

- floating cards
- perpetual glowing animations
- decorative particles
- bouncing icons
- animated gradients everywhere

If motion does not improve comprehension, remove it.

---

# 32. LOADING

Do not fake loading.

Use structural skeletons matching the eventual layout.

Do not show a full-page spinner when only one dataset is loading.

---

# 33. EMPTY STATES

Every empty state should communicate:

1. what is missing
2. why, when useful
3. what the user can do next

Example:

> **No live matches**
>
> There are no matches currently in progress.
>
> [View upcoming matches]

Not merely:

> No data.

---

# 34. ERROR STATES

Errors should be calm and actionable.

Example:

> **Live data temporarily unavailable**
>
> The football data provider did not return a current update.
>
> Last verified update: 2 minutes ago.
>
> [Retry]

Never fabricate replacement values.

---

# 35. REFERENCE IMAGES

The supplied visual references are the authority for:

- composition
- density
- hierarchy
- spacing
- typography direction
- chart treatment
- image usage
- interaction patterns
- overall visual quality

They are NOT the authority for:

- actual players
- actual matches
- scores
- predictions
- standings
- xG
- statistics

Do not copy sample numbers or sample entities from the reference.

Translate the visual idea into real ELASTICO data.

---

# 36. THE VISUAL TARGET

The final application should have the visual quality of the supplied references:

- premium dark analytical environment
- restrained accent colors
- crisp typography
- real team crests
- real player imagery
- meaningful football context
- large primary analytical regions
- compact supporting metrics
- clear match state
- sophisticated charts
- tactical pitch visualization
- strong whitespace
- controlled asymmetry
- quiet navigation
- visible hierarchy
- laptop-friendly density
- polished interactions

**Do not merely copy colors. Reproduce the quality of composition.**

---

# 37. DO NOT MAKE EVERY SCREEN LOOK THE SAME

Each view has a different job.

### Dashboard
Command center.

### Live Match
Deep analytical workspace.

### Player
Player dossier.

### Predictions
Decision environment.

### Tactical
Spatial laboratory.

### Compare
Analytical comparison.

### AI Analyst
Reasoning interface.

### Settings
Quiet utility.

Same DNA.

Different hierarchy.

---

# 38. DESIGN THE SECOND LOOK

A strong screen works at multiple depths.

### First look
Understand the situation.

### Second look
Discover supporting intelligence.

### Third look
Investigate underlying evidence.

Example:

First look:

> Arsenal 1 — 0 Chelsea  
> 68'  
> Arsenal 61% win probability

Second look:

> xG difference  
> shot quality  
> spatial dominance  
> model factors

Third look:

> event-level analysis

Complexity should become discoverable, not overwhelming.

---

# 39. MICROCOPY

Use concise human language.

Prefer:

> Model confidence

not:

> AI-powered predictive confidence score

Prefer:

> Updated 18s ago

not:

> Real-time AI data synchronization active

Prefer:

> No prediction yet

not:

> AI prediction engine has not generated a prediction at this time

Avoid marketing language inside the product.

---

# 40. PERFORMANCE

Premium does not mean heavy.

Use where appropriate:

- lazy loading
- dynamic imports
- image optimization
- memoization
- efficient charts
- minimal rerenders
- loading expensive analytics only when needed

The first screen should feel fast.

---

# 41. DO NOT CHANGE REAL BUSINESS LOGIC FOR VISUAL REASONS

If a visual reference wants a metric that does not exist:

**Do not invent it.**

If the metric exists:

**Wire it.**

If the metric exists but current data is unavailable:

**Show an elegant unavailable state.**

A component that looks better with a fake number is a broken component.

---

# 42. FOR EVERY VIEW, DEFINE THIS BEFORE IMPLEMENTING

```text
PURPOSE
PRIMARY USER
PRIMARY QUESTION
PRIMARY INFORMATION
PRIMARY ACTION
SECONDARY ACTIONS
DATA SOURCES
LOADING STATE
EMPTY STATE
ERROR STATE
RESPONSIVE BEHAVIOR
IMAGE / ASSET REQUIREMENTS
KEY INTERACTIONS
```

If these cannot be answered, the screen is not ready.

---

# 43. IMPLEMENTATION ORDER

```text
1. AUDIT EXISTING UI
2. ESTABLISH DESIGN SYSTEM
3. FIX GLOBAL SHELL / NAVIGATION
4. ESTABLISH LAPTOP-FIRST GRID
5. DASHBOARD
6. LIVE / MATCH EXPERIENCE
7. PLAYER EXPERIENCE
8. TACTICAL EXPERIENCE
9. PREDICTIONS
10. COMPARE
11. AI ANALYST
12. SECONDARY VIEWS
13. RESPONSIVE REFINEMENT
14. MOTION / MICRO-INTERACTIONS
15. VISUAL QA
16. DATA-INTEGRITY QA
```

Do not polish a broken hierarchy.

---

# 44. QUALITY BAR

Before declaring a screen complete:

### UX
- Can I understand it in 2–3 seconds?
- Do I know where I am?
- Do I know what matters?
- Do I know what I can do?
- Is the primary action obvious?

### Visual
- Does the composition feel intentional?
- Is there enough negative space?
- Are there too many cards?
- Are too many elements competing?
- Does it feel premium without being flashy?

### Data
- Is every number real?
- Is every image legitimate?
- Is current information actually current?
- Are historical and live states distinguished?

### Technical
- Does it fit 1366×768?
- Does it work at 1280×720?
- Does it work on mobile?
- Are charts constrained?
- Are controls reachable?
- Are images optimized?

### Product
- Would a football analyst want to return?
- Does the interface make analysis easier?
- Does it feel like ELASTICO rather than a template?

---

# 45. FINAL STANDARD

**ELASTICO should be recognizable without its logo.**

Not because of a gradient.

Not because of neon borders.

Not because of an "AI" badge.

Because of its:

**composition  
hierarchy  
spacing  
typography  
football intelligence  
visual restraint  
interaction quality  
and confidence.**

## FINAL COMMAND

**BUILD ELASTICO AS A REAL PRODUCT.**

Claude built the intelligence.

Now reveal it.

Use the supplied visual references as the target for quality.

Use real data.

Use real assets where legitimately available.

Design beautiful states for what is unavailable.

Think like a senior product designer, information architect, interaction designer, visual designer, football analyst, and frontend engineer simultaneously.

The final reaction should be:

> **"This is a serious football intelligence product."**

Never:

> **"An AI made this dashboard."**
