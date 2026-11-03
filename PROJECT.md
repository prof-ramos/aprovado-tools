# Project: Padrões Históricos de Estudo (Aprovado Tools)

## Architecture
- **Chrome MV3 Client Architecture**: Pure Vanilla JavaScript (ES Modules), modern CSS, and native SVG/DOM rendering components.
- **Zero-Dependency Philosophy**: No external bundling tools, no remote CDNs (MV3 strict CSP compliance), zero runtime npm dependencies.
- **Testing Architecture**: Node.js v24 native test runner (`node --test`), `node:assert/strict`, and deterministic seeded mock fixtures.
- **Module Boundaries**:
  - `shared/analytics.js`: Pure deterministic calculation functions, statistical aggregations, phase classification, and rule-based NLG text synthesis.
  - `dashboard/dashboard.html`: Tab navigation bar (`Visão Geral` vs `Padrões Históricos`), responsive visual sections.
  - `dashboard/dashboard.css`: Dark-theme styling matching `:root` variables, 53-week SVG heatmap grid, 2x2 quadrant layout, circadian histogram, metric cards.
  - `dashboard/dashboard.js`: Tab pane lifecycle, native SVG rendering handlers, year selector state, offline `?mock=true` fallback.
  - `scripts/generate_multiannual_mock.js`: Deterministic seeded mock data generator simulating 2016–2026 study activity logs.
  - `tests/`: Automated unit, boundary, integration, and E2E verification test suites.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Tab Navigation System | Header navigation bar toggling between "Visão Geral" and "Padrões Históricos de Estudo (2016–2026)" with pane visibility management | M2_DASHBOARD_UI | Survey 1 (R1) |
| 2 | Multiannual Comparative Engine | Deterministic aggregation of annual hours, sessions, active days, questions, and accuracy across 2016–2026 | M1_ANALYTICS | Survey 2 (R2) |
| 3 | Phase Classification Algorithm | Deterministic categorization of years into Alta Intensidade (≥350h or ≥150d+250h), Manutenção (50-350h), and Hiato (<50h) with annualized pace for ongoing year | M1_ANALYTICS | Survey 2 (R2) |
| 4 | Multiannual Comparative UI | Year-by-year summary cards and comparative bar/trend visualizer with phase badges and key delta metrics | M2_DASHBOARD_UI | Survey 1 & 2 (R2) |
| 5 | Activity Heatmap Engine | 53-week x 7-day annual grid generator mapping 365/366 days with leap-year support and 5 intensity levels (0..4) | M1_ANALYTICS | Survey 2 (R2) |
| 6 | Activity Heatmap UI Component | Native SVG GitHub-style calendar heatmap with interactive year selector (2016–2026), month labels, day hover tooltips, and intensity legend | M2_DASHBOARD_UI | Survey 1 & 2 (R2) |
| 7 | Circadian Distribution Engine | 24-hour histogram mapping (0h–23h), 4 daytime shifts (Madrugada, Manhã, Tarde, Noite) strictly summing to 100%, and weekday volume & consistency rankings | M1_ANALYTICS | Survey 2 (R3) |
| 8 | Circadian Distribution UI Component | 24-hour distribution bar chart, shift breakdown progress cards with 100% total, and weekday ranking list with volume and consistency scores | M2_DASHBOARD_UI | Survey 1 & 2 (R3) |
| 9 | Yield Quadrant Matrix Engine | Classification of subjects into Pontos Fortes, Gargalos Críticos, Base Sólida, Zona de Risco/Negligência using median hours cutoff and 75% accuracy cutoff, plus non-exercise edge cases | M1_ANALYTICS | Survey 2 (R4) |
| 10 | Yield Quadrant Matrix UI Component | Interactive 2x2 scatter/quadrant plot with coordinate axes, quadrant badges, subject dot plots, method warnings, and detail inspection | M2_DASHBOARD_UI | Survey 1 & 2 (R4) |
| 11 | Methodological Mix Engine | Regex categorization of modalities into Teoria, Questões, Revisão and 5 deterministic pedagogical diagnostic rules | M1_ANALYTICS | Survey 2 (R5) |
| 12 | Rule-Based NLG Text Insights Synthesizer | Formatted analytical textual synthesis in Portuguese generating executive diagnosis, circadian habits, weekly cadence, quadrant highlights, and actionable advice | M1_ANALYTICS | Survey 2 (R5) |
| 13 | Methodological Mix & Insights UI Component | Method distribution visual bar, diagnostic recommendation cards with severity badges, and structured executive synthesis display | M2_DASHBOARD_UI | Survey 1 & 2 (R5) |
| 14 | Seeded Multiannual Mock Data & Infrastructure | Generator script and static fixture covering 2016–2026 (11 years, leap years, 3 phases, 24h hours, 4 shifts, 7 weekdays, 4 quadrants, 3 study types) with `package.json` test runner | M_TEST | Survey 3 (Verification) |
| 15 | E2E Automated Test Suite | Comprehensive tests covering Tiers 1–4 (Feature, Boundary, Combinatorial, Application scenarios) validating calculation precision and publishing `TEST_READY.md` | M_TEST | Survey 3 (Verification) |
| 16 | Dashboard Standalone Mock Mode | Support for `?mock=true` query parameter and fallback when Chrome storage is unavailable, enabling headless and visual browser verification | M2_DASHBOARD_UI | Survey 1 & 3 (Verification) |
| 17 | Git Branching & Push Synchronization | Creation of `feat/study-history-patterns` branch, clean atomic commits, security scan (no secrets/tokens), and push to `origin` | M3_GIT_INTEGRATION | Survey 3 (R6) |
| 18 | Final E2E Test Pass & Adversarial Hardening | 100% passage of test suite, adversarial edge case coverage (Tier 5), and Forensic Audit clearance | M_FINAL | Architecture requirement |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M_TEST | Test Infra, Mock Generator (2016-2026) & Tiers 1-4 E2E Test Suite | none | DONE |
| 2 | M1_ANALYTICS | Core Analytics & Deterministic Calculation Engine (`shared/analytics.js`) | none | DONE |
| 3 | M2_DASHBOARD_UI | Dashboard Tab Navigation, Native SVG Visualizations & Mock Mode | M1_ANALYTICS | DONE |
| 4 | M3_GIT_INTEGRATION | Dedicated branch `feat/study-history-patterns`, commit & push to `origin` | M1_ANALYTICS, M2_DASHBOARD_UI, M_TEST | DONE |
| 5 | M_FINAL | 100% E2E Test Pass, Adversarial Hardening (Tier 5) & Forensic Audit | M1_ANALYTICS, M2_DASHBOARD_UI, M3_GIT_INTEGRATION, M_TEST | IN_PROGRESS |

## Interface Contracts

### 1. `shared/analytics.js` ↔ `dashboard/dashboard.js` & Test Suite
All analytical functions are pure, deterministic ES module exports:
```typescript
// 1. Multiannual History (2016–2026)
export function computeMultiannualHistory(
  activities: Atividade[],
  startYear?: number, // default 2016
  endYear?: number    // default 2026
): {
  startYear: number;
  endYear: number;
  totalYearsCount: number;
  totalCumulativeHours: number;
  totalCumulativeSessions: number;
  totalCumulativeQuestions: number;
  totalCumulativeCorrect: number;
  overallHistoricalAccuracy: number | null;
  peakYear: { year: number; hours: number } | null;
  years: Array<{
    year: number;
    totalDurationMs: number;
    totalHours: number;
    formattedDuration: string;
    sessionsCount: number;
    activeDaysCount: number;
    totalQuestions: number;
    totalCorrect: number;
    accuracy: number | null;
    avgDailyHoursActive: number;
    avgDailyHoursYear: number;
    longestStreak: number;
    phase: 'ALTA_INTENSIDADE' | 'MANUTENCAO' | 'HIATO';
    phaseLabel: string;
    phaseDescription: string;
    isCurrentYear: boolean;
  }>;
};

// 2. Deterministic Phase Classification
export function classifyStudyPhase(
  totalHours: number,
  activeDaysCount: number,
  isCurrentYear?: boolean,
  dayOfYear?: number
): {
  phase: 'ALTA_INTENSIDADE' | 'MANUTENCAO' | 'HIATO';
  phaseLabel: string;
  phaseDescription: string;
};

// 3. GitHub-Style Annual Activity Heatmap
export function computeActivityHeatmap(
  activities: Atividade[],
  targetYear?: number
): {
  year: number;
  totalDays: number; // 365 or 366 (leap year aware)
  activeDaysCount: number;
  totalYearHours: number;
  formattedTotalHours: string;
  maxDailyHours: number;
  maxDailyDate: string | null;
  weeks: Array<{
    weekIndex: number;
    days: Array<{
      date: string; // "YYYY-MM-DD"
      dayOfWeek: number; // 0 (Sun) to 6 (Sat)
      inTargetYear: boolean;
      ms: number;
      hours: number;
      level: 0 | 1 | 2 | 3 | 4;
      sessionsCount: number;
      questions: number;
      correct: number;
    }>;
  }>;
};

// 4. Circadian & Temporal Patterns
export function computeCircadianDistribution(
  activities: Atividade[]
): {
  hourly: Array<{
    hour: number; // 0 .. 23
    label: string; // "00h" .. "23h"
    ms: number;
    hours: number;
    percentage: number;
    sessions: number;
    questions: number;
    accuracy: number | null;
  }>;
  peakHour: { hour: number; label: string; hours: number; percentage: number };
  shifts: {
    madrugada: { hours: number; percentage: number; sessions: number };
    manha: { hours: number; percentage: number; sessions: number };
    tarde: { hours: number; percentage: number; sessions: number };
    noite: { hours: number; percentage: number; sessions: number };
  };
  dominantShift: 'madrugada' | 'manha' | 'tarde' | 'noite';
  weekdayRanking: Array<{
    dayIndex: number; // 0..6
    dayName: string;
    shortName: string;
    hours: number;
    percentage: number;
    sessions: number;
    activeDaysCount: number;
    volumeRank: number; // 1..7
    consistencyRank: number; // 1..7
    consistencyScore: number;
  }>;
};

// 5. Yield Quadrant Matrix
export function computeYieldQuadrants(
  subjectsSummary: Array<{
    id: number;
    name: string;
    color: string;
    durationMs: number;
    totalHours: number;
    questions: number;
    correct: number;
    accuracy: number | null;
  }>,
  options?: {
    accuracyCutoff?: number; // default 75.0
    customMedianHours?: number; // fallback calculation
  }
): {
  medianHours: number;
  accuracyCutoff: number;
  quadrants: {
    pontosFortes: Array<any>;
    gargalosCriticos: Array<any>;
    baseSolida: Array<any>;
    zonaRisco: Array<any>;
    semExercicios: Array<any>;
  };
  summary: {
    totalSubjects: number;
    bottlenecksCount: number;
    strongCount: number;
  };
};

// 6. Methodological Mix Diagnostics
export function computeMethodologicalMix(
  activities: Atividade[]
): {
  proportions: {
    teoria: { ms: number; hours: number; percentage: number };
    questoes: { ms: number; hours: number; percentage: number };
    revisao: { ms: number; hours: number; percentage: number };
    outros: { ms: number; hours: number; percentage: number };
  };
  recommendations: Array<{
    severity: 'critical' | 'warning' | 'info' | 'success';
    title: string;
    text: string;
  }>;
};

// 7. Rule-Based Natural Language Synthesis (NLG)
export function generateStudyInsights(
  metrics: any,
  patterns: {
    history: any;
    circadian: any;
    quadrants: any;
    mix: any;
  }
): {
  executiveSummary: string;
  circadianInsights: string;
  weeklyCadenceInsights: string;
  quadrantInsights: string;
  methodRecommendations: string[];
  fullFormattedText: string;
};

// 8. Master Historical Patterns Consolidator
export function computeHistoricalPatterns(
  activities: Atividade[],
  materias?: any[],
  options?: any
): {
  history: ReturnType<typeof computeMultiannualHistory>;
  heatmap: ReturnType<typeof computeActivityHeatmap>;
  circadian: ReturnType<typeof computeCircadianDistribution>;
  quadrants: ReturnType<typeof computeYieldQuadrants>;
  mix: ReturnType<typeof computeMethodologicalMix>;
  insights: ReturnType<typeof generateStudyInsights>;
};
```

### 2. Dashboard Tab Navigation & Mock Contract
- `dashboard/dashboard.html`:
  - Tab Switcher: `<nav class="dash-tabs-bar"><button class="dash-tab-btn active" data-tab="tab-overview">Visão Geral</button><button class="dash-tab-btn" data-tab="tab-historical-patterns">Padrões Históricos de Estudo (2016–2026)</button></nav>`
  - Container Panes:
    - `<div id="tab-overview" class="dash-tab-pane active">...existing overview sections...</div>`
    - `<div id="tab-historical-patterns" class="dash-tab-pane hidden">...new historical sections...</div>`
- `dashboard/dashboard.js`:
  - Query parameter: if `window.location.search.includes('mock=true')` or `!window.chrome?.storage`, fetch `../tests/fixtures/multiannual_mock_2016_2026.json` (or inline fallback) and initialize dashboard with full 2016–2026 dataset.

## Code Layout
```
aprovado-tools/
├── manifest.json
├── package.json                          # Minimal root package.json ("type": "module", "test" script)
├── shared/
│   ├── analytics.js                      # Core deterministic calculation engines
│   ├── api.js                            # Aprovado API integration & cache
│   └── export.js                         # CSV/JSON/PDF export utilities
├── dashboard/
│   ├── dashboard.html                    # Dashboard markup with new tabs & sections
│   ├── dashboard.js                      # Dashboard controllers & native SVG renderers
│   └── dashboard.css                     # Dark-theme styles, grids, SVG styling
├── scripts/
│   └── generate_multiannual_mock.js      # Seeded deterministic mock generator
├── tests/
│   ├── fixtures/
│   │   └── multiannual_mock_2016_2026.json # Seeded 11-year dataset fixture
│   ├── multiannual.test.js               # Multi-year & phase classification tests
│   ├── heatmap.test.js                   # 365/366 day leap-year heatmap tests
│   ├── circadian.test.js                 # 24h & 4-shift 100% sum tests
│   ├── quadrants.test.js                 # 2x2 yield matrix tests
│   ├── mix_nlg.test.js                   # Mix diagnosis & rule-based NLG tests
│   └── e2e.test.js                       # End-to-end integration test suite
└── .agents/teamwork/                     # Agent coordination and metadata only
```
