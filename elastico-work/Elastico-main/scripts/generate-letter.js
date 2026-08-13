const {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, TabStopType, TabStopPosition,
  Header, Footer, PageNumber, NumberFormat,
} = require("docx");
const fs = require("fs");

const FONT_BODY = "Times New Roman";
const FONT_HEADING = "Times New Roman";
const SIZE_BODY = 24; // 12pt
const SIZE_H1 = 28;   // 14pt
const LINE_SPACING = 312; // 1.3x

// Helper: body paragraph (left-aligned for English letter)
function bodyPara(text, opts = {}) {
  const runs = [];
  // Parse simple **bold** markers
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: SIZE_BODY, font: FONT_BODY, color: "000000" }));
    } else {
      runs.push(new TextRun({ text: part, size: SIZE_BODY, font: FONT_BODY, color: "000000" }));
    }
  }
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 160, line: LINE_SPACING },
    ...opts,
    children: runs,
  });
}

// Helper: right-aligned line (for signature block)
function rightPara(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 80, line: LINE_SPACING },
    ...opts,
    children: [new TextRun({ text, size: SIZE_BODY, font: FONT_BODY, color: "000000" })],
  });
}

// Helper: empty paragraph spacer
function spacer(after = 80) {
  return new Paragraph({ spacing: { after, line: LINE_SPACING }, children: [new TextRun({ text: "", size: SIZE_BODY })] });
}

const today = new Date();
const dateStr = today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT_BODY, size: SIZE_BODY, color: "000000" },
        paragraph: { spacing: { line: LINE_SPACING } },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        },
      },
      children: [
        // === SENDER INFO BLOCK ===
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 40, line: LINE_SPACING },
          children: [new TextRun({ text: "Kaiso Isaac", bold: true, size: SIZE_BODY, font: FONT_BODY, color: "000000" })],
        }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 40, line: LINE_SPACING },
          children: [new TextRun({ text: "Diploma Student, Metropolitan International University", size: SIZE_BODY, font: FONT_BODY, color: "000000" })],
        }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 40, line: LINE_SPACING },
          children: [new TextRun({ text: "Kampala, Uganda", size: SIZE_BODY, font: FONT_BODY, color: "000000" })],
        }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 40, line: LINE_SPACING },
          children: [new TextRun({ text: "Kaisoisaac@gmail.com  |  0749742462", size: SIZE_BODY, font: FONT_BODY, color: "000000" })],
        }),

        spacer(200),

        // === DATE ===
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 200, line: LINE_SPACING },
          children: [new TextRun({ text: dateStr, size: SIZE_BODY, font: FONT_BODY, color: "000000" })],
        }),

        // === ADDRESSEE ===
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 40, line: LINE_SPACING },
          children: [new TextRun({ text: "The Partnerships & Innovation Team", bold: true, size: SIZE_BODY, font: FONT_BODY, color: "000000" })],
        }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 40, line: LINE_SPACING },
          children: [new TextRun({ text: "Betika Uganda", size: SIZE_BODY, font: FONT_BODY, color: "000000" })],
        }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 200, line: LINE_SPACING },
          children: [new TextRun({ text: "Kampala, Uganda", size: SIZE_BODY, font: FONT_BODY, color: "000000" })],
        }),

        // === SUBJECT LINE ===
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 240, line: LINE_SPACING },
          children: [
            new TextRun({ text: "RE: Strategic Partnership Proposal \u2014 ELASTICO Football Analytics Platform", bold: true, size: SIZE_BODY, font: FONT_BODY, color: "000000" }),
          ],
        }),

        // === SALUTATION ===
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 200, line: LINE_SPACING },
          children: [new TextRun({ text: "Dear Betika Uganda Team,", size: SIZE_BODY, font: FONT_BODY, color: "000000" })],
        }),

        // === BODY PARAGRAPHS ===
        bodyPara(
          "I am writing to introduce ELASTICO, a fully functional, AI-powered football analytics and match prediction platform that I have designed and built from the ground up. As a diploma student at Metropolitan International University with a deep passion for sports technology and data science, I have spent considerable time developing a product that I believe aligns directly with Betika Uganda\u2019s mission to deliver cutting-edge sports betting experiences to Ugandan football fans. ELASTICO is not a concept or a prototype\u2014it is a live, deployed platform accessible at elastico-elastico.vercel.app, and I am confident it can add significant value to your existing product ecosystem."
        ),

        bodyPara(
          "ELASTICO provides real-time football data across multiple leagues worldwide, including the English Premier League, La Liga, Serie A, the UEFA Champions League, and key African competitions. Users can browse live standings, upcoming fixtures, detailed team statistics, and head-to-head records\u2014all pulled from live data feeds and updated in real time. The platform also features a dedicated news section powered by ESPN integration, delivering the latest football headlines directly to users. This means your customers would have a single, comprehensive destination for everything they need before placing a bet: the latest news, current form, historical data, and intelligent predictions."
        ),

        bodyPara(
          "What truly sets ELASTICO apart is its AI-powered match prediction engine. The platform integrates a seven-provider AI gateway with automatic failover, utilising leading models including Google Gemini, Groq, Cerebras, and Mistral. When a user selects any upcoming match, the AI analyses current form, head-to-head history, team strength metrics, injury reports, and tactical context to generate a comprehensive pre-match analysis and a probabilistic scoreline prediction. This is not a simple algorithm\u2014it is a conversational AI system that can answer follow-up questions about any match, explain the reasoning behind its predictions, and provide nuanced football insights that go far beyond what traditional statistical models offer. For a betting platform, this translates directly into more informed users, higher engagement, and increased bet placement confidence."
        ),

        bodyPara(
          "The platform also includes a match simulation feature that allows users to run predicted scorelines and explore \u201cwhat-if\u201d scenarios for upcoming fixtures. This gamification element keeps users engaged between matchdays and creates repeat visit behaviour, which is essential for any sports betting partner looking to maximise user retention. The simulation engine uses statistical modelling combined with AI analysis to project realistic outcomes, giving users an interactive and immersive experience that complements Betika\u2019s core betting offerings."
        ),

        bodyPara(
          "From a technical standpoint, ELASTICO is built on a modern, scalable technology stack\u2014Next.js with server-side rendering, deployed on Vercel\u2019s global edge network for fast load times across Uganda and East Africa. The AI calls are routed server-side, ensuring that all intelligence processing happens securely and without exposing any API infrastructure to the end user. The platform is fully responsive, working seamlessly on mobile phones, tablets, and desktops, which is critical given that the majority of Ugandan users access the internet primarily through mobile devices."
        ),

        bodyPara(
          "I see several ways a partnership between ELASTICO and Betika Uganda could work. ELASTICO could serve as a value-added engagement tool embedded within or linked from the Betika platform, driving user education and bet confidence. The AI prediction engine could be white-labelled or integrated via API to power Betika\u2019s own match preview features. Alternatively, ELASTICO could operate as a standalone companion app that funnels informed, high-intent users toward Betika\u2019s betting markets. I am open to discussing whichever model best suits Betika\u2019s strategic goals."
        ),

        bodyPara(
          "I would genuinely appreciate the opportunity to demonstrate ELASTICO in person or via a video call. Seeing the platform live\u2014watching the AI analyse a real Premier League fixture in seconds, browsing the live data dashboards, and experiencing the match simulation\u2014conveys far more than any letter can. I am available at your earliest convenience and can be reached at Kaisoisaac@gmail.com or on 0749742462."
        ),

        bodyPara(
          "Thank you for your time and consideration. I am excited about the possibility of contributing to Betika Uganda\u2019s growth through technology, and I look forward to hearing from you."
        ),

        spacer(240),

        // === CLOSING ===
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 40, line: LINE_SPACING },
          children: [new TextRun({ text: "Yours faithfully,", size: SIZE_BODY, font: FONT_BODY, color: "000000" })],
        }),

        spacer(200),

        // === SIGNATURE ===
        rightPara("Kaiso Isaac"),
        rightPara("Founder & Developer, ELASTICO"),
        rightPara("Diploma Student"),
        rightPara("Metropolitan International University"),
        rightPara("Kampala, Uganda"),
      ],
    },
  ],
});

const OUTPUT_PATH = "/home/z/my-project/download/ELASTICO_Pitch_Letter_Betika_Uganda.docx";

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUTPUT_PATH, buffer);
  console.log("Letter saved to: " + OUTPUT_PATH);
}).catch((err) => {
  console.error("Error generating document:", err);
  process.exit(1);
});