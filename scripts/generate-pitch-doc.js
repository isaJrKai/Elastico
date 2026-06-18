const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, HeadingLevel,
        Header, Footer, PageNumber, BorderStyle, Table, TableRow, TableCell,
        WidthType, ShadingType, PageBreak } = require("docx");
const fs = require("fs");

const P = { primary: "#00e676", dark: "#0a0a0a", body: "#1a1a2e", accent: "#00c853", white: "#ffffff" };
const c = (hex) => hex.replace("#", "");

// Load screenshots
const shots = {
  dashboard: fs.readFileSync("/home/z/my-project/download/elastico-dashboard.png"),
  aiChat: fs.readFileSync("/home/z/my-project/download/elastico-ai-chat.png"),
  standings: fs.readFileSync("/home/z/my-project/download/elastico-standings.png"),
  matches: fs.readFileSync("/home/z/my-project/download/elastico-matches.png"),
  news: fs.readFileSync("/home/z/my-project/download/elastico-news.png"),
  engine: fs.readFileSync("/home/z/my-project/download/elastico-prediction-engine.png"),
};

function spacer(pts = 120) {
  return new Paragraph({ spacing: { before: pts, after: 0 }, children: [] });
}

function bodyText(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 160, line: 312 },
    children: [new TextRun({ text, size: 22, color: c("#333333"), font: { name: "Calibri" }, ...opts })],
  });
}

function bulletPoint(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 80, line: 300 },
    indent: { left: 360 },
    children: [
      new TextRun({ text: "\u2022  ", size: 22, color: c(P.accent), font: { name: "Calibri" } }),
      new TextRun({ text, size: 22, color: c("#333333"), font: { name: "Calibri" } }),
    ],
  });
}

function screenshotImage(buffer, w = 580, h = 320) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [
      new ImageRun({ data: buffer, transformation: { width: w, height: h }, type: "png" }),
    ],
  });
}

function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text, size: 18, color: c("#888888"), font: { name: "Calibri" }, italics: true })],
  });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, size: 26, bold: true, color: c(P.dark), font: { name: "Calibri" } })],
  });
}

// Build the document
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { name: "Calibri" }, size: 22, color: c("#333333") },
        paragraph: { spacing: { line: 312 } },
      },
    },
  },
  sections: [
    // ── COVER PAGE ─────────────────────────────────────────────
    {
      properties: {
        page: {
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
          size: { width: 11906, height: 16838 },
        },
      },
      children: [
        // Green accent bar at top
        new Table({
          rows: [new TableRow({
            height: { value: 600, rule: "exact" },
            children: [new TableCell({
              width: { size: 11906, type: WidthType.DXA },
              shading: { fill: c(P.accent), type: ShadingType.CLEAR },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              children: [new Paragraph({ children: [] })],
            })],
          })],
          width: { size: 11906, type: WidthType.DXA },
        }),
        spacer(2400),
        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "ELASTICO", size: 72, bold: true, color: c(P.accent), font: { name: "Calibri" } })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: "AI-POWERED FOOTBALL ANALYTICS PLATFORM", size: 24, color: c("#666666"), font: { name: "Calibri" }, characterSpacing: 200 })],
        }),
        spacer(400),
        // Subtitle
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: "Partnership Proposal for Betika Uganda", size: 28, color: c(P.dark), font: { name: "Calibri" } })],
        }),
        spacer(200),
        // Date
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "June 2026", size: 22, color: c("#999999"), font: { name: "Calibri" } })],
        }),
        spacer(1600),
        // Bottom bar
        new Table({
          rows: [new TableRow({
            height: { value: 400, rule: "exact" },
            children: [new TableCell({
              width: { size: 11906, type: WidthType.DXA },
              shading: { fill: c("#f0f0f0"), type: ShadingType.CLEAR },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "Confidential  |  elastico-elastico.vercel.app", size: 18, color: c("#999999"), font: { name: "Calibri" } })],
              })],
            })],
          })],
          width: { size: 11906, type: WidthType.DXA },
        }),
      ],
    },

    // ── EMAIL BODY ─────────────────────────────────────────────
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1200, left: 1440, right: 1440 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "ELASTICO  |  Confidential Partnership Proposal  |  ", size: 16, color: c("#999999"), font: { name: "Calibri" } }),
                       new TextRun({ children: [PageNumber.CURRENT], size: 16, color: c("#999999"), font: { name: "Calibri" } })],
          })],
        }),
      },
      children: [
        // Subject line
        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({ text: "Subject: ", size: 22, bold: true, color: c("#333333"), font: { name: "Calibri" } }),
            new TextRun({ text: "Partnership Opportunity \u2014 AI-Powered Football Analytics for Betika Uganda", size: 22, color: c("#333333"), font: { name: "Calibri" } }),
          ],
        }),
        spacer(120),

        // Dear...
        bodyText("Dear Betika Partnerships Team,"),
        spacer(60),

        bodyText("My name is [Your Name], and I am the founder of ELASTICO, a fully operational AI-powered football analytics platform. I am reaching out to propose a strategic partnership that would give Betika Uganda a significant competitive edge in the sports betting market by integrating professional-grade predictive analytics directly into your platform."),
        spacer(100),

        // ── WHAT IS ELASTICO ──
        sectionHeading("What is ELASTICO?"),
        bodyText("ELASTICO is a comprehensive football intelligence platform that combines real-time data feeds, advanced statistical models, and artificial intelligence to deliver match predictions, tactical analysis, and insights that go far beyond what traditional bookmaker tools offer. The platform is live and fully operational at elastico-elastico.vercel.app."),
        spacer(60),

        // Dashboard screenshot
        screenshotImage(shots.dashboard, 540, 300),
        caption("Figure 1: ELASTICO Dashboard \u2014 Real-time ELO rankings, xG analysis, live scores, and AI insights"),
        spacer(80),

        // ── KEY CAPABILITIES ──
        sectionHeading("Key Capabilities That Matter to Betika"),
        bodyText("Here is what sets ELASTICO apart from anything currently available in the East African betting market:"),
        spacer(60),

        bulletPoint("AI Match Predictions powered by Google Gemini, Groq, and 5 other AI providers with automatic failover \u2014 delivering contextual, data-driven pre-match and in-play analysis in under 2 seconds."),

        // AI Chat screenshot
        screenshotImage(shots.aiChat, 540, 340),
        caption("Figure 2: AI Chat \u2014 Live Google Gemini analysis with ELO, xG, and tactical breakdowns"),
        spacer(60),

        bulletPoint("Stochastic Prediction Engine running 150,000 Monte Carlo simulations per match, using Merton Jump-Diffusion models, GARCH volatility calibration, and Kelly Criterion bankroll management \u2014 the same quantitative methods used by professional trading firms."),

        // Engine screenshot
        screenshotImage(shots.engine, 540, 280),
        caption("Figure 3: Prediction Engine \u2014 Monte Carlo simulator with Kelly Criterion and market signals"),
        spacer(60),

        bulletPoint("Real-Time Data Integration from football-data.org (380+ Premier League matches), ESPN news feeds, and multiple statistical sources \u2014 all updated in real-time with no manual input required."),
        spacer(60),

        bulletPoint("Advanced Analytics including Expected Goals (xG), ELO rating systems, possession models, press intensity metrics, shot quality analysis, and Poisson distribution-based score predictions."),
        spacer(60),

        bulletPoint("Live News Feed pulling real-time transfer rumors, injury reports, and match previews directly from ESPN \u2014 giving users the information edge they need to make smarter bets."),

        // News screenshot
        screenshotImage(shots.news, 540, 260),
        caption("Figure 4: Live News Feed \u2014 Real ESPN articles on transfers, injuries, and match previews"),
        spacer(60),

        bulletPoint("Professional League Tables with real standings data from the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, and more \u2014 20 teams with accurate W/D/L, GF/GA, and points."),

        // Standings screenshot
        screenshotImage(shots.standings, 540, 300),
        caption("Figure 5: League Standings \u2014 Real competition data with full team statistics"),
        spacer(80),

        // ── WHY BETIKA ──
        sectionHeading("Why This Matters for Betika Uganda"),
        bodyText("The Ugandan sports betting market is growing rapidly, and users are becoming more sophisticated. They do not just want to place bets \u2014 they want to understand WHY a bet makes sense. ELASTICO gives you the technology to offer that experience. Imagine your users having access to AI-powered match analysis, mathematical probability models, and professional-grade insights before every bet they place. This is not a fantasy \u2014 the platform exists, it works, and it is ready to integrate."),
        spacer(60),
        bodyText("The platform currently powers predictions for the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, and Europa League \u2014 covering the exact matches your users bet on most. With World Cup 2026 approaching, this becomes even more valuable as a marketing tool and user retention engine."),
        spacer(60),

        // ── WHAT WE ARE OFFERING ──
        sectionHeading("What We Are Offering"),
        bulletPoint("White-label integration of ELASTICO's prediction engine into the Betika platform \u2014 your branding, our intelligence."),
        bulletPoint("AI-powered pre-match analysis widgets that show users detailed predictions, tactical breakdowns, and value bets before they place wagers."),
        bulletPoint("Real-time match tracking with live score updates, xG flow, and in-play analytical insights."),
        bulletPoint("Custom prediction models trained on historical data from the exact leagues and markets Betika offers."),
        bulletPoint("A fully documented API that your engineering team can integrate within days, not months."),
        spacer(80),

        // ── NEXT STEPS ──
        sectionHeading("Next Steps"),
        bodyText("I would love to arrange a 30-minute demo where I walk you through the platform live. You will see the AI generate real-time match analysis, run Monte Carlo simulations, and demonstrate exactly how this would look embedded in the Betika experience."),
        spacer(60),
        bodyText("The platform is live right now at elastico-elastico.vercel.app \u2014 feel free to explore it with the demo credentials (email: demo@elastico.app / password: demo123)."),
        spacer(60),
        bodyText("I am available this week for a call at your convenience. Please reach me at [your email] or [your phone number]."),
        spacer(200),

        // Signature
        bodyText("Best regards,"),
        bodyText("[Your Full Name]"),
        bodyText("Founder, ELASTICO"),
        bodyText("elastico-elastico.vercel.app"),
        bodyText("[your email]  |  [your phone number]"),
        spacer(100),

        // Matches screenshot
        screenshotImage(shots.matches, 540, 320),
        caption("Figure 6: Live Matches \u2014 Real fixture data with competition filtering and match details"),
      ],
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/home/z/my-project/download/ELASTICO-Betika-Pitch-Proposal.docx", buf);
  console.log("Document created: /home/z/my-project/download/ELASTICO-Betika-Pitch-Proposal.docx");
  console.log("Size:", (buf.length / 1024).toFixed(0), "KB");
});