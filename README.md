<p align="center">
  <img src="https://img.shields.io/badge/MetaReview-Free%20Online%20Tool-2563eb?style=for-the-badge" alt="MetaReview" />
</p>

<h1 align="center">MetaReview</h1>

<p align="center">
  <strong>Free online meta-analysis tool. From data to forest plot in 5 minutes.</strong><br/>
  <strong>免费在线 Meta 分析工具，5 分钟从数据到森林图。</strong>
</p>

<p align="center">
  <a href="https://metareview-8c1.pages.dev/">Live Demo</a> ·
  <a href="https://metareview-8c1.pages.dev/guides/meta-analysis-steps">Tutorial</a> ·
  <a href="https://metareview-8c1.pages.dev/guides/meta-analysis-software-comparison">Compare Tools</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/D3.js-7-f9a03c?logo=d3dotjs&logoColor=white" alt="D3.js" />
  <img src="https://img.shields.io/badge/Cloudflare_Pages-deployed-f38020?logo=cloudflare&logoColor=white" alt="Cloudflare Pages" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
  <img src="https://img.shields.io/badge/QA-568%2F568_passed-brightgreen" alt="QA Tests" />
  <img src="https://img.shields.io/badge/i18n-中文%2FEnglish-blue" alt="Bilingual" />
</p>

---

## Why MetaReview?

Meta-analysis is the gold standard for evidence synthesis in medical research, but existing tools are either **expensive** (Stata $895+, Covidence $225/yr), **require programming** (R metafor, 2-4 week learning curve), or **outdated** (RevMan, desktop-only).

**MetaReview** is a **free, zero-code, browser-based** alternative that covers the full systematic review workflow — from PubMed search to publication-ready reports.

| | MetaReview | RevMan | R/Stata | Covidence |
|---|:---:|:---:|:---:|:---:|
| Price | **Free** | Free (limited) | $895+ | $225/yr |
| No coding required | ✅ | ✅ | ❌ | ✅ |
| Chinese interface | ✅ | ❌ | ❌ | ❌ |
| Browser-based | ✅ | Desktop | Desktop | ✅ |
| AI literature screening | ✅ | ❌ | ❌ | ✅ |
| PDF data extraction | ✅ | ❌ | ❌ | ❌ |
| Statistical analysis | ✅ | ✅ | ✅ | ❌ |
| DOCX report export | ✅ | ✅ | ❌ | ✅ |

## Features

### Data Input
- **PubMed Search** — Built-in literature search with advanced filters (year, type, language)
- **AI Literature Screening** — PICO keyword scoring + LLM deep screening (Llama 3.1)
- **AI PDF Data Extraction** — Upload PDFs, AI extracts effect sizes automatically
- **CSV/RIS/EndNote Import** — Import from Zotero, Mendeley, EndNote, or spreadsheets
- **Excel Paste Import** — Copy-paste directly from Excel/Google Sheets
- **Manual Data Entry** — Keyboard-optimized table with Tab/Enter navigation

### Statistical Analysis
- **5 Effect Measures** — OR, RR, HR, MD, SMD (Hedges' g)
- **Fixed & Random Effects** — Inverse-variance weighting, DerSimonian-Laird
- **Heterogeneity** — I², Q-test, τ² with clinical interpretation
- **Subgroup Analysis** — Stratified pooling + Q-between difference test
- **Sensitivity Analysis** — Leave-one-out with direction-reversal highlighting
- **Cumulative Meta-Analysis** — Year-by-year evidence accumulation
- **Meta-Regression** — Weighted least squares with year covariate
- **Dose-Response Analysis** — Linear/quadratic models with CI bands
- **Prediction Interval** — Riley et al. (2011) random-effects PI

### Publication Bias
- **Funnel Plot** — Standard + contour-enhanced (p<0.01/0.05/0.10 regions)
- **Egger's Regression Test** — With regression line overlay on funnel plot
- **Begg's Rank Correlation** — Kendall's τ non-parametric test
- **Trim-and-Fill** — R₀ estimator with filled points + corrected effect size

### Visualization (11 Chart Types)
- **Forest Plot** — Interactive with tooltip, 3 color schemes, PNG/SVG export, sorting
- **Funnel Plot** — Standard + contour-enhanced + Egger's regression line
- **Galbraith Plot** — Standardized effect vs precision with ±2 CI bands
- **L'Abbé Plot** — Experimental vs control event rates, bubble = sample size
- **Baujat Plot** — Heterogeneity contribution vs overall effect influence
- **Cumulative Forest Plot** — Evidence accumulation over time
- **Leave-One-Out Plot** — Influence of individual studies
- **Meta-Regression Scatter** — Year vs effect with regression line + 95% CI band
- **Dose-Response Curve** — Dose vs effect with fitted curve + CI band
- **Network Graph** — Force-directed intervention network (D3.js)
- **PRISMA 2020 Flowchart** — SVG/PNG export, auto-populated from search results

### Reports & Export
- **HTML Report** — Full analysis with embedded SVG charts, print-optimized
- **DOCX Report** — Word document with tables, interpretations, narrative paragraphs
- **10+ Customizable Sections** — Toggle individual report chapters on/off
- **Methods Paragraph** — PRISMA 2020-compliant, auto-generated
- **Results Narrative** — Auto-integrates subgroup, sensitivity, bias, regression findings
- **JSON Export** — Structured data (meta/settings/studies/results/diagnostics)
- **CSV Export** — Study-level data with subgroup fields

### Quality Assessment
- **GRADE Evidence Quality** — 5 downgrade factors, auto + manual assessment
- **Influence Diagnostics** — Hat/rstudent/Cook's D/DFFITS/CovRatio table
- **Clinical Interpretation Card** — Direction, magnitude, significance, CI explanation

### User Experience
- **Chinese/English Bilingual** — 1,220+ translated entries, language persists
- **Onboarding Tour** — 5-step spotlight guide for first-time users
- **Effect Measure Guide** — Interactive 3-step decision flow
- **Undo/Redo** — Ctrl+Z/Ctrl+Shift+Z, 50-step history
- **Real-time Validation** — Red errors + yellow warnings + hover tooltips
- **Mobile Responsive** — Full functionality on phone/tablet
- **WCAG Accessible** — ARIA roles, keyboard navigation, screen reader support

## Quick Start

### Use Online (Recommended)

Visit **[metareview-8c1.pages.dev](https://metareview-8c1.pages.dev/)** — no installation required.

Click "Load Demo Data" to explore with a sample dataset (Aspirin vs Placebo, 7 RCTs).

### Run Locally

```bash
git clone https://github.com/TerryFYL/metareview.git
cd metareview
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Build for Production

```bash
npm run build
# Output in dist/
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5, Vite 6 |
| Charts | D3.js 7 (forest/funnel/Galbraith/L'Abbé/Baujat/network/dose-response) |
| Statistics | Pure JavaScript engine (1,190 lines, zero dependencies, 568/568 QA) |
| PDF Parsing | pdfjs-dist (client-side text extraction) |
| DOCX Export | docx.js 9.6 |
| State | Zustand + localStorage persistence |
| i18n | Custom lightweight system (1,220+ entries, zh/en) |
| Hosting | Cloudflare Pages + Functions |
| AI | Cloudflare Workers AI (Llama 3.1 8B, free tier) |
| Storage | Cloudflare KV (analytics + email collection) |

## Who Is This For?

- **Medical graduate students** (25-28) — First systematic review/meta-analysis for SCI publication
- **Junior clinicians** (30-40) — Need quick results with fragmented time
- **Researchers** switching from expensive tools (Stata, Covidence) to a free alternative
- **Anyone** who needs meta-analysis without learning R or statistics programming

## Project Structure

```
src/
├── components/          # React UI components (20+)
│   ├── ForestPlot.tsx   # D3.js forest plot with tooltip & sorting
│   ├── FunnelPlot.tsx   # Standard + contour-enhanced funnel plot
│   ├── DataTable.tsx    # Keyboard-optimized data entry
│   └── ...
├── lib/
│   ├── statistics.ts    # Core statistical engine (568/568 QA)
│   ├── report-export.ts # HTML report generation
│   ├── report-docx.ts   # DOCX report generation
│   ├── i18n.ts          # Bilingual translation system
│   └── types.ts         # TypeScript type definitions
├── store.ts             # Zustand state management
└── App.tsx              # Main application shell
functions/api/           # Cloudflare Pages Functions
├── pubmed/              # PubMed CORS proxy (esearch/esummary/efetch)
├── ai/                  # AI screening + PDF extraction
├── analytics/           # Page view & feature tracking
└── emails/              # Email subscription collection
public/guides/           # SEO landing pages (7 URLs)
```

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

```bash
# Run E2E tests
npx playwright test

# Lint
npm run lint
```

## License

MIT

---

<p align="center">
  <strong>MetaReview</strong> — Making meta-analysis accessible to every researcher.<br/>
  让每一位研究者都能轻松完成 Meta 分析。
</p>
