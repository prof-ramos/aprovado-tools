# E2E Test Infra: Aprovado Tools - Padrões Históricos de Estudo

## Test Philosophy
- Opaque-box, requirement-driven. Derived strictly from `ORIGINAL_REQUEST.md` and user-facing specifications.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Tab Navigation & Pane Switching | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Multiannual Comparative Engine (2016-2026) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 3 | Deterministic Phase Classification | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 4 | GitHub-style Annual Activity Heatmap (365/366d) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 5 | Circadian Distribution (24h & 4 Shifts = 100%) | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 6 | Weekday Volume & Consistency Ranking | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 7 | Yield Quadrant Matrix (4 Quadrants & Median Cutoff) | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 8 | Methodological Mix (Teoria, Questões, Revisão) | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| 9 | Rule-Based NLG Text Insights Synthesizer | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| 10 | Dashboard Standalone Mock Mode (?mock=true) | Verification Resources | 5 | 5 | ✓ |

## Test Architecture
- Test runner: Node.js v24 native test runner (`node --test`), `node:assert/strict`.
- Test case format: Pure ESM JavaScript tests importing `shared/analytics.js` and fixture data.
- Directory layout: `tests/` with `tests/fixtures/`, `tests/*.test.js`.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | 11-Year Continuous Student (2016-2026) Complete Lifecycle | F2, F3, F4, F5, F7, F9, F11, F12 | High |
| 2 | Interrupted Study Journey with Extended Hiatus & Resumption | F2, F3, F4, F5, F7, F12 | Medium |
| 3 | Intense Pre-Exam Sprint (Alta Intensidade + Questions Heavy) | F2, F3, F5, F9, F11, F12 | High |
| 4 | Night Owl Student with Extreme Shift Imbalance | F5, F7, F8, F12 | Medium |
| 5 | Critical Bottleneck Recovery Diagnosis | F7, F9, F10, F11, F12 | High |

## Coverage Thresholds
- Identified Features: 10
- Tier 1: ≥50 test assertions (≥5 per feature)
- Tier 2: ≥50 boundary & corner cases (leap years 2016/2020/2024, 0 questions, empty days, edge hours 23:59 vs 00:00, 100% acertos)
- Tier 3: ≥10 cross-feature interaction cases
- Tier 4: ≥5 realistic application scenarios
- Total: ≥115 automated test assertions
