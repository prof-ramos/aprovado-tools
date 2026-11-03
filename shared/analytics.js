/**
 * Study Analytics Engine for Aprovado Tools
 * Processes raw activities and generates comprehensive learning metrics.
 */
import { formatNumber, formatHours, formatValue } from './format.js';

export function formatDurationMs(ms) {
  if (!ms || ms <= 0) return '0h 0m';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h ${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

export function formatDurationHours(ms) {
  if (!ms || ms <= 0) return formatHours(0);
  return formatHours(ms / (1000 * 60 * 60));
}

/** Semester keys look like "2019.1"; show them as "2019 · 1º sem.". Years and other labels pass through. */
export function formatPeriodLabel(label) {
  const match = /^(\d{4})\.([12])$/.exec(String(label ?? ''));
  return match ? `${match[1]} · ${match[2]}º sem.` : String(label ?? '');
}

/** Portuguese label for a recommendation severity ('success' -> 'Ponto forte'). */
export function severityLabel(severity) {
  return { success: 'Ponto forte', info: 'Informação', warning: 'Atenção', critical: 'Prioridade' }[severity] || 'Informação';
}

export function parseDateString(str) {
  if (!str) return null;
  // Handle formats: "DD/MM/YYYY" or "YYYY-MM-DD" or ISO string
  if (str.includes('/')) {
    const [d, m, y] = str.split('/');
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  }
  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (isoDateOnly) {
    const [, y, m, d] = isoDateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(str);
}

export function filterActivitiesByPeriod(activities, period, customStart = null, customEnd = null) {
  if (!activities || !activities.length) return [];
  if (period === 'all') return activities;

  const now = new Date();
  let minDate = new Date();

  if (period === 'today') {
    // minDate is already "now"; it is normalized to 00:00 below.
  } else if (period === '7d') {
    minDate.setDate(now.getDate() - 7);
  } else if (period === '30d') {
    minDate.setDate(now.getDate() - 30);
  } else if (period === '90d') {
    minDate.setDate(now.getDate() - 90);
  } else if (period === 'this_month') {
    minDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'this_year') {
    minDate = new Date(now.getFullYear(), 0, 1);
  } else if (period === 'custom' && customStart) {
    minDate = parseDateString(customStart);
  }

  const maxDate = (period === 'custom' && customEnd) ? parseDateString(customEnd) : now;
  // End of day for maxDate
  maxDate.setHours(23, 59, 59, 999);
  minDate.setHours(0, 0, 0, 0);

  return activities.filter((item) => {
    const d = item.Inicio ? new Date(item.Inicio) : parseDateString(item.DataInicio);
    if (!d || isNaN(d.getTime())) return true;
    return d >= minDate && d <= maxDate;
  });
}

const THEORY_REGEX = /teoria|doutrina|leitura|videoaula|video-aula|v[íi]deo|video|aula|pdf|livro|cap[íi]tulo/i;
const QUESTIONS_REGEX = /quest[õo]es|exerc[íi]cio|exercicios|simulado|bateria|teste|prova/i;
const REVIEW_REGEX = /revis[ãa]o|revisar|revisoes|flashcard|anki|resumo|mapa/i;

export const MODALITY_LABELS = { teoria: 'Teoria', questoes: 'Questões', revisao: 'Revisão', outros: 'Outros' };

/**
 * Single source of truth for grouping a study type into Teoria, Questões, Revisão or Outros.
 * Used by both "Modalidades e hábitos" and the methodological mix, so their numbers match.
 * Returns 'teoria' | 'questoes' | 'revisao' | 'outros'.
 */
export function classifyModality(activity) {
  const rawType = ((activity && activity.TipoEstudo) || '').trim();
  if (QUESTIONS_REGEX.test(rawType)) return 'questoes';
  if (REVIEW_REGEX.test(rawType)) return 'revisao';
  if (THEORY_REGEX.test(rawType)) return 'teoria';
  if (((activity && activity.ExercicioQuantidade) || 0) > 0 && (!rawType || rawType.toLowerCase() === 'geral')) return 'questoes';
  return 'outros';
}

/** Time, sessions and questions per modality. Percentages and hours are rounded once, here. */
export function groupByModality(activities = []) {
  const groups = {};
  for (const key of Object.keys(MODALITY_LABELS)) {
    groups[key] = { key, name: MODALITY_LABELS[key], durationMs: 0, sessions: 0, questions: 0, correct: 0 };
  }
  let totalMs = 0;
  for (const atv of (activities || [])) {
    const g = groups[classifyModality(atv)];
    const dur = atv.Duracao || 0;
    g.durationMs += dur;
    g.sessions += 1;
    g.questions += atv.ExercicioQuantidade || 0;
    g.correct += atv.ExercicioAcerto || 0;
    totalMs += dur;
  }
  return Object.values(groups).map(g => ({
    ...g,
    hours: Number((g.durationMs / 3600000).toFixed(2)),
    percentage: Number((totalMs > 0 ? (g.durationMs / totalMs) * 100 : 0).toFixed(1)),
    accuracy: g.questions > 0 ? (g.correct / g.questions) * 100 : 0,
    formattedDuration: formatDurationMs(g.durationMs)
  }));
}

export function computeStudyMetrics(activities = [], materias = [], ciclo = null, revisoesPendentes = []) {
  const totalSessions = activities.length;
  let totalDurationMs = 0;
  let totalQuestions = 0;
  let totalCorrect = 0;

  const distinctDates = new Set();
  const subjectMap = new Map();
  const typeMap = new Map();
  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0]; // 0 = Dom, 6 = Sab
  const periodTotals = { madrugada: 0, manha: 0, tarde: 0, noite: 0 };
  const dailyHistoryMap = new Map(); // "YYYY-MM-DD" -> { ms, questions, correct, count }

  // Initialize known subjects from materias list
  materias.forEach(m => {
    subjectMap.set(m.Id, {
      id: m.Id,
      name: m.Nome,
      color: m.Cor || '#3b82f6',
      durationMs: 0,
      sessionsCount: 0,
      questions: 0,
      correct: 0,
      contents: new Map()
    });
  });

  for (const atv of activities) {
    const dur = atv.Duracao || 0;
    totalDurationMs += dur;

    const q = atv.ExercicioQuantidade || 0;
    const c = atv.ExercicioAcerto || 0;
    totalQuestions += q;
    totalCorrect += c;

    // Date calculations
    const d = atv.Inicio ? new Date(atv.Inicio) : parseDateString(atv.DataInicio);
    if (d && !isNaN(d.getTime())) {
      const dateKey = formatLocalDate(d);
      distinctDates.add(dateKey);

      // Daily history
      const existingDay = dailyHistoryMap.get(dateKey) || { ms: 0, questions: 0, correct: 0, count: 0 };
      existingDay.ms += dur;
      existingDay.questions += q;
      existingDay.correct += c;
      existingDay.count += 1;
      dailyHistoryMap.set(dateKey, existingDay);

      // Weekday & Time period
      const dayOfWeek = d.getDay();
      weekdayTotals[dayOfWeek] += dur;

      const hour = d.getHours();
      if (hour < 6) periodTotals.madrugada += dur;
      else if (hour < 12) periodTotals.manha += dur;
      else if (hour < 18) periodTotals.tarde += dur;
      else periodTotals.noite += dur;
    }

    // Subject breakdown
    const mId = atv.Materia?.Id;
    if (mId) {
      if (!subjectMap.has(mId)) {
        subjectMap.set(mId, {
          id: mId,
          name: atv.Materia?.Nome || `Matéria ${mId}`,
          color: atv.Materia?.Cor || '#3b82f6',
          durationMs: 0,
          sessionsCount: 0,
          questions: 0,
          correct: 0,
          contents: new Map()
        });
      }
      const s = subjectMap.get(mId);
      s.durationMs += dur;
      s.sessionsCount += 1;
      s.questions += q;
      s.correct += c;

      // Topic/Conteúdo breakdown
      if (atv.Conteudo?.Id) {
        const cId = atv.Conteudo.Id;
        const cName = atv.Conteudo.Nome || 'Sem título';
        const cObj = s.contents.get(cId) || { id: cId, name: cName, durationMs: 0, sessions: 0, questions: 0, correct: 0 };
        cObj.durationMs += dur;
        cObj.sessions += 1;
        cObj.questions += q;
        cObj.correct += c;
        s.contents.set(cId, cObj);
      }
    }

    // Study type breakdown (Teoria, Leitura, Questões, etc.)
    const rawType = (atv.TipoEstudo || 'Geral').trim();
    const typeKey = rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase() : 'Geral';
    const typeObj = typeMap.get(typeKey) || { name: typeKey, durationMs: 0, sessions: 0, questions: 0, correct: 0 };
    typeObj.durationMs += dur;
    typeObj.sessions += 1;
    typeObj.questions += q;
    typeObj.correct += c;
    typeMap.set(typeKey, typeObj);
  }

  // Calculate overall accuracy
  const overallAccuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

  // Streak calculations
  const sortedDateKeys = Array.from(distinctDates).sort();
  const streak = calculateStreak(sortedDateKeys);

  // Subject array with percentages
  const subjectsArray = Array.from(subjectMap.values())
    .filter(s => s.durationMs > 0 || s.sessionsCount > 0)
    .map(s => {
      const percentage = totalDurationMs > 0 ? (s.durationMs / totalDurationMs) * 100 : 0;
      const accuracy = s.questions > 0 ? (s.correct / s.questions) * 100 : 0;
      const contents = Array.from(s.contents.values())
        .sort((a, b) => b.durationMs - a.durationMs)
        .map(c => ({
          ...c,
          formattedDuration: formatDurationMs(c.durationMs),
          accuracy: c.questions > 0 ? (c.correct / c.questions) * 100 : 0
        }));

      return {
        ...s,
        percentage,
        accuracy,
        formattedDuration: formatDurationMs(s.durationMs),
        formattedHours: formatDurationHours(s.durationMs),
        contents
      };
    })
    .sort((a, b) => b.durationMs - a.durationMs);

  // Study types array
  const typesArray = Array.from(typeMap.values())
    .map(t => ({
      ...t,
      percentage: totalDurationMs > 0 ? (t.durationMs / totalDurationMs) * 100 : 0,
      formattedDuration: formatDurationMs(t.durationMs),
      accuracy: t.questions > 0 ? (t.correct / t.questions) * 100 : 0
    }))
    .sort((a, b) => b.durationMs - a.durationMs);

  // Daily average
  const totalDays = distinctDates.size || 1;
  const avgDailyMs = totalDurationMs / totalDays;

  // Format daily history for charts (sorted chronologically)
  const dailyHistory = Array.from(dailyHistoryMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      date,
      ms: data.ms,
      hours: (data.ms / 3600000).toFixed(2),
      formattedDuration: formatDurationMs(data.ms),
      questions: data.questions,
      correct: data.correct,
      count: data.count,
      accuracy: data.questions > 0 ? ((data.correct / data.questions) * 100).toFixed(1) : null
    }));

  return {
    totalSessions,
    totalDurationMs,
    formattedTotalDuration: formatDurationMs(totalDurationMs),
    formattedTotalHours: formatDurationHours(totalDurationMs),
    totalQuestions,
    totalCorrect,
    overallAccuracy: overallAccuracy.toFixed(1),
    distinctDaysCount: distinctDates.size,
    avgDailyDuration: formatDurationMs(avgDailyMs),
    streak,
    subjects: subjectsArray,
    types: typesArray,
    modalities: groupByModality(activities),
    dailyHistory,
    weekdayDistribution: weekdayTotals.map(ms => ({
      ms,
      formatted: formatDurationMs(ms),
      percentage: totalDurationMs > 0 ? ((ms / totalDurationMs) * 100).toFixed(1) : '0'
    })),
    periodDistribution: {
      madrugada: { ms: periodTotals.madrugada, formatted: formatDurationMs(periodTotals.madrugada) },
      manha: { ms: periodTotals.manha, formatted: formatDurationMs(periodTotals.manha) },
      tarde: { ms: periodTotals.tarde, formatted: formatDurationMs(periodTotals.tarde) },
      noite: { ms: periodTotals.noite, formatted: formatDurationMs(periodTotals.noite) }
    },
    ciclo: ciclo ? {
      totalHoras: ciclo.TotalHoras,
      executadas: ciclo.TotalHorasExecutadas,
      restantes: ciclo.TotalHorasRestantes,
      porcentagem: (ciclo.TotalPorcentagem || 0).toFixed(1),
      materias: ciclo.Materias || []
    } : null,
    pendingReviewsCount: revisoesPendentes ? revisoesPendentes.length : 0
  };
}

function dateFromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Inclusive date range ("YYYY-MM-DD" keys) that the selected period covers, so the timeline
 * shows the whole period even when it starts or ends without study. 'all' and open custom
 * ranges fall back to the first and last day with data.
 */
export function timelineRange(period, dailyHistory = [], customStart = null, customEnd = null, today = new Date()) {
  const first = dailyHistory.length ? dailyHistory[0].date : null;
  const last = dailyHistory.length ? dailyHistory[dailyHistory.length - 1].date : null;
  const todayKey = formatLocalDate(today);
  const back = { '7d': 7, '30d': 30, '90d': 90 }[period];
  if (back) return { start: formatLocalDate(addDays(today, -back)), end: todayKey };
  if (period === 'this_year') return { start: `${today.getFullYear()}-01-01`, end: todayKey };
  if (period === 'custom') {
    const s = customStart ? parseDateString(customStart) : null;
    const e = customEnd ? parseDateString(customEnd) : null;
    return {
      start: s && !isNaN(s.getTime()) ? formatLocalDate(s) : first,
      end: e && !isNaN(e.getTime()) ? formatLocalDate(e) : (customStart ? todayKey : last)
    };
  }
  return { start: first, end: last };
}

/**
 * Groups the daily history for the evolution chart: by day up to 45 days, by week (Monday to
 * Sunday) up to one year, by month beyond. Days, weeks and months without study are kept as zero.
 * Returns { granularity: 'day'|'week'|'month', buckets: [{ key, start, end, hours, ms, sessions,
 * questions, studyDays }] }. Input data is not modified.
 */
export function buildTimelineSeries(dailyHistory = [], range = {}) {
  const start = range.start || (dailyHistory.length ? dailyHistory[0].date : null);
  const end = range.end || (dailyHistory.length ? dailyHistory[dailyHistory.length - 1].date : null);
  if (!start || !end || start > end) return { granularity: 'day', buckets: [] };

  const startDate = dateFromKey(start);
  const endDate = dateFromKey(end);
  const spanDays = Math.round((endDate - startDate) / 86400000) + 1;
  const granularity = spanDays <= 45 ? 'day' : (spanDays <= 366 ? 'week' : 'month');

  const byDate = new Map(dailyHistory.map(d => [d.date, d]));
  const buckets = [];
  const bucketOf = new Map();
  const newBucket = (key, from, to) => {
    const bucket = { key, start: formatLocalDate(from), end: formatLocalDate(to), ms: 0, sessions: 0, questions: 0, studyDays: 0 };
    buckets.push(bucket);
    bucketOf.set(key, bucket);
    return bucket;
  };

  for (let day = startDate; day <= endDate; day = addDays(day, 1)) {
    const dateKey = formatLocalDate(day);
    let key;
    let from = day;
    let to = day;
    if (granularity === 'week') {
      from = addDays(day, -((day.getDay() + 6) % 7));
      to = addDays(from, 6);
      key = formatLocalDate(from);
    } else if (granularity === 'month') {
      from = new Date(day.getFullYear(), day.getMonth(), 1);
      to = new Date(day.getFullYear(), day.getMonth() + 1, 0);
      key = dateKey.slice(0, 7);
    } else {
      key = dateKey;
    }
    const bucket = bucketOf.get(key) || newBucket(key, from, to);
    const entry = byDate.get(dateKey);
    if (entry) {
      bucket.ms += entry.ms;
      bucket.sessions += entry.count;
      bucket.questions += entry.questions;
      if (entry.ms > 0 || entry.count > 0) bucket.studyDays += 1;
    }
  }
  return { granularity, buckets: buckets.map(b => ({ ...b, hours: Number((b.ms / 3600000).toFixed(2)) })) };
}

/** True when a study cycle exists but nothing was studied in it yet (a new round). */
export function isCycleNotStarted(ciclo) {
  if (!ciclo) return false;
  const nothingDone = Number(ciclo.porcentagem || 0) === 0 && !(Number(ciclo.executadas) > 0);
  return nothingDone && (ciclo.materias || []).every(m => !(Number(m.HorasExecutadas) > 0));
}

function calculateStreak(sortedDateKeys) {
  if (!sortedDateKeys.length) return { current: 0, longest: 0 };

  const today = new Date();
  const todayKey = formatLocalDate(today);
  today.setDate(today.getDate() - 1);
  const yesterdayKey = formatLocalDate(today);

  const dateSet = new Set(sortedDateKeys);

  // Check current streak: starting from today or yesterday
  let currentStreak = 0;
  let checkDate = new Date();
  if (!dateSet.has(todayKey)) {
    // If not studied today, maybe studied yesterday
    if (dateSet.has(yesterdayKey)) {
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      checkDate = null;
    }
  }

  if (checkDate) {
    while (true) {
      const key = formatLocalDate(checkDate);
      if (dateSet.has(key)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let running = 0;
  for (let i = 0; i < sortedDateKeys.length; i++) {
    if (i === 0) {
      running = 1;
    } else {
      const prev = new Date(sortedDateKeys[i - 1] + 'T00:00:00');
      const curr = new Date(sortedDateKeys[i] + 'T00:00:00');
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        running++;
      } else if (diffDays > 1) {
        running = 1;
      }
    }
    if (running > longestStreak) longestStreak = running;
  }

  return { current: currentStreak, longest: Math.max(longestStreak, currentStreak) };
}

/* ==========================================================================
 * Historical Study Patterns & Deterministic Analytics Engine (2016–current year)
 * ========================================================================== */

// Internal helpers
function positiveDurationMs(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function getDaysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseActivityDate(atv) {
  if (!atv) return null;
  if (atv.Inicio) {
    const d = new Date(atv.Inicio);
    if (!isNaN(d.getTime())) return d;
  }
  if (atv.DataInicio) {
    const d = parseDateString(atv.DataInicio);
    if (d && !isNaN(d.getTime())) return d;
  }
  return null;
}

function parseActivityHour(atv) {
  if (typeof atv?.HoraInicio === 'string' && atv.HoraInicio.includes(':')) {
    const h = parseInt(atv.HoraInicio.split(':')[0], 10);
    if (!isNaN(h) && h >= 0 && h <= 23) return h;
  }
  if (atv?.Inicio) {
    const d = new Date(atv.Inicio);
    if (!isNaN(d.getTime())) return d.getHours();
  }
  return 0;
}

function calculateConsecutiveStreak(sortedDateKeys) {
  if (!sortedDateKeys || sortedDateKeys.length === 0) return 0;
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedDateKeys.length; i++) {
    const prev = new Date(sortedDateKeys[i - 1] + 'T00:00:00');
    const curr = new Date(sortedDateKeys[i] + 'T00:00:00');
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentStreak++;
    } else if (diffDays > 1) {
      currentStreak = 1;
    }
    if (currentStreak > maxStreak) {
      maxStreak = currentStreak;
    }
  }
  return maxStreak;
}

/**
 * 1. Deterministic Phase Classification
 */
export function classifyStudyPhase(totalHours = 0, activeDaysCount = 0, isCurrentYear = false, dayOfYear = 365) {
  const safeHours = typeof totalHours === 'number' && !isNaN(totalHours) ? Math.max(0, totalHours) : 0;
  const safeDays = typeof activeDaysCount === 'number' && !isNaN(activeDaysCount) ? Math.max(0, activeDaysCount) : 0;
  const safeDayOfYear = typeof dayOfYear === 'number' && !isNaN(dayOfYear) && dayOfYear > 0 ? dayOfYear : 365;

  // If current year is in progress, evaluate both absolute and annualized projected hours
  const effectiveHours = isCurrentYear && safeDayOfYear > 30
    ? Math.max(safeHours, (safeHours / safeDayOfYear) * 365)
    : safeHours;
  const effectiveDays = isCurrentYear && safeDayOfYear > 30
    ? Math.max(safeDays, Math.round((safeDays / safeDayOfYear) * 365))
    : safeDays;

  if (effectiveHours < 50.0 || effectiveDays < 20) {
    return {
      phase: 'HIATO',
      phaseLabel: 'Hiato / Inatividade',
      phaseDescription: 'Período de interrupção ou estudo residual (<50h anuais ou <20 dias ativos).'
    };
  }

  if (effectiveHours >= 350.0 || (effectiveDays >= 150 && effectiveHours >= 250.0)) {
    return {
      phase: 'ALTA_INTENSIDADE',
      phaseLabel: 'Alta Intensidade',
      phaseDescription: 'Ritmo focado e consistente de preparação pesada (≥350h anuais ou alta frequência constante).'
    };
  }

  return {
    phase: 'MANUTENCAO',
    phaseLabel: 'Manutenção',
    phaseDescription: 'Ritmo moderado e contínuo para retenção de conteúdo (50h a 350h anuais).'
  };
}

/**
 * 2. Multiannual History (2016–current year by default)
 */
export function computeMultiannualHistory(activities = [], startYear = 2016, endYear = new Date().getFullYear()) {
  const sYear = Math.min(startYear, endYear);
  const eYear = Math.max(startYear, endYear);
  const currentYear = new Date().getFullYear();

  // Index activities by year
  const activitiesByYear = new Map();
  for (const atv of (activities || [])) {
    const d = parseActivityDate(atv);
    if (d) {
      const y = d.getFullYear();
      if (!activitiesByYear.has(y)) {
        activitiesByYear.set(y, []);
      }
      activitiesByYear.get(y).push({ atv, date: d });
    }
  }

  const years = [];
  let peakYear = null;

  for (let y = sYear; y <= eYear; y++) {
    const isCurrent = (y === currentYear);
    const daysInYear = getDaysInYear(y);

    let dayOfYear = daysInYear;
    if (isCurrent) {
      const now = new Date();
      // Compare calendar dates, not elapsed local milliseconds: DST can make
      // the interval to midnight one hour longer or shorter than whole days.
      const today = Date.UTC(y, now.getMonth(), now.getDate());
      const startOfYear = Date.UTC(y, 0, 1);
      dayOfYear = Math.max(1, Math.min(daysInYear, (today - startOfYear) / 86400000 + 1));
    }

    const yearEntries = activitiesByYear.get(y) || [];
    let totalDurationMs = 0;
    let totalQuestions = 0;
    let totalCorrect = 0;
    const dateSet = new Set();

    for (const entry of yearEntries) {
      const atv = entry.atv;
      const durationMs = positiveDurationMs(atv.Duracao);
      totalDurationMs += durationMs;
      totalQuestions += (atv.ExercicioQuantidade || 0);
      totalCorrect += (atv.ExercicioAcerto || 0);
      if (durationMs > 0) dateSet.add(formatLocalDate(entry.date));
    }

    const totalHours = Number((totalDurationMs / 3600000).toFixed(1));
    const sessionsCount = yearEntries.length;
    const activeDaysCount = dateSet.size;
    const accuracy = totalQuestions > 0 ? Number(((totalCorrect / totalQuestions) * 100).toFixed(1)) : null;
    const avgDailyHoursActive = activeDaysCount > 0 ? Number((totalHours / activeDaysCount).toFixed(2)) : 0;
    const avgDailyHoursYear = Number((totalHours / daysInYear).toFixed(2));

    const sortedDates = Array.from(dateSet).sort();
    const longestStreak = calculateConsecutiveStreak(sortedDates);
    const phaseInfo = classifyStudyPhase(totalHours, activeDaysCount, isCurrent, dayOfYear);

    const yearData = {
      year: y,
      totalDurationMs,
      totalHours,
      formattedDuration: formatDurationMs(totalDurationMs),
      sessionsCount,
      activeDaysCount,
      totalQuestions,
      totalCorrect,
      accuracy,
      avgDailyHoursActive,
      avgDailyHoursYear,
      longestStreak,
      phase: phaseInfo.phase,
      phaseLabel: phaseInfo.phaseLabel,
      phaseDescription: phaseInfo.phaseDescription,
      isCurrentYear: isCurrent
    };

    years.push(yearData);

    if (totalHours > 0) {
      if (!peakYear || totalHours > peakYear.hours) {
        peakYear = { year: y, hours: totalHours };
      }
    }
  }

  const totalYearsCount = years.length;
  const totalCumulativeHours = Number(years.reduce((sum, item) => sum + item.totalHours, 0).toFixed(1));
  const totalCumulativeSessions = years.reduce((sum, item) => sum + item.sessionsCount, 0);
  const totalCumulativeQuestions = years.reduce((sum, item) => sum + item.totalQuestions, 0);
  const totalCumulativeCorrect = years.reduce((sum, item) => sum + item.totalCorrect, 0);
  const overallHistoricalAccuracy = totalCumulativeQuestions > 0
    ? Number(((totalCumulativeCorrect / totalCumulativeQuestions) * 100).toFixed(1))
    : null;

  return {
    startYear: sYear,
    endYear: eYear,
    totalYearsCount,
    totalCumulativeHours,
    totalCumulativeSessions,
    totalCumulativeQuestions,
    totalCumulativeCorrect,
    overallHistoricalAccuracy,
    peakYear,
    years
  };
}

/**
 * 3. GitHub-Style Annual Activity Heatmap (365/366 Days)
 */
export function computeActivityHeatmap(activities = [], targetYear = new Date().getFullYear()) {
  const isLeap = isLeapYear(targetYear);
  const totalDays = isLeap ? 366 : 365;

  const dayMap = new Map();
  for (const atv of (activities || [])) {
    const d = parseActivityDate(atv);
    if (d && d.getFullYear() === targetYear) {
      const key = formatLocalDate(d);
      if (!dayMap.has(key)) {
        dayMap.set(key, { ms: 0, sessionsCount: 0, questions: 0, correct: 0 });
      }
      const entry = dayMap.get(key);
      entry.ms += positiveDurationMs(atv.Duracao);
      entry.sessionsCount += 1;
      entry.questions += (atv.ExercicioQuantidade || 0);
      entry.correct += (atv.ExercicioAcerto || 0);
    }
  }

  function getHeatmapLevel(ms) {
    if (!ms || ms <= 0) return 0;
    const hours = ms / 3600000;
    if (hours <= 1.5) return 1;
    if (hours <= 3.5) return 2;
    if (hours <= 6.0) return 3;
    return 4;
  }

  const jan1 = new Date(targetYear, 0, 1, 12, 0, 0);
  const jan1DayOfWeek = jan1.getDay();
  const dec31 = new Date(targetYear, 11, 31, 12, 0, 0);
  const dec31DayOfWeek = dec31.getDay();

  const startDate = new Date(targetYear, 0, 1 - jan1DayOfWeek, 12, 0, 0);
  const endDate = new Date(targetYear, 11, 31 + (6 - dec31DayOfWeek), 12, 0, 0);

  const weeks = [];
  let currentWeekDays = [];
  let weekIndex = 0;

  let totalYearMs = 0;
  let maxDailyMs = 0;
  let maxDailyDate = null;
  const activeDaysSet = new Set();

  const curr = new Date(startDate.getTime());
  const endLimit = new Date(endDate.getTime());
  endLimit.setHours(23, 59, 59, 999);

  while (curr <= endLimit) {
    const inTargetYear = (curr.getFullYear() === targetYear);
    const dateKey = formatLocalDate(curr);
    const dayOfWeek = curr.getDay();

    let ms = 0;
    let hours = 0;
    let level = 0;
    let sessionsCount = 0;
    let questions = 0;
    let correct = 0;

    if (inTargetYear) {
      const dayData = dayMap.get(dateKey);
      if (dayData && dayData.ms > 0) {
        ms = dayData.ms;
        hours = Number((ms / 3600000).toFixed(2));
        level = getHeatmapLevel(ms);
        sessionsCount = dayData.sessionsCount;
        questions = dayData.questions;
        correct = dayData.correct;

        totalYearMs += ms;
        activeDaysSet.add(dateKey);

        if (ms > maxDailyMs) {
          maxDailyMs = ms;
          maxDailyDate = dateKey;
        }
      }
    }

    currentWeekDays.push({
      date: dateKey,
      dayOfWeek,
      inTargetYear,
      ms,
      hours,
      level,
      sessionsCount,
      questions,
      correct
    });

    if (currentWeekDays.length === 7) {
      weeks.push({
        weekIndex,
        days: currentWeekDays
      });
      weekIndex++;
      currentWeekDays = [];
    }

    curr.setDate(curr.getDate() + 1);
  }

  if (currentWeekDays.length > 0) {
    weeks.push({
      weekIndex,
      days: currentWeekDays
    });
  }

  return {
    year: targetYear,
    totalDays,
    activeDaysCount: activeDaysSet.size,
    totalYearHours: Number((totalYearMs / 3600000).toFixed(1)),
    formattedTotalHours: formatDurationHours(totalYearMs),
    maxDailyHours: Number((maxDailyMs / 3600000).toFixed(2)),
    maxDailyDate,
    weeks
  };
}

/**
 * 4. Circadian & Temporal Patterns
 */
export function computeCircadianDistribution(activities = []) {
  const hourly = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${String(i).padStart(2, '0')}h`,
    ms: 0,
    hours: 0,
    percentage: 0,
    sessions: 0,
    questions: 0,
    correct: 0,
    accuracy: null
  }));

  const shiftDefs = {
    madrugada: [0, 1, 2, 3, 4, 5],
    manha: [6, 7, 8, 9, 10, 11],
    tarde: [12, 13, 14, 15, 16, 17],
    noite: [18, 19, 20, 21, 22, 23]
  };

  const weekdayNames = [
    { name: 'Domingo', short: 'Dom' },
    { name: 'Segunda-feira', short: 'Seg' },
    { name: 'Terça-feira', short: 'Ter' },
    { name: 'Quarta-feira', short: 'Qua' },
    { name: 'Quinta-feira', short: 'Qui' },
    { name: 'Sexta-feira', short: 'Sex' },
    { name: 'Sábado', short: 'Sáb' }
  ];

  const weekdayData = Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    dayName: weekdayNames[i].name,
    shortName: weekdayNames[i].short,
    ms: 0,
    hours: 0,
    percentage: 0,
    sessions: 0,
    activeDates: new Set(),
    activeDaysCount: 0,
    volumeRank: 0,
    consistencyRank: 0,
    consistencyScore: 0
  }));

  let totalDurationMs = 0;
  let earliestDate = null;
  let latestDate = null;

  for (const atv of (activities || [])) {
    const dur = atv.Duracao || 0;
    const q = atv.ExercicioQuantidade || 0;
    const c = atv.ExercicioAcerto || 0;
    totalDurationMs += dur;

    const h = parseActivityHour(atv);
    hourly[h].ms += dur;
    hourly[h].sessions += 1;
    hourly[h].questions += q;
    hourly[h].correct += c;

    const d = parseActivityDate(atv);
    const w = d ? d.getDay() : 0;
    weekdayData[w].ms += dur;
    weekdayData[w].sessions += 1;
    if (d) {
      weekdayData[w].activeDates.add(formatLocalDate(d));
      if (!earliestDate || d < earliestDate) earliestDate = d;
      if (!latestDate || d > latestDate) latestDate = d;
    }
  }

  // Hourly calculations & peak hour
  let peakHour = { hour: 0, label: '00h', hours: 0, percentage: 0 };
  let maxHourMs = -1;

  for (let i = 0; i < 24; i++) {
    const item = hourly[i];
    item.hours = Number((item.ms / 3600000).toFixed(2));
    item.percentage = totalDurationMs > 0 ? Number(((item.ms / totalDurationMs) * 100).toFixed(1)) : 0;
    item.accuracy = item.questions > 0 ? Number(((item.correct / item.questions) * 100).toFixed(1)) : null;

    if (item.ms > maxHourMs) {
      maxHourMs = item.ms;
      peakHour = { hour: item.hour, label: item.label, hours: item.hours, percentage: item.percentage };
    }
  }

  // Shift aggregations
  const shifts = {
    madrugada: { hours: 0, percentage: 0, sessions: 0 },
    manha: { hours: 0, percentage: 0, sessions: 0 },
    tarde: { hours: 0, percentage: 0, sessions: 0 },
    noite: { hours: 0, percentage: 0, sessions: 0 }
  };

  const shiftMs = { madrugada: 0, manha: 0, tarde: 0, noite: 0 };

  for (const [shiftName, hoursArr] of Object.entries(shiftDefs)) {
    for (const h of hoursArr) {
      shiftMs[shiftName] += hourly[h].ms;
      shifts[shiftName].sessions += hourly[h].sessions;
    }
    shifts[shiftName].hours = Number((shiftMs[shiftName] / 3600000).toFixed(2));
  }

  let dominantShift = 'manha';
  let maxShiftMs = -1;
  for (const key of ['manha', 'tarde', 'noite', 'madrugada']) {
    if (shiftMs[key] > maxShiftMs) {
      maxShiftMs = shiftMs[key];
      dominantShift = key;
    }
  }

  // Exact 100.0% shift percentage distribution
  if (totalDurationMs > 0) {
    let roundedSum = 0;
    for (const key of ['madrugada', 'manha', 'tarde', 'noite']) {
      const p = Number(((shiftMs[key] / totalDurationMs) * 100).toFixed(1));
      shifts[key].percentage = p;
      roundedSum += p;
    }
    const diff = Number((100.0 - roundedSum).toFixed(1));
    if (diff !== 0) {
      shifts[dominantShift].percentage = Number((shifts[dominantShift].percentage + diff).toFixed(1));
    }
  }

  // Weekday Ranking
  let totalWeeks = 1;
  if (earliestDate && latestDate) {
    const diffTime = latestDate.getTime() - earliestDate.getTime();
    totalWeeks = Math.max(1, Math.round(diffTime / (7 * 86400000)) + 1);
  }

  for (let i = 0; i < 7; i++) {
    const item = weekdayData[i];
    item.hours = Number((item.ms / 3600000).toFixed(2));
    item.percentage = totalDurationMs > 0 ? Number(((item.ms / totalDurationMs) * 100).toFixed(1)) : 0;
    item.activeDaysCount = item.activeDates.size;
    item.consistencyScore = (totalDurationMs > 0 && totalWeeks > 0)
      ? Number(Math.min(100, (item.activeDaysCount / totalWeeks) * 100).toFixed(1))
      : 0;
  }

  const sortedByVolume = [...weekdayData].sort((a, b) => b.hours - a.hours || b.sessions - a.sessions || a.dayIndex - b.dayIndex);
  sortedByVolume.forEach((item, index) => {
    item.volumeRank = index + 1;
  });

  const sortedByConsistency = [...weekdayData].sort((a, b) => b.consistencyScore - a.consistencyScore || b.hours - a.hours || a.dayIndex - b.dayIndex);
  sortedByConsistency.forEach((item, index) => {
    item.consistencyRank = index + 1;
  });

  const weekdayRanking = sortedByVolume.map(item => ({
    dayIndex: item.dayIndex,
    dayName: item.dayName,
    shortName: item.shortName,
    hours: item.hours,
    percentage: item.percentage,
    sessions: item.sessions,
    activeDaysCount: item.activeDaysCount,
    volumeRank: item.volumeRank,
    consistencyRank: item.consistencyRank,
    consistencyScore: item.consistencyScore
  }));

  return {
    hourly: hourly.map(h => ({
      hour: h.hour,
      label: h.label,
      ms: h.ms,
      hours: h.hours,
      percentage: h.percentage,
      sessions: h.sessions,
      questions: h.questions,
      correct: h.correct,
      accuracy: h.accuracy
    })),
    peakHour,
    shifts,
    dominantShift,
    weekdayRanking
  };
}

/**
 * 5. Yield Quadrant Matrix (Matriz de Quadrantes de Rendimento)
 */
export function computeYieldQuadrants(subjectsSummary = [], options = {}) {
  const accuracyCutoff = typeof options?.accuracyCutoff === 'number' ? options.accuracyCutoff : 75.0;

  const studied = (subjectsSummary || []).filter(s => {
    const h = typeof s.totalHours === 'number' ? s.totalHours : (s.durationMs ? s.durationMs / 3600000 : 0);
    return h > 0;
  });

  let medianHours = 20.0;
  if (typeof options?.customMedianHours === 'number' && options.customMedianHours > 0) {
    medianHours = options.customMedianHours;
  } else if (studied.length > 1) {
    const sortedHours = studied
      .map(s => typeof s.totalHours === 'number' ? s.totalHours : (s.durationMs / 3600000))
      .sort((a, b) => a - b);
    const mid = Math.floor(sortedHours.length / 2);
    if (sortedHours.length % 2 !== 0) {
      medianHours = sortedHours[mid];
    } else {
      medianHours = (sortedHours[mid - 1] + sortedHours[mid]) / 2;
    }
  } else if (studied.length === 1) {
    const h = typeof studied[0].totalHours === 'number' ? studied[0].totalHours : (studied[0].durationMs / 3600000);
    medianHours = h > 0 ? h : 20.0;
  }
  medianHours = Number(medianHours.toFixed(2));

  const quadrants = {
    pontosFortes: [],
    gargalosCriticos: [],
    baseSolida: [],
    zonaRisco: [],
    semExercicios: []
  };

  for (const s of (subjectsSummary || [])) {
    const hours = typeof s.totalHours === 'number' ? s.totalHours : (s.durationMs ? s.durationMs / 3600000 : 0);
    const q = s.questions || 0;
    const c = s.correct || 0;
    const acc = q > 0 ? (c / q) * 100 : null;

    const item = {
      id: s.id,
      name: s.name || `Matéria ${s.id}`,
      color: s.color || '#3b82f6',
      durationMs: s.durationMs || Math.round(hours * 3600000),
      totalHours: Number(hours.toFixed(2)),
      questions: q,
      correct: c,
      accuracy: acc !== null ? Number(acc.toFixed(1)) : null,
      quadrant: '',
      quadrantLabel: '',
      recommendation: ''
    };

    if (q === 0 || acc === null) {
      item.quadrant = 'semExercicios';
      item.quadrantLabel = 'Sem Exercícios';
      item.recommendation = 'Horas investidas sem validação por exercícios. Resolver questões imediatamente para calibrar a retenção.';
      quadrants.semExercicios.push(item);
    } else if (hours >= medianHours && acc >= accuracyCutoff) {
      item.quadrant = 'pontosFortes';
      item.quadrantLabel = 'Pontos Fortes';
      item.recommendation = 'Manter em regime de manutenção e simulados periódicos sem sobrecarregar a grade.';
      quadrants.pontosFortes.push(item);
    } else if (hours >= medianHours && acc < accuracyCutoff) {
      item.quadrant = 'gargalosCriticos';
      item.quadrantLabel = 'Gargalos Críticos';
      item.recommendation = 'Alerta de Método! Alto tempo dedicado, mas baixa assertividade. Interromper leitura passiva e focar em engenharia reversa de questões e cadernos de erros.';
      quadrants.gargalosCriticos.push(item);
    } else if (hours < medianHours && acc >= accuracyCutoff) {
      item.quadrant = 'baseSolida';
      item.quadrantLabel = 'Base Sólida';
      item.recommendation = 'Alta assertividade com baixo tempo acumulado. Excelente eficiência. Manter baterias curtas de fixação sem alocar horas excessivas.';
      quadrants.baseSolida.push(item);
    } else {
      item.quadrant = 'zonaRisco';
      item.quadrantLabel = 'Zona de Risco / Negligência';
      item.recommendation = 'Baixo tempo e baixa assertividade. Matéria vulnerável. Incluir com urgência no ciclo básico de estudos (teoria inicial + questões básicas).';
      quadrants.zonaRisco.push(item);
    }
  }

  return {
    medianHours,
    accuracyCutoff,
    quadrants,
    summary: {
      totalSubjects: (subjectsSummary || []).length,
      bottlenecksCount: quadrants.gargalosCriticos.length,
      strongCount: quadrants.pontosFortes.length
    }
  };
}

/**
 * 6. Methodological Mix Diagnostics
 */
export function computeMethodologicalMix(activities = []) {
  const groups = Object.fromEntries(groupByModality(activities).map(g => [g.key, g]));
  const teoriaMs = groups.teoria.durationMs;
  const questoesMs = groups.questoes.durationMs;
  const revisaoMs = groups.revisao.durationMs;
  const outrosMs = groups.outros.durationMs;

  const totalMs = teoriaMs + questoesMs + revisaoMs + outrosMs;
  const pTheory = totalMs > 0 ? (teoriaMs / totalMs) * 100 : 0;
  const pQuestions = totalMs > 0 ? (questoesMs / totalMs) * 100 : 0;
  const pReview = totalMs > 0 ? (revisaoMs / totalMs) * 100 : 0;
  const pOthers = totalMs > 0 ? (outrosMs / totalMs) * 100 : 0;

  const proportions = {
    teoria: { ms: teoriaMs, hours: Number((teoriaMs / 3600000).toFixed(2)), percentage: Number(pTheory.toFixed(1)) },
    questoes: { ms: questoesMs, hours: Number((questoesMs / 3600000).toFixed(2)), percentage: Number(pQuestions.toFixed(1)) },
    revisao: { ms: revisaoMs, hours: Number((revisaoMs / 3600000).toFixed(2)), percentage: Number(pReview.toFixed(1)) },
    outros: { ms: outrosMs, hours: Number((outrosMs / 3600000).toFixed(2)), percentage: Number(pOthers.toFixed(1)) }
  };

  const recommendations = [];

  if (totalMs === 0) {
    recommendations.push({
      severity: 'info',
      title: 'Sem Atividades Registradas',
      text: 'Nenhuma atividade de estudo encontrada para análise metodológica.'
    });
  } else {
    if (pQuestions < 25) {
      recommendations.push({
        severity: 'critical',
        title: 'Baixa Resolução de Questões',
        text: `Apenas ${formatNumber(pQuestions, 1)}% do seu tempo é dedicado a exercícios (mínimo recomendado: 40%). Aumente o treino prático para fixar pegadinhas de bancas.`
      });
    }

    if (pTheory > 60) {
      recommendations.push({
        severity: 'warning',
        title: 'Excesso de Teoria Passiva',
        text: `${formatNumber(pTheory, 1)}% do seu tempo está concentrado em teoria. Transite mais rapidamente para estudo ativo com questões intercaladas.`
      });
    }

    if (pReview < 10) {
      recommendations.push({
        severity: 'critical',
        title: 'Déficit de Revisão Espaçada',
        text: `Apenas ${formatNumber(pReview, 1)}% de tempo em revisões. A curva do esquecimento causará perda substancial de retenção. Adote revisões periódicas (24h, 7d, 30d).`
      });
    }

    if (pQuestions > 70 && pTheory < 15) {
      recommendations.push({
        severity: 'info',
        title: 'Risco de Platô por Falta de Base',
        text: `Treino de questões muito elevado (${formatNumber(pQuestions, 1)}%) sem fundamentação teórica (${formatNumber(pTheory, 1)}%). Tópicos doutrinários e jurisprudenciais complexos exigem retorno pontual à teoria.`
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        severity: 'success',
        title: 'Mix de Estudo Equilibrado',
        text: `Excelente harmonia metodológica: Teoria (${formatNumber(pTheory, 1)}%), Questões (${formatNumber(pQuestions, 1)}%) e Revisão (${formatNumber(pReview, 1)}%) estão em faixas ótimas de aprendizagem.`
      });
    }
  }

  return {
    proportions,
    recommendations
  };
}

/**
 * 7. Rule-Based Natural Language Synthesis (NLG)
 */
export function generateStudyInsights(metrics, patterns) {
  const hist = patterns?.history;
  const circ = patterns?.circadian;
  const quads = patterns?.quadrants?.quadrants;
  const cutoff = patterns?.quadrants?.accuracyCutoff ?? 75.0;
  const mixRecs = patterns?.mix?.recommendations || [];

  // 1. Resumo Executivo
  let executiveSummary = '';
  if (hist && hist.totalCumulativeHours > 0) {
    const currentYearData = hist.years?.find(y => y.isCurrentYear) || hist.years?.[hist.years.length - 1];
    const currentAccText = currentYearData?.accuracy !== null && currentYearData?.accuracy !== undefined
      ? `com ${formatValue(currentYearData.accuracy)}% de assertividade`
      : 'sem questões registradas';
    const peakText = hist.peakYear ? ` Pico histórico em ${hist.peakYear.year} com ${formatValue(hist.peakYear.hours)}h.` : '';
    executiveSummary = `No histórico multianual analisado (${hist.startYear}–${hist.endYear}), você registrou um acumulado de ${formatNumber(hist.totalCumulativeHours, 1)} horas líquidas distribuídas em ${formatNumber(hist.totalCumulativeSessions, 0)} sessões e ${formatNumber(hist.totalCumulativeQuestions, 0)} questões respondidas.${peakText} Em ${currentYearData ? currentYearData.year : 'atualmente'}, sua preparação encontra-se classificada como ${currentYearData ? currentYearData.phaseLabel : 'Indefinida'} (${formatValue(currentYearData ? currentYearData.totalHours : 0)}h realizadas ${currentAccText}).`;
  } else {
    executiveSummary = 'Nenhum histórico significativo de estudo registrado no período selecionado.';
  }

  // 2. Padrão Circadiano
  let circadianInsights = '';
  if (circ && circ.shifts) {
    const shiftNames = {
      madrugada: 'Madrugada (00h-06h)',
      manha: 'Manhã (06h-12h)',
      tarde: 'Tarde (12h-18h)',
      noite: 'Noite (18h-24h)'
    };
    const dom = circ.dominantShift || 'manha';
    const domName = shiftNames[dom] || dom;
    const domPct = circ.shifts[dom]?.percentage || 0;
    const peakH = circ.peakHour?.hour !== undefined ? `${String(circ.peakHour.hour).padStart(2, '0')}h` : '10h';
    circadianInsights = `Seu estudo se concentra predominantemente no turno da ${domName} (${formatValue(domPct)}%), com pico horário às ${peakH}. Alinhe suas sessões de maior esforço cognitivo a esse intervalo de maior foco biológico.`;
  } else {
    circadianInsights = 'Padrão circadiano não disponível.';
  }

  // 3. Cadência Semanal
  let weeklyCadenceInsights = '';
  const weekly = circ?.weekdayRanking;
  if (Array.isArray(weekly) && weekly.length > 0) {
    const bestDay = weekly[0];
    const weakestDay = weekly[weekly.length - 1];
    weeklyCadenceInsights = `${bestDay.dayName} lidera seu volume semanal com ${formatValue(bestDay.hours)}h acumuladas (${formatValue(bestDay.percentage)}% do tempo), enquanto ${weakestDay.dayName} registra a menor dedicação (${formatValue(weakestDay.hours)}h). Consistência de presença no melhor dia: ${formatValue(bestDay.consistencyScore)}%.`;
  } else {
    weeklyCadenceInsights = 'Dados de cadência semanal insuficientes.';
  }

  // 4. Quadrantes de Rendimento
  let quadrantInsights = '';
  const parts = [];
  if (quads?.pontosFortes?.length) {
    const names = quads.pontosFortes.map(s => s.name).slice(0, 3).join(', ');
    parts.push(`${names} consolidam seus principais pontos fortes (${quads.pontosFortes.length} matéria(s) com alto tempo e assertividade ≥${formatValue(cutoff)}%).`);
  }
  if (quads?.gargalosCriticos?.length) {
    const names = quads.gargalosCriticos.map(s => s.name).slice(0, 3).join(', ');
    parts.push(`Atenção aos gargalos críticos: ${names} demandam revisão urgente de metodologia por apresentarem alto tempo com assertividade inferior à meta.`);
  }
  if (quads?.zonaRisco?.length) {
    const names = quads.zonaRisco.map(s => s.name).slice(0, 3).join(', ');
    parts.push(`Na zona de risco: ${names} necessitam de inclusão prioritária no ciclo básico de estudos.`);
  }
  if (quads?.baseSolida?.length) {
    const names = quads.baseSolida.map(s => s.name).slice(0, 3).join(', ');
    parts.push(`Base sólida comprovada em ${names}, mantendo alta assertividade com baixo custo de tempo.`);
  }
  if (quads?.semExercicios?.length) {
    const names = quads.semExercicios.map(s => s.name).slice(0, 3).join(', ');
    parts.push(`Matérias sem exercícios: ${names} requerem resolução imediata de questões para calibragem.`);
  }
  quadrantInsights = parts.length > 0 ? parts.join(' ') : 'Sem matérias suficientes para análise de quadrantes.';

  // 5. Recomendações Metodológicas
  const methodRecommendations = mixRecs.map(r => `${severityLabel(r.severity)}: ${r.title}. ${r.text}`);

  // 6. Tamanho de sessão
  const sess = patterns?.sessions;
  let sessionInsights = 'Sessões insuficientes para análise de duração.';
  if (sess && sess.totalSessions > 0) {
    const sessionParts = [`Sua sessão típica dura ${sess.medianMinutes} min (mediana); 10% das sessões passam de ${sess.p90Minutes} min.`];
    if (sess.dominantBucket) sessionParts.push(`A faixa mais frequente é ${sess.dominantBucket.label} (${formatValue(sess.dominantBucket.percentage)}% das sessões).`);
    if (sess.idealBucket) sessionParts.push(`Sessões de ${sess.idealBucket.label} têm a melhor assertividade (${formatValue(sess.idealBucket.accuracy)}%).`);
    if (sess.trend && sess.trend.direction !== 'estavel') {
      sessionParts.push(`Desde ${sess.trend.fromYear}, suas sessões ficaram ${sess.trend.direction === 'mais_longas' ? 'mais longas' : 'mais curtas'} (${sess.trend.deltaMinutes > 0 ? '+' : ''}${sess.trend.deltaMinutes} min na mediana).`);
    }
    sessionInsights = sessionParts.join(' ');
  }

  // 7. Horário mais eficiente
  const eff = patterns?.efficiency;
  const slots = patterns?.hourWeekday?.topSlots || [];
  let efficiencyInsights = 'Questões insuficientes para comparar assertividade por horário.';
  if (eff?.mostEfficientHour) {
    const effParts = [`Sua melhor assertividade acontece às ${eff.mostEfficientHour.label} (${formatValue(eff.mostEfficientHour.accuracy)}%).`];
    if (eff.volumePeakHour && eff.volumePeakHour.hour !== eff.mostEfficientHour.hour && eff.gapPoints !== null) {
      effParts.push(`Você estuda mais às ${eff.volumePeakHour.label}, onde acerta ${formatValue(eff.gapPoints)} p.p. a menos.`);
    }
    efficiencyInsights = effParts.join(' ');
  }
  if (eff?.mostEfficientShift) {
    efficiencyInsights += ` Por turno, a ${eff.mostEfficientShift.label} lidera com ${formatValue(eff.mostEfficientShift.accuracy)}%.`;
  }
  if (slots.length) {
    efficiencyInsights += ` Horários mais frequentes: ${slots.map(sl => sl.label).join('; ')}.`;
  }

  // 8. Melhor semestre e ano
  const sem = patterns?.semesters;
  let periodInsights = 'Histórico insuficiente para comparar semestres.';
  if (sem?.semesterHighlights?.overallBest) {
    const h = sem.semesterHighlights;
    const periodParts = [`Seu melhor semestre no conjunto foi ${formatPeriodLabel(h.overallBest.label)} (${formatValue(h.overallBest.totalHours)}h, ${formatValue(h.overallBest.consistency)}% dos dias com estudo${h.overallBest.accuracy !== null ? `, ${formatValue(h.overallBest.accuracy)}% de acertos` : ''}).`];
    if (h.bestByHours && h.bestByHours !== h.overallBest) periodParts.push(`Maior volume: ${formatPeriodLabel(h.bestByHours.label)} (${formatValue(h.bestByHours.totalHours)}h).`);
    if (h.bestByAccuracy && h.bestByAccuracy !== h.overallBest) periodParts.push(`Maior assertividade: ${formatPeriodLabel(h.bestByAccuracy.label)} (${formatValue(h.bestByAccuracy.accuracy)}%).`);
    if (sem.yearHighlights?.overallBest) periodParts.push(`Melhor ano no conjunto: ${sem.yearHighlights.overallBest.label}.`);
    periodInsights = periodParts.join(' ');
  }

  // Texto formatado completo
  const fullFormattedText = [
    `## Síntese de Padrões Históricos de Estudo`,
    ``,
    `### 1. Resumo Executivo`,
    executiveSummary,
    ``,
    `### 2. Horário de estudo`,
    circadianInsights,
    ``,
    `### 3. Consistência e Cadência Semanal`,
    weeklyCadenceInsights,
    ``,
    `### 4. Diagnóstico dos Quadrantes de Rendimento`,
    quadrantInsights,
    ``,
    `### 5. Recomendações do Mix Metodológico`,
    methodRecommendations.length ? methodRecommendations.map(r => `- ${r}`).join('\n') : '- Nenhuma recomendação necessária.',
    ``,
    `### 6. Tamanho de Sessão`,
    sessionInsights,
    ``,
    `### 7. Horário Mais Eficiente`,
    efficiencyInsights,
    ``,
    `### 8. Melhor Semestre e Ano`,
    periodInsights
  ].join('\n');

  return {
    executiveSummary,
    circadianInsights,
    weeklyCadenceInsights,
    quadrantInsights,
    methodRecommendations,
    sessionInsights,
    efficiencyInsights,
    periodInsights,
    fullFormattedText
  };
}

/* ==========================================================================
 * Session size, hour × weekday, hourly efficiency and semester ranking
 * ========================================================================== */

// Minimum answered questions before an accuracy value is trusted for ranking.
export const MIN_QUESTIONS_FOR_ACCURACY = 50;

const WEEKDAY_LABELS = [
  { name: 'Domingo', short: 'Dom' },
  { name: 'Segunda-feira', short: 'Seg' },
  { name: 'Terça-feira', short: 'Ter' },
  { name: 'Quarta-feira', short: 'Qua' },
  { name: 'Quinta-feira', short: 'Qui' },
  { name: 'Sexta-feira', short: 'Sex' },
  { name: 'Sábado', short: 'Sáb' }
];

const SESSION_BUCKETS = [
  { key: 'lt15', label: '<15m', minMin: 0, maxMin: 15 },
  { key: '15_30', label: '15–30m', minMin: 15, maxMin: 30 },
  { key: '30_60', label: '30–60m', minMin: 30, maxMin: 60 },
  { key: '60_90', label: '1–1,5h', minMin: 60, maxMin: 90 },
  { key: '90_120', label: '1,5–2h', minMin: 90, maxMin: 120 },
  { key: 'gt120', label: '>2h', minMin: 120, maxMin: Infinity }
];

function accuracyOf(questions, correct) {
  return questions > 0 ? Number(((correct / questions) * 100).toFixed(1)) : null;
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1));
  return sortedValues[idx];
}

function median(sortedValues) {
  if (!sortedValues.length) return 0;
  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 ? sortedValues[mid] : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
}

/**
 * 9. Session length profile: how long sessions are and which length performs best.
 */
export function computeSessionLengthProfile(activities = [], options = {}) {
  const minQuestions = options?.minQuestions ?? MIN_QUESTIONS_FOR_ACCURACY;
  const buckets = SESSION_BUCKETS.map(b => ({
    key: b.key, label: b.label, minMin: b.minMin, maxMin: b.maxMin,
    sessions: 0, ms: 0, hours: 0, percentage: 0, hoursPercentage: 0,
    questions: 0, correct: 0, accuracy: null, reliable: false
  }));

  const durations = [];
  const byYear = new Map();
  let longest = null;
  let totalMs = 0;

  for (const atv of (activities || [])) {
    const ms = positiveDurationMs(atv?.Duracao);
    if (ms <= 0) continue;
    const minutes = ms / 60000;
    const bucket = buckets.find(b => minutes >= b.minMin && minutes < b.maxMin) || buckets[buckets.length - 1];
    const q = atv.ExercicioQuantidade || 0;
    const c = atv.ExercicioAcerto || 0;
    bucket.sessions += 1;
    bucket.ms += ms;
    bucket.questions += q;
    bucket.correct += c;
    durations.push(ms);
    totalMs += ms;

    const d = parseActivityDate(atv);
    if (d) {
      const y = d.getFullYear();
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(ms);
    }
    if (!longest || ms > longest.ms) {
      longest = {
        ms,
        formatted: formatDurationMs(ms),
        date: d ? formatLocalDate(d) : null,
        subject: atv.Materia?.Nome || null
      };
    }
  }

  const totalSessions = durations.length;
  for (const b of buckets) {
    b.hours = Number((b.ms / 3600000).toFixed(2));
    b.percentage = totalSessions > 0 ? Number(((b.sessions / totalSessions) * 100).toFixed(1)) : 0;
    b.hoursPercentage = totalMs > 0 ? Number(((b.ms / totalMs) * 100).toFixed(1)) : 0;
    b.accuracy = accuracyOf(b.questions, b.correct);
    b.reliable = b.questions >= minQuestions;
  }

  durations.sort((a, b) => a - b);
  const medianMs = median(durations);
  const meanMs = totalSessions > 0 ? totalMs / totalSessions : 0;
  const p90Ms = percentile(durations, 90);

  let idealBucket = null;
  for (const b of buckets) {
    if (!b.reliable || b.accuracy === null) continue;
    if (!idealBucket || b.accuracy > idealBucket.accuracy) {
      idealBucket = { key: b.key, label: b.label, accuracy: b.accuracy, questions: b.questions, sessions: b.sessions };
    }
  }

  const dominantBucket = totalSessions > 0
    ? [...buckets].sort((a, b) => b.sessions - a.sessions || b.ms - a.ms)[0]
    : null;

  const medianByYear = Array.from(byYear.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, list]) => {
      const sorted = [...list].sort((a, b) => a - b);
      const m = median(sorted);
      return { year, sessions: list.length, medianMs: m, medianMinutes: Math.round(m / 60000) };
    });

  let trend = null;
  if (medianByYear.length >= 2) {
    const first = medianByYear[0];
    const last = medianByYear[medianByYear.length - 1];
    const deltaMinutes = last.medianMinutes - first.medianMinutes;
    trend = {
      fromYear: first.year,
      toYear: last.year,
      deltaMinutes,
      direction: Math.abs(deltaMinutes) < 5 ? 'estavel' : (deltaMinutes > 0 ? 'mais_longas' : 'mais_curtas')
    };
  }

  return {
    totalSessions,
    minQuestions,
    buckets,
    medianMs,
    medianMinutes: Math.round(medianMs / 60000),
    meanMs,
    meanMinutes: Math.round(meanMs / 60000),
    p90Ms,
    p90Minutes: Math.round(p90Ms / 60000),
    longest,
    idealBucket,
    dominantBucket: dominantBucket ? { key: dominantBucket.key, label: dominantBucket.label, percentage: dominantBucket.percentage } : null,
    medianByYear,
    trend
  };
}

/**
 * 10. Hour × weekday matrix (7 rows × 24 columns).
 */
export function computeHourWeekdayMatrix(activities = []) {
  const cells = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => ({ day, hour, ms: 0, hours: 0, sessions: 0 }))
  );

  let totalMs = 0;
  for (const atv of (activities || [])) {
    const ms = positiveDurationMs(atv?.Duracao);
    if (ms <= 0) continue;
    const d = parseActivityDate(atv);
    if (!d) continue;
    const cell = cells[d.getDay()][parseActivityHour(atv)];
    cell.ms += ms;
    cell.sessions += 1;
    totalMs += ms;
  }

  let maxHours = 0;
  const flat = [];
  for (const row of cells) {
    for (const cell of row) {
      cell.hours = Number((cell.ms / 3600000).toFixed(2));
      if (cell.hours > maxHours) maxHours = cell.hours;
      if (cell.ms > 0) flat.push(cell);
    }
  }

  const topSlots = flat
    .sort((a, b) => b.ms - a.ms || b.sessions - a.sessions || a.day - b.day || a.hour - b.hour)
    .slice(0, 3)
    .map(c => ({
      day: c.day,
      hour: c.hour,
      dayName: WEEKDAY_LABELS[c.day].name,
      shortName: WEEKDAY_LABELS[c.day].short,
      label: `${WEEKDAY_LABELS[c.day].name}, ${String(c.hour).padStart(2, '0')}h`,
      hours: c.hours,
      sessions: c.sessions,
      percentage: totalMs > 0 ? Number(((c.ms / totalMs) * 100).toFixed(1)) : 0
    }));

  return {
    days: WEEKDAY_LABELS.map((w, i) => ({ dayIndex: i, name: w.name, short: w.short })),
    cells,
    maxHours,
    topSlots
  };
}

/**
 * 11. Hourly efficiency: where accuracy is highest, not just where volume is highest.
 */
export function computeHourlyEfficiency(circadian, options = {}) {
  const minQuestions = options?.minQuestions ?? MIN_QUESTIONS_FOR_ACCURACY;
  const hourly = Array.isArray(circadian?.hourly) ? circadian.hourly : [];

  const hours = hourly.map(h => {
    const questions = h.questions || 0;
    const correct = h.correct ?? (h.accuracy !== null && h.accuracy !== undefined ? Math.round((h.accuracy / 100) * questions) : 0);
    return {
      hour: h.hour,
      label: h.label,
      questions,
      correct,
      accuracy: accuracyOf(questions, correct),
      reliable: questions >= minQuestions
    };
  });

  let mostEfficientHour = null;
  for (const h of hours) {
    if (!h.reliable || h.accuracy === null) continue;
    if (!mostEfficientHour || h.accuracy > mostEfficientHour.accuracy) mostEfficientHour = h;
  }

  const shiftLabels = { madrugada: 'Madrugada', manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
  const shiftRanges = { madrugada: [0, 6], manha: [6, 12], tarde: [12, 18], noite: [18, 24] };
  const shifts = Object.entries(shiftRanges).map(([key, [from, to]]) => {
    let q = 0;
    let c = 0;
    for (const h of hours) {
      if (h.hour >= from && h.hour < to) { q += h.questions; c += h.correct; }
    }
    return { key, label: shiftLabels[key], questions: q, correct: c, accuracy: accuracyOf(q, c), reliable: q >= minQuestions };
  });

  let mostEfficientShift = null;
  for (const s of shifts) {
    if (!s.reliable || s.accuracy === null) continue;
    if (!mostEfficientShift || s.accuracy > mostEfficientShift.accuracy) mostEfficientShift = s;
  }

  const volumePeak = circadian?.peakHour && (circadian.peakHour.hours > 0)
    ? hours.find(h => h.hour === circadian.peakHour.hour) || null
    : null;

  let gapPoints = null;
  if (mostEfficientHour && volumePeak && volumePeak.reliable && volumePeak.accuracy !== null) {
    gapPoints = Number((mostEfficientHour.accuracy - volumePeak.accuracy).toFixed(1));
  }

  return {
    minQuestions,
    hours,
    shifts,
    mostEfficientHour,
    mostEfficientShift,
    volumePeakHour: volumePeak,
    gapPoints
  };
}

/**
 * 12. Semester (and year) ranking by volume, consistency and accuracy.
 */
function rankBy(list, valueFn) {
  const sorted = [...list].sort((a, b) => valueFn(b) - valueFn(a));
  const ranks = new Map();
  let rank = 0;
  sorted.forEach((item, idx) => {
    if (idx === 0 || valueFn(item) !== valueFn(sorted[idx - 1])) rank = idx + 1;
    ranks.set(item, rank);
  });
  return ranks;
}

function rankPeriods(periods, minQuestions) {
  if (!periods.length) {
    return { bestByHours: null, bestByConsistency: null, bestByAccuracy: null, overallBest: null };
  }
  const accuracyScore = p => (p.totalQuestions >= minQuestions && p.accuracy !== null ? p.accuracy : -1);
  const hoursRanks = rankBy(periods, p => p.totalHours);
  const consistencyRanks = rankBy(periods, p => p.consistency);
  const hasAccuracy = periods.some(p => accuracyScore(p) >= 0);
  const accuracyRanks = hasAccuracy ? rankBy(periods, accuracyScore) : null;

  for (const p of periods) {
    const ranks = [hoursRanks.get(p), consistencyRanks.get(p)];
    if (accuracyRanks) ranks.push(accuracyRanks.get(p));
    p.ranks = { hours: hoursRanks.get(p), consistency: consistencyRanks.get(p), accuracy: accuracyRanks ? accuracyRanks.get(p) : null };
    p.averageRank = Number((ranks.reduce((s, r) => s + r, 0) / ranks.length).toFixed(2));
  }

  const pick = (fn, valid = () => true) => {
    let best = null;
    for (const p of periods) {
      if (!valid(p)) continue;
      if (!best || fn(p, best)) best = p;
    }
    return best;
  };

  return {
    bestByHours: pick((a, b) => a.totalHours > b.totalHours),
    bestByConsistency: pick((a, b) => a.consistency > b.consistency),
    bestByAccuracy: pick((a, b) => a.accuracy > b.accuracy, p => accuracyScore(p) >= 0),
    overallBest: pick((a, b) => a.averageRank < b.averageRank || (a.averageRank === b.averageRank && a.totalHours > b.totalHours))
  };
}

function summarizePeriod(key, label, entries, startDate, endDate, now) {
  let totalMs = 0;
  let questions = 0;
  let correct = 0;
  const dates = new Set();
  for (const { atv, date } of entries) {
    const ms = positiveDurationMs(atv.Duracao);
    totalMs += ms;
    questions += atv.ExercicioQuantidade || 0;
    correct += atv.ExercicioAcerto || 0;
    if (ms > 0) dates.add(formatLocalDate(date));
  }
  const isCurrent = now >= startDate && now <= endDate;
  const effectiveEnd = isCurrent ? now : endDate;
  const start = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = Date.UTC(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), effectiveEnd.getDate());
  const elapsedDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
  return {
    key,
    label,
    isCurrent,
    totalMs,
    totalHours: Number((totalMs / 3600000).toFixed(1)),
    formattedDuration: formatDurationMs(totalMs),
    sessions: entries.length,
    activeDays: dates.size,
    elapsedDays,
    consistency: Number(Math.min(100, (dates.size / elapsedDays) * 100).toFixed(1)),
    longestStreak: calculateConsecutiveStreak(Array.from(dates).sort()),
    totalQuestions: questions,
    totalCorrect: correct,
    accuracy: accuracyOf(questions, correct)
  };
}

export function computeSemesterRanking(activities = [], options = {}) {
  const minQuestions = options?.minQuestions ?? MIN_QUESTIONS_FOR_ACCURACY;
  const now = options?.now ? new Date(options.now) : new Date();
  const semesterMap = new Map();
  const yearMap = new Map();

  for (const atv of (activities || [])) {
    const date = parseActivityDate(atv);
    if (!date) continue;
    const y = date.getFullYear();
    const half = date.getMonth() < 6 ? 1 : 2;
    const sKey = `${y}.${half}`;
    if (!semesterMap.has(sKey)) semesterMap.set(sKey, { year: y, half, entries: [] });
    semesterMap.get(sKey).entries.push({ atv, date });
    if (!yearMap.has(y)) yearMap.set(y, []);
    yearMap.get(y).push({ atv, date });
  }

  const semesters = Array.from(semesterMap.entries())
    .sort((a, b) => a[1].year - b[1].year || a[1].half - b[1].half)
    .map(([key, { year, half, entries }]) => {
      const start = new Date(year, half === 1 ? 0 : 6, 1);
      const end = new Date(year, half === 1 ? 5 : 11, half === 1 ? 30 : 31, 23, 59, 59, 999);
      return { year, half, ...summarizePeriod(key, `${year}.${half}`, entries, start, end, now) };
    })
    .filter(s => s.totalMs > 0 || s.totalQuestions > 0);

  const years = Array.from(yearMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, entries]) => ({
      year,
      ...summarizePeriod(String(year), String(year), entries, new Date(year, 0, 1), new Date(year, 11, 31, 23, 59, 59, 999), now)
    }))
    .filter(y => y.totalMs > 0 || y.totalQuestions > 0);

  return {
    minQuestions,
    semesters,
    years,
    semesterHighlights: rankPeriods(semesters, minQuestions),
    yearHighlights: rankPeriods(years, minQuestions)
  };
}

/**
 * 8. Master Historical Patterns Consolidator
 */
export function computeHistoricalPatterns(activities = [], materias = [], options = {}) {
  const startYear = options?.startYear ?? 2016;
  const endYear = options?.endYear ?? new Date().getFullYear();
  const heatmapYear = options?.heatmapYear ?? new Date().getFullYear();

  const history = computeMultiannualHistory(activities, startYear, endYear);
  const heatmap = computeActivityHeatmap(activities, heatmapYear);
  const circadian = computeCircadianDistribution(activities);

  // Extract or build subjectsSummary
  let subjectsSummary = options?.subjectsSummary;
  if (!subjectsSummary || !Array.isArray(subjectsSummary)) {
    const subjectMap = new Map();
    if (Array.isArray(materias)) {
      materias.forEach(m => {
        subjectMap.set(m.Id, {
          id: m.Id,
          name: m.Nome,
          color: m.Cor || '#3b82f6',
          durationMs: 0,
          totalHours: 0,
          questions: 0,
          correct: 0,
          accuracy: null
        });
      });
    }
    for (const atv of (activities || [])) {
      const mId = atv.Materia?.Id;
      if (mId) {
        if (!subjectMap.has(mId)) {
          subjectMap.set(mId, {
            id: mId,
            name: atv.Materia?.Nome || `Matéria ${mId}`,
            color: atv.Materia?.Cor || '#3b82f6',
            durationMs: 0,
            totalHours: 0,
            questions: 0,
            correct: 0,
            accuracy: null
          });
        }
        const s = subjectMap.get(mId);
        s.durationMs += (atv.Duracao || 0);
        s.questions += (atv.ExercicioQuantidade || 0);
        s.correct += (atv.ExercicioAcerto || 0);
      }
    }
    subjectsSummary = Array.from(subjectMap.values())
      .filter(s => s.durationMs > 0 || s.questions > 0)
      .map(s => ({
        ...s,
        totalHours: Number((s.durationMs / 3600000).toFixed(2)),
        accuracy: s.questions > 0 ? Number(((s.correct / s.questions) * 100).toFixed(1)) : null
      }));
  }

  const quadrants = computeYieldQuadrants(subjectsSummary, options);
  const mix = computeMethodologicalMix(activities);
  const metrics = typeof computeStudyMetrics === 'function' ? computeStudyMetrics(activities, materias) : null;
  const sessions = computeSessionLengthProfile(activities, options);
  const hourWeekday = computeHourWeekdayMatrix(activities);
  const efficiency = computeHourlyEfficiency(circadian, options);
  const semesters = computeSemesterRanking(activities, options);
  const insights = generateStudyInsights(metrics, { history, circadian, quadrants, mix, sessions, efficiency, semesters, hourWeekday });

  return {
    history,
    heatmap,
    circadian,
    quadrants,
    mix,
    sessions,
    hourWeekday,
    efficiency,
    semesters,
    insights
  };
}
