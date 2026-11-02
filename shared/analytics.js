/**
 * Study Analytics Engine for Aprovado Tools
 * Processes raw activities and generates comprehensive learning metrics.
 */

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
  if (!ms || ms <= 0) return '0.0h';
  const hours = (ms / (1000 * 60 * 60)).toFixed(1);
  return `${hours}h`;
}

export function parseDateString(str) {
  if (!str) return null;
  // Handle formats: "DD/MM/YYYY" or "YYYY-MM-DD" or ISO string
  if (str.includes('/')) {
    const [d, m, y] = str.split('/');
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  }
  return new Date(str);
}

export function filterActivitiesByPeriod(activities, period, customStart = null, customEnd = null) {
  if (!activities || !activities.length) return [];
  if (period === 'all') return activities;

  const now = new Date();
  let minDate = new Date();

  if (period === '7d') {
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
    minDate = new Date(customStart);
  }

  const maxDate = (period === 'custom' && customEnd) ? new Date(customEnd) : now;
  // End of day for maxDate
  maxDate.setHours(23, 59, 59, 999);
  minDate.setHours(0, 0, 0, 0);

  return activities.filter((item) => {
    const d = item.Inicio ? new Date(item.Inicio) : parseDateString(item.DataInicio);
    if (!d || isNaN(d.getTime())) return true;
    return d >= minDate && d <= maxDate;
  });
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
      const dateKey = d.toISOString().slice(0, 10);
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

function calculateStreak(sortedDateKeys) {
  if (!sortedDateKeys.length) return { current: 0, longest: 0 };

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  today.setDate(today.getDate() - 1);
  const yesterdayKey = today.toISOString().slice(0, 10);

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
      const key = checkDate.toISOString().slice(0, 10);
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
      const prev = new Date(sortedDateKeys[i - 1]);
      const curr = new Date(sortedDateKeys[i]);
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
