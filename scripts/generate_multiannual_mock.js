#!/usr/bin/env node
/**
 * scripts/generate_multiannual_mock.js
 *
 * Deterministic seeded mock data generator simulating an 11-year multiannual study history (2016–2026)
 * for the AprovadoApp Chrome extension analytics engine.
 *
 * Guarantees:
 * 1. 100% deterministic (Mulberry32 PRNG with fixed seed).
 * 2. Covers 2016 to 2026 (11 calendar years), including leap years (2016, 2020, 2024).
 * 3. Covers all 3 phases:
 *    - ALTA_INTENSIDADE (2018, 2019, 2024, 2025, 2026)
 *    - MANUTENCAO (2016, 2017, 2021, 2022, 2023)
 *    - HIATO (2020: <50h and <20 active days)
 * 4. Heatmap intensity levels 0, 1, 2, 3, 4 present in the dataset.
 * 5. Circadian activity across all 24 hours (0h–23h) and all 4 shifts (Madrugada, Manhã, Tarde, Noite).
 * 6. Varied volume & consistency across all 7 weekdays (Dom–Sáb).
 * 7. Yield matrix representation across all 4 quadrants + edge cases:
 *    - Pontos Fortes (high time, high accuracy >= 75%)
 *    - Gargalos Críticos (high time, low accuracy < 75%)
 *    - Base Sólida (low time, high accuracy >= 75%)
 *    - Zona de Risco / Negligência (low time, low accuracy < 75%)
 *    - Sem Exercícios (studied time, but 0 questions)
 * 8. Methodological mix: Teoria, Questões, Revisão, plus others.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'tests', 'fixtures', 'multiannual_mock_2016_2026.json');

// Mulberry32 seeded PRNG
function createPRNG(seed) {
  let s = seed >>> 0;
  return function() {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randChoice(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Subject definitions
const MATERIAS = [
  {
    Id: 1,
    Nome: 'Direito Constitucional',
    Cor: '#3b82f6', // Blue
    targetQuadrant: 'pontosFortes', // High Time, High Acc (~85%)
    targetAccuracy: 0.86,
    hasQuestions: true,
    weight: 0.28
  },
  {
    Id: 2,
    Nome: 'Direito Administrativo',
    Cor: '#ef4444', // Red
    targetQuadrant: 'gargalosCriticos', // High Time, Low Acc (~56%)
    targetAccuracy: 0.56,
    hasQuestions: true,
    weight: 0.26
  },
  {
    Id: 3,
    Nome: 'Direito Tributário',
    Cor: '#10b981', // Green
    targetQuadrant: 'baseSolida', // Low Time, High Acc (~88%)
    targetAccuracy: 0.88,
    hasQuestions: true,
    weight: 0.08
  },
  {
    Id: 4,
    Nome: 'Contabilidade Geral',
    Cor: '#f59e0b', // Amber
    targetQuadrant: 'zonaRisco', // Low Time, Low Acc (~50%)
    targetAccuracy: 0.50,
    hasQuestions: true,
    weight: 0.07
  },
  {
    Id: 5,
    Nome: 'Direito Penal',
    Cor: '#8b5cf6', // Purple
    targetQuadrant: 'semExercicios', // Special edge case: 0 questions answered
    targetAccuracy: null,
    hasQuestions: false,
    weight: 0.06
  },
  {
    Id: 6,
    Nome: 'Língua Portuguesa',
    Cor: '#ec4899', // Pink
    targetQuadrant: 'pontosFortes', // High Time, High Acc (~82%)
    targetAccuracy: 0.82,
    hasQuestions: true,
    weight: 0.25
  }
];

const TOPICS = {
  1: ['Controle de Constitucionalidade', 'Direitos Fundamentais', 'Organização do Estado', 'Poder Executivo'],
  2: ['Atos Administrativos', 'Licitações e Contratos', 'Agentes Públicos', 'Responsabilidade Civil'],
  3: ['Sistema Tributário Nacional', 'Impostos em Espécie', 'Crédito Tributário'],
  4: ['Balanço Patrimonial', 'DRE e Demonstrações', 'Lançamentos Contábeis'],
  5: ['Teoria do Crime', 'Penas e Aplicação', 'Crimes Contra a Administração'],
  6: ['Sintaxe de Concordância e Regência', 'Interpretação de Textos', 'Pontuação e Crase']
};

const MODALITIES = [
  { type: 'Teoria', weight: 0.44 },
  { type: 'Questões', weight: 0.36 },
  { type: 'Revisão', weight: 0.15 },
  { type: 'Leitura de Lei Seca', weight: 0.05 }
];

function pickModality(rng) {
  const r = rng();
  let acc = 0;
  for (const m of MODALITIES) {
    acc += m.weight;
    if (r <= acc) return m.type;
  }
  return 'Teoria';
}

function pickSubject(rng) {
  const r = rng();
  let acc = 0;
  for (const s of MATERIAS) {
    acc += s.weight;
    if (r <= acc) return s;
  }
  return MATERIAS[0];
}

// Yearly Plan Strategy
const YEAR_PLANS = {
  2016: { phase: 'MANUTENCAO', targetDays: 95, targetHours: 180, endMonth: 12 }, // Leap
  2017: { phase: 'MANUTENCAO', targetDays: 110, targetHours: 230, endMonth: 12 },
  2018: { phase: 'ALTA_INTENSIDADE', targetDays: 255, targetHours: 850, endMonth: 12 },
  2019: { phase: 'ALTA_INTENSIDADE', targetDays: 270, targetHours: 920, endMonth: 12 },
  2020: { phase: 'HIATO', targetDays: 14, targetHours: 28, endMonth: 12 }, // Leap, strict hiato: <50h and <20 days
  2021: { phase: 'MANUTENCAO', targetDays: 80, targetHours: 160, endMonth: 12 },
  2022: { phase: 'MANUTENCAO', targetDays: 92, targetHours: 195, endMonth: 12 },
  2023: { phase: 'MANUTENCAO', targetDays: 115, targetHours: 250, endMonth: 12 },
  2024: { phase: 'ALTA_INTENSIDADE', targetDays: 245, targetHours: 810, endMonth: 12 }, // Leap
  2025: { phase: 'ALTA_INTENSIDADE', targetDays: 250, targetHours: 840, endMonth: 12 },
  2026: { phase: 'ALTA_INTENSIDADE', targetDays: 160, targetHours: 520, endMonth: 11 } // Ongoing year through Nov
};

export function generateMultiannualMock() {
  // A fresh PRNG makes repeated calls as reproducible as separate CLI runs.
  const rng = createPRNG(20261102);
  const activities = [];
  let currentActivityId = 10001;

  // We track generated start hours to ensure all 24 hours (0..23) are covered
  const hoursCovered = new Set();

  for (let year = 2016; year <= 2026; year++) {
    const plan = YEAR_PLANS[year];
    const maxMonth = plan.endMonth || 12;

    // Collect all candidate calendar days in this year up to endMonth
    const calendarDays = [];
    const daysInMonths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    for (let m = 0; m < maxMonth; m++) {
      const monthDays = (year === 2026 && m === 10) ? 2 : daysInMonths[m]; // Nov 2 for 2026
      for (let d = 1; d <= monthDays; d++) {
        const dateObj = new Date(Date.UTC(year, m, d));
        calendarDays.push({
          dateStr: `${year}-${pad2(m + 1)}-${pad2(d)}`,
          dateBr: `${pad2(d)}/${pad2(m + 1)}/${year}`,
          dayOfWeek: dateObj.getUTCDay(),
          month: m + 1,
          day: d
        });
      }
    }

    // Select active days
    let selectedDays = [];
    if (plan.phase === 'HIATO') {
      // Pick a tightly clustered small set of 14 days (e.g., in January and February)
      selectedDays = calendarDays.slice(5, 5 + plan.targetDays);
    } else {
      // Pick spaced active days to simulate natural study routines
      // Weight weekdays higher than weekends
      const weightedDays = calendarDays.filter(day => {
        // Higher probability on Mon-Fri (1-5), lower on Sat (6) and Sun (0)
        const weekdayProb = day.dayOfWeek >= 1 && day.dayOfWeek <= 5 ? 0.85 : 0.45;
        return rng() < weekdayProb;
      });

      // Sample down or up to targetDays
      if (weightedDays.length > plan.targetDays) {
        // Randomly pick plan.targetDays
        // Fisher–Yates consumes the same random values on every JS engine.
        // A random sort comparator depends on the engine's sorting strategy.
        const shuffled = [...weightedDays];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = randInt(rng, 0, i);
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        selectedDays = shuffled.slice(0, plan.targetDays);
      } else {
        selectedDays = weightedDays;
      }
    }

    // Sort selected days chronologically
    selectedDays.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    // For heatmap coverage, guarantee at least some days in each intensity tier in non-hiatus years:
    // Level 1: 0 < hours <= 1.5h (e.g. 1.0h = 3,600,000 ms)
    // Level 2: 1.5h < hours <= 3.5h (e.g. 2.5h = 9,000,000 ms)
    // Level 3: 3.5h < hours <= 6.0h (e.g. 4.5h = 16,200,000 ms)
    // Level 4: hours > 6.0h (e.g. 7.0h = 25,200,000 ms)

    for (let dayIdx = 0; dayIdx < selectedDays.length; dayIdx++) {
      const dayInfo = selectedDays[dayIdx];

      // Determine daily target hours
      let dailyTargetHours;
      if (plan.phase === 'HIATO') {
        dailyTargetHours = 1.0 + rng() * 1.5; // 1h to 2.5h
      } else if (dayIdx % 15 === 0 && plan.phase === 'ALTA_INTENSIDADE') {
        // Level 4 day: > 6.0h
        dailyTargetHours = 6.2 + rng() * 1.8; // 6.2h to 8.0h
      } else if (dayIdx % 8 === 0) {
        // Level 3 day: 3.5h - 6.0h
        dailyTargetHours = 3.8 + rng() * 1.8; // 3.8h to 5.6h
      } else if (dayIdx % 3 === 0) {
        // Level 1 day: <= 1.5h
        dailyTargetHours = 0.8 + rng() * 0.6; // 0.8h to 1.4h
      } else {
        // Level 2 day: 1.5h - 3.5h
        dailyTargetHours = 1.8 + rng() * 1.5; // 1.8h to 3.3h
      }

      // Break daily study into 1, 2, or 3 sessions
      const sessionsCount = dailyTargetHours > 4.5 ? 3 : dailyTargetHours > 2.0 ? 2 : 1;
      let sessionHoursAllocated = 0;

      for (let sIdx = 0; sIdx < sessionsCount; sIdx++) {
        const isLastSession = sIdx === sessionsCount - 1;
        const sHours = isLastSession
          ? Math.max(0.3, dailyTargetHours - sessionHoursAllocated)
          : Number(((dailyTargetHours / sessionsCount) * (0.8 + rng() * 0.4)).toFixed(2));
        sessionHoursAllocated += sHours;

        const durationMs = Math.round(sHours * 3600 * 1000);
        const subject = pickSubject(rng);
        const modality = pickModality(rng);
        const topicList = TOPICS[subject.Id] || ['Geral'];
        const topic = randChoice(rng, topicList);

        // Pick start hour
        // We ensure all 24 hours (0..23) get covered across the dataset
        let startHour;
        const missingHours = [];
        for (let h = 0; h < 24; h++) {
          if (!hoursCovered.has(h)) missingHours.push(h);
        }

        if (missingHours.length > 0 && rng() < 0.25) {
          // Explicitly cover missing hour
          startHour = randChoice(rng, missingHours);
        } else {
          // Realistic distribution by shift:
          // Madrugada (0-5): 6%
          // Manhã (6-11): 38%
          // Tarde (12-17): 32%
          // Noite (18-23): 24%
          const shiftRoll = rng();
          if (shiftRoll < 0.06) {
            startHour = randInt(rng, 0, 5);
          } else if (shiftRoll < 0.44) {
            startHour = randInt(rng, 6, 11);
          } else if (shiftRoll < 0.76) {
            startHour = randInt(rng, 12, 17);
          } else {
            startHour = randInt(rng, 18, 23);
          }
        }
        hoursCovered.add(startHour);

        const startMin = randInt(rng, 0, 59);
        const horaInicio = `${pad2(startHour)}:${pad2(startMin)}`;
        const inicioIso = `${dayInfo.dateStr}T${horaInicio}:00.000Z`;

        // Exercise questions
        let exercicioQuantidade = 0;
        let exercicioAcerto = 0;

        if (subject.hasQuestions) {
          if (modality === 'Questões') {
            exercicioQuantidade = randInt(rng, 15, 45);
          } else if (modality === 'Revisão') {
            exercicioQuantidade = randInt(rng, 5, 20);
          } else if (rng() < 0.35) {
            // Some theory sessions also include exercises
            exercicioQuantidade = randInt(rng, 5, 15);
          }

          if (exercicioQuantidade > 0) {
            // Apply subject target accuracy with slight variance
            const variance = (rng() - 0.5) * 0.12;
            const effectiveAcc = Math.min(1.0, Math.max(0.2, subject.targetAccuracy + variance));
            exercicioAcerto = Math.min(exercicioQuantidade, Math.round(exercicioQuantidade * effectiveAcc));
          }
        }

        const durH = Math.floor(durationMs / 3600000);
        const durM = Math.floor((durationMs % 3600000) / 60000);
        const duracaoTexto = `${durH}h ${durM}m`;

        activities.push({
          Id: currentActivityId++,
          Inicio: inicioIso,
          DataInicio: dayInfo.dateBr,
          HoraInicio: horaInicio,
          Duracao: durationMs,
          DuracaoTexto: duracaoTexto,
          Materia: {
            Id: subject.Id,
            Nome: subject.Nome,
            Cor: subject.Cor
          },
          Conteudo: {
            Id: subject.Id * 100 + randInt(rng, 1, 4),
            Nome: topic
          },
          TipoEstudo: modality,
          ExercicioQuantidade: exercicioQuantidade,
          ExercicioAcerto: exercicioAcerto,
          Anotacoes: `Sessão de ${modality} sobre ${topic}.`
        });
      }
    }
  }

  // Double check that all 24 hours have at least 1 session
  for (let h = 0; h < 24; h++) {
    if (!hoursCovered.has(h)) {
      // Inset an activity for missing hour in 2024
      const dur = 1800000;
      activities.push({
        Id: currentActivityId++,
        Inicio: `2024-06-15T${pad2(h)}:15:00.000Z`,
        DataInicio: `15/06/2024`,
        HoraInicio: `${pad2(h)}:15`,
        Duracao: dur,
        DuracaoTexto: `0h 30m`,
        Materia: { Id: 1, Nome: MATERIAS[0].Nome, Cor: MATERIAS[0].Cor },
        Conteudo: { Id: 101, Nome: 'Revisão Rápida' },
        TipoEstudo: 'Revisão',
        ExercicioQuantidade: 10,
        ExercicioAcerto: 9,
        Anotacoes: `Sessão suplementar hora ${h}h`
      });
      hoursCovered.add(h);
    }
  }

  // Sort activities chronologically by Inicio
  activities.sort((a, b) => a.Inicio.localeCompare(b.Inicio));

  // Construct complete snapshot structure
  const snapshot = {
    user: {
      Id: 101,
      Nome: 'Gabriel',
      Sobrenome: 'Ramos',
      Email: 'gabriel@exemplo.com'
    },
    materias: MATERIAS.map(m => ({
      Id: m.Id,
      Nome: m.Nome,
      Cor: m.Cor,
      Ativo: true
    })),
    atividades: activities,
    ciclo: {
      TotalHoras: 360000,
      TotalHorasExecutadas: 240000,
      TotalHorasRestantes: 120000,
      TotalPorcentagem: 66.7,
      Materias: MATERIAS.map(m => ({
        Materia: { Id: m.Id, Nome: m.Nome, Cor: m.Cor },
        Nome: m.Nome,
        Horas: 60000,
        HorasExecutadas: 40000,
        HorasExecutadasTexto: '11h 06m'
      }))
    },
    revisoesPendentes: [
      { Id: 1, Nome: 'Direitos Fundamentais', DataPrevista: '2026-11-05' },
      { Id: 2, Nome: 'Atos Administrativos', DataPrevista: '2026-11-06' }
    ],
    revisoesConcluidas: [
      { Id: 3, Nome: 'Controle de Constitucionalidade', DataConclusao: '2026-11-01' }
    ],
    syncedAt: '2026-11-02T23:50:00.000Z'
  };

  return snapshot;
}

// Execution if run directly
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  console.log('Generating deterministic multiannual mock dataset (2016–2026)...');
  const snapshot = generateMultiannualMock();

  // Create target directory if needed
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(snapshot, null, 2), 'utf-8');

  const stats = fs.statSync(OUTPUT_FILE);
  console.log(`Generated fixture: ${OUTPUT_FILE}`);
  console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`Total activities: ${snapshot.atividades.length}`);
  console.log(`Total subjects: ${snapshot.materias.length}`);

  // Quick audit by year
  const yearCounts = {};
  for (const a of snapshot.atividades) {
    const y = a.Inicio.slice(0, 4);
    if (!yearCounts[y]) yearCounts[y] = { count: 0, ms: 0, days: new Set(), q: 0, c: 0 };
    yearCounts[y].count++;
    yearCounts[y].ms += a.Duracao;
    yearCounts[y].days.add(a.Inicio.slice(0, 10));
    yearCounts[y].q += a.ExercicioQuantidade || 0;
    yearCounts[y].c += a.ExercicioAcerto || 0;
  }

  console.log('\nYearly Aggregation Audit:');
  console.table(
    Object.keys(yearCounts).sort().map(y => ({
      Year: y,
      Sessions: yearCounts[y].count,
      Hours: (yearCounts[y].ms / 3600000).toFixed(1),
      ActiveDays: yearCounts[y].days.size,
      Questions: yearCounts[y].q,
      Accuracy: yearCounts[y].q > 0 ? ((yearCounts[y].c / yearCounts[y].q) * 100).toFixed(1) + '%' : 'N/A'
    }))
  );
}
