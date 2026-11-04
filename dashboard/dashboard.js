import { AprovadoApi } from '../shared/api.js';
import {
  computeStudyMetrics,
  filterActivitiesByPeriod,
  formatDurationMs,
  formatDurationHours,
  parseDateString,
  timelineRange,
  buildTimelineSeries,
  formatPeriodLabel,
  severityLabel,
  computeHistoricalPatterns,
  computeActivityHeatmap
} from '../shared/analytics.js';
import { AprovadoExport } from '../shared/export.js';
import { escapeHtml, sanitizeColor } from '../shared/ui.js';
import { formatNumber, formatValue, formatSyncLabel, getSnapshotSyncedAt } from '../shared/format.js';

let fullSnapshot = null;
let currentPeriod = 'all';
let selectedSubjectId = 'all';
let selectedStudyType = 'all';
let activitiesSearchQuery = '';
let currentPage = 1;
const PAGE_SIZE = 50;

let currentHeatmapYear = new Date().getFullYear();
let cachedHistoricalPatterns = null;
let cachedHistoricalActivities = null;
let cachedHistoricalMaterias = null;
let cachedHistoricalDate = null;

// DOM Elements
const loadingOverlay = document.getElementById('dashboard-loading');
const alertDisconnected = document.getElementById('alert-disconnected');

const userAvatar = document.getElementById('user-avatar');
const userDisplayName = document.getElementById('user-display-name');
const userStatusText = document.getElementById('user-status-text');
const btnSyncNow = document.getElementById('btn-sync-now');

const btnExportDropdown = document.getElementById('btn-export-dropdown');
const exportMenu = document.getElementById('export-menu');
const exportCsvActivities = document.getElementById('export-csv-activities');
const exportCsvSubjects = document.getElementById('export-csv-subjects');
const exportJsonBackup = document.getElementById('export-json-backup');
const exportCopyMd = document.getElementById('export-copy-md');
const copyReportTitle = document.getElementById('copy-report-title');

const segButtons = document.querySelectorAll('.filter-bar .seg-btn');
const filterBar = document.querySelector('.filter-bar');
const viewTabs = document.querySelectorAll('.view-tab');
const filterNote = document.getElementById('filter-note');
const mockBanner = document.getElementById('mock-banner');
const userBadge = document.getElementById('user-badge');
const footerSource = document.getElementById('footer-source');
const timelineCaption = document.getElementById('timeline-caption');
let currentView = 'overview';
let usingMockData = false;
let backgroundRefresh = false;
// Only the newest load may publish data, errors or loading state.
let loadGeneration = 0;

/* Sections and their addresses. Filter rules per section:
   - overview and activities: period, subject, modality and custom dates apply;
   - activity search: table only, plus filtered exports while that section is visible;
   - historical: always covers every record, so those filters stay visible but disabled. */
const VIEW_HASHES = { overview: '#visao-geral', historical: '#historico', activities: '#atividades' };
const FILTERED_VIEWS = ['overview', 'activities'];
let currentPeriodGranularity = 'semester';
const customDateContainer = document.getElementById('custom-date-container');
const inputDateStart = document.getElementById('input-date-start');
const inputDateEnd = document.getElementById('input-date-end');
const btnApplyCustomDates = document.getElementById('btn-apply-custom-dates');

const selectSubject = document.getElementById('select-subject');
const selectType = document.getElementById('select-type');

// KPIs
const dashTotalTime = document.getElementById('dash-total-time');
const dashTotalHoursDecimal = document.getElementById('dash-total-hours-decimal');
const dashTotalSessions = document.getElementById('dash-total-sessions');
const dashActiveDays = document.getElementById('dash-active-days');
const dashQuestionsAccuracy = document.getElementById('dash-questions-accuracy');
const dashQuestionsCounts = document.getElementById('dash-questions-counts');
const dashStreakCurrent = document.getElementById('dash-streak-current');
const dashStreakRecord = document.getElementById('dash-streak-record');
const dashAvgDaily = document.getElementById('dash-avg-daily');
const dashAvgSession = document.getElementById('dash-avg-session');

// Visuals
const dailyTimelineChart = document.getElementById('daily-timeline-chart');
const dashCicloPct = document.getElementById('dash-ciclo-pct');
const dashCicloFill = document.getElementById('dash-ciclo-fill');
const dashCicloHoursInfo = document.getElementById('dash-ciclo-hours-info');
const dashCicloList = document.getElementById('dash-ciclo-list');

const tbodySubjectsSummary = document.getElementById('tbody-subjects-summary');
const studyTypesList = document.getElementById('study-types-list');

const shiftMadrugada = document.getElementById('shift-madrugada');
const shiftManha = document.getElementById('shift-manha');
const shiftTarde = document.getElementById('shift-tarde');
const shiftNoite = document.getElementById('shift-noite');

// History Table
const activitiesCountCaption = document.getElementById('activities-count-caption');
const inputSearchActivities = document.getElementById('input-search-activities');
const tbodyActivitiesList = document.getElementById('tbody-activities-list');
const paginationInfo = document.getElementById('pagination-info');
const btnPagePrev = document.getElementById('btn-page-prev');
const btnPageNext = document.getElementById('btn-page-next');

async function loadMockSnapshot() {
  const mockUrl = window.chrome?.runtime?.getURL
    ? chrome.runtime.getURL('tests/fixtures/multiannual_mock_2016_2026.json')
    : '../tests/fixtures/multiannual_mock_2016_2026.json';
  const res = await fetch(mockUrl);
  if (!res.ok) {
    throw new Error(`Falha ao carregar fixture mock: status ${res.status}`);
  }
  return await res.json();
}

async function init() {
  const generation = ++loadGeneration;
  backgroundRefresh = false;
  btnSyncNow.disabled = false;
  setLoading(true);
  setupViewSwitch();
  setupPeriodRankingToggle();

  const isExplicitMock = window.location.search.includes('mock=true');
  const hasStorage = Boolean(window.chrome?.storage?.local);

  const isMock = isExplicitMock || !hasStorage;
  try {
    let snapshot;
    if (isMock) {
      snapshot = await loadMockSnapshot();
    } else {
      const auth = await AprovadoApi.checkAuth();
      if (generation !== loadGeneration) return;
      if (!auth.isAuthenticated) {
        showDisconnected();
        return;
      }
      // Show the cached snapshot of this account right away, then refresh in the background.
      snapshot = await AprovadoApi.loadSnapshotProgressive({
        onCached: cached => {
          if (generation !== loadGeneration) return;
          usingMockData = false;
          fullSnapshot = cached;
          backgroundRefresh = true;
          applySnapshot();
          setLoading(false);
        }
      });
    }

    if (generation !== loadGeneration) return;
    fullSnapshot = snapshot;
    usingMockData = isMock;
    backgroundRefresh = false;
    applySnapshot();
  } catch (err) {
    if (generation !== loadGeneration) return;
    backgroundRefresh = false;
    console.error('Falha ao inicializar dashboard:', err);
    showDisconnected();
  } finally {
    if (generation === loadGeneration) setLoading(false);
  }
}

function applySnapshot() {
  renderUserHeader(fullSnapshot.user);
  populateFilterSelects(fullSnapshot);
  updateDashboard();
  renderHistoricalPatternsTab(fullSnapshot.atividades, fullSnapshot.materias);
}

function setLoading(isLoading) {
  if (isLoading) {
    loadingOverlay.classList.remove('hidden');
  } else {
    loadingOverlay.classList.add('hidden');
  }
}

function showDisconnected() {
  // Failed authentication/sync must not leave the previous account's view usable.
  selectedSubjectId = 'all';
  selectedStudyType = 'all';
  activitiesSearchQuery = '';
  inputSearchActivities.value = '';
  currentPage = 1;
  fullSnapshot = { atividades: [], materias: [] };
  populateFilterSelects(fullSnapshot);
  updateDashboard();
  renderHistoricalPatternsTab([], []);
  fullSnapshot = null;
  cachedHistoricalPatterns = null;
  cachedHistoricalActivities = null;
  cachedHistoricalMaterias = null;
  cachedHistoricalDate = null;
  userAvatar.textContent = '';
  userDisplayName.textContent = '';
  btnExportDropdown.disabled = true;
  exportMenu.classList.add('hidden');
  const tooltip = document.getElementById('heatmap-tooltip');
  if (tooltip) {
    tooltip.innerHTML = '';
    tooltip.classList.add('hidden');
  }
  setView(currentView);
  alertDisconnected.classList.remove('hidden');
  userStatusText.textContent = 'Desconectado';
  userStatusText.style.color = '#ef4444';
}

function renderUserHeader(user) {
  btnExportDropdown.disabled = false;
  setView(currentView);
  alertDisconnected.classList.add('hidden');
  mockBanner?.classList.toggle('hidden', !usingMockData);
  userBadge?.classList.toggle('hidden', usingMockData);
  if (footerSource) footerSource.textContent = usingMockData
    ? 'Dados de exemplo carregados de um arquivo local'
    : 'Dados sincronizados localmente do AprovadoApp';
  if (!user || usingMockData) return;
  userAvatar.textContent = (user.Nome || 'E').charAt(0).toUpperCase();
  userDisplayName.textContent = `${user.Nome || ''} ${user.Sobrenome || ''}`.trim() || 'Estudante';
  renderSyncStatus();
  userStatusText.style.color = '#34d399';
}

/** Shows when the loaded snapshot was synchronized ("Atualizado há 3 min"); refreshed while the page is open. */
function renderSyncStatus() {
  if (usingMockData || !fullSnapshot) return;
  const label = formatSyncLabel(getSnapshotSyncedAt(fullSnapshot));
  userStatusText.textContent = backgroundRefresh ? `${label} · atualizando…` : label;
}
globalThis.setInterval?.(renderSyncStatus, 30000);

function populateFilterSelects(snapshot) {
  // Populate Subjects
  selectSubject.innerHTML = '<option value="all">Todas as matérias</option>';
  (snapshot.materias || []).forEach(m => {
    const opt = document.createElement('option');
    opt.value = String(m.Id);
    opt.textContent = m.Nome;
    selectSubject.appendChild(opt);
  });

  // Populate Types
  const typesSet = new Set();
  (snapshot.atividades || []).forEach(a => {
    if (a.TipoEstudo) typesSet.add(a.TipoEstudo.trim());
  });

  selectType.innerHTML = '<option value="all">Todas as modalidades</option>';
  Array.from(typesSet).sort().forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    selectType.appendChild(opt);
  });

  if (!(snapshot.materias || []).some(m => String(m.Id) === selectedSubjectId)) selectedSubjectId = 'all';
  if (!typesSet.has(selectedStudyType)) selectedStudyType = 'all';
  selectSubject.value = selectedSubjectId;
  selectType.value = selectedStudyType;
}

function getFilteredActivities({ searchQuery = '' } = {}) {
  if (!fullSnapshot || !fullSnapshot.atividades) return [];

  let list = filterActivitiesByPeriod(
    fullSnapshot.atividades,
    currentPeriod,
    inputDateStart.value,
    inputDateEnd.value
  );

  if (selectedSubjectId !== 'all') {
    const subIdNum = parseInt(selectedSubjectId, 10);
    list = list.filter(a => a.Materia?.Id === subIdNum);
  }

  if (selectedStudyType !== 'all') {
    list = list.filter(a => a.TipoEstudo?.trim().toLowerCase() === selectedStudyType.toLowerCase());
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(a => {
      const mat = (a.Materia?.Nome || '').toLowerCase();
      const cont = (a.Conteudo?.Nome || '').toLowerCase();
      const anot = (a.Anotacoes || '').toLowerCase();
      const tipo = (a.TipoEstudo || '').toLowerCase();
      return mat.includes(q) || cont.includes(q) || anot.includes(q) || tipo.includes(q);
    });
  }

  return list;
}

function getTableActivities() {
  return getFilteredActivities({ searchQuery: activitiesSearchQuery });
}

function getExportActivities() {
  // Never apply a table search that the user cannot see in the current section.
  return getFilteredActivities({ searchQuery: currentView === 'activities' ? activitiesSearchQuery : '' });
}

function updateDashboard() {
  if (!fullSnapshot) return;

  const filtered = getFilteredActivities();
  const metrics = computeStudyMetrics(
    filtered,
    fullSnapshot.materias,
    fullSnapshot.ciclo,
    fullSnapshot.revisoesPendentes
  );

  renderKpiBanner(metrics);
  renderDailyTimelineChart(metrics.dailyHistory);
  renderCicloCard(metrics.ciclo);
  renderSubjectsSummary(metrics.subjects);
  renderModalitiesAndShifts(metrics);
  renderActivitiesTable(getTableActivities());
}

function renderKpiBanner(metrics) {
  dashTotalTime.textContent = metrics.formattedTotalDuration;
  dashTotalHoursDecimal.textContent = `${metrics.formattedTotalHours} líquidas`;

  dashTotalSessions.textContent = formatNumber(metrics.totalSessions, 0);
  dashActiveDays.textContent = `${metrics.distinctDaysCount} dias com estudo`;

  if (metrics.totalQuestions > 0) {
    dashQuestionsAccuracy.textContent = `${formatNumber(Number(metrics.overallAccuracy), 1)}%`;
    dashQuestionsCounts.textContent = `${formatNumber(metrics.totalCorrect, 0)} acertos de ${formatNumber(metrics.totalQuestions, 0)} questões`;
  } else {
    dashQuestionsAccuracy.textContent = '—';
    dashQuestionsCounts.textContent = 'Nenhum exercício registrado';
  }

  dashStreakCurrent.textContent = `${metrics.streak.current} dias`;
  dashStreakRecord.textContent = `Recorde histórico: ${metrics.streak.longest} dias`;

  dashAvgDaily.textContent = metrics.avgDailyDuration;
  const avgSessionMs = metrics.totalSessions > 0 ? metrics.totalDurationMs / metrics.totalSessions : 0;
  dashAvgSession.textContent = `Média por sessão: ${formatDurationMs(avgSessionMs)}`;
}

const TIMELINE_CAPTIONS = {
  day: 'Horas líquidas por dia',
  week: 'Horas líquidas por semana (segunda a domingo)',
  month: 'Horas líquidas por mês'
};
const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function dayMonthLabel(key) {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

function timelineLabel(bucket, granularity) {
  if (granularity === 'month') {
    const [y, m] = bucket.key.split('-');
    return `${m}/${y.slice(2)}`;
  }
  return dayMonthLabel(bucket.start);
}

function timelineTooltip(bucket, granularity) {
  const [y, m, d] = bucket.start.split('-');
  const title = granularity === 'month' ? `${MONTH_NAMES[Number(m) - 1]} de ${y}`
    : granularity === 'week' ? `Semana de ${dayMonthLabel(bucket.start)} a ${dayMonthLabel(bucket.end)}`
      : `${d}/${m}/${y}`;
  if (bucket.sessions === 0 && bucket.ms === 0) return `${title}: sem estudo`;
  const parts = [`${formatValue(bucket.hours)}h`, `${formatNumber(bucket.sessions, 0)} ${bucket.sessions === 1 ? 'sessão' : 'sessões'}`];
  if (granularity !== 'day') parts.push(`${bucket.studyDays} ${bucket.studyDays === 1 ? 'dia' : 'dias'} com estudo`);
  if (bucket.questions) parts.push(`${formatNumber(bucket.questions, 0)} questões`);
  return `${title}: ${parts.join(' · ')}`;
}

/** Evolution chart for the selected period: day, week or month bars, with empty ones kept at zero. */
function renderDailyTimelineChart(dailyHistory) {
  dailyTimelineChart.innerHTML = '';

  if (!dailyHistory || dailyHistory.length === 0) {
    if (timelineCaption) timelineCaption.textContent = TIMELINE_CAPTIONS.day;
    dailyTimelineChart.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; margin: auto;">Nenhuma atividade no período selecionado.</div>';
    return;
  }

  const range = timelineRange(currentPeriod, dailyHistory, inputDateStart.value, inputDateEnd.value, new Date());
  const { granularity, buckets } = buildTimelineSeries(dailyHistory, range);
  const maxHours = Math.max(...buckets.map(b => b.hours), 0.1);
  if (timelineCaption) {
    timelineCaption.textContent = `${TIMELINE_CAPTIONS[granularity]} · maior barra: ${formatValue(maxHours)}h`;
  }

  // Label roughly twelve bars so the axis stays readable at any length.
  const labelStep = Math.max(1, Math.ceil(buckets.length / 12));
  buckets.forEach((bucket, index) => {
    const col = document.createElement('div');
    col.className = 'chart-bar-col';
    if (buckets.length > 60) col.style.minWidth = '6px';

    const bar = document.createElement('div');
    bar.className = bucket.hours > 0 ? 'chart-bar' : 'chart-bar is-empty';
    bar.style.height = bucket.hours > 0 ? `${Math.max(4, Math.round((bucket.hours / maxHours) * 160))}px` : '2px';
    bar.title = timelineTooltip(bucket, granularity);
    bar.setAttribute('aria-label', bar.title);

    const label = document.createElement('span');
    label.className = 'chart-bar-label';
    label.textContent = index % labelStep === 0 ? timelineLabel(bucket, granularity) : '';

    col.appendChild(bar);
    col.appendChild(label);
    dailyTimelineChart.appendChild(col);
  });
}

function renderCicloCard(ciclo) {
  if (!ciclo) {
    dashCicloPct.textContent = 'Não ativo';
    dashCicloFill.style.width = '0%';
    dashCicloHoursInfo.textContent = 'Ciclo de estudos não configurado no AprovadoApp';
    dashCicloList.innerHTML = '';
    return;
  }

  dashCicloPct.textContent = `${formatNumber(Number(ciclo.porcentagem), 1)}%`;
  dashCicloFill.style.width = `${Math.min(100, Math.max(0, parseFloat(ciclo.porcentagem)))}%`;

  const execHrs = Math.floor((ciclo.executadas || 0) / 3600);
  const totalHrs = Math.floor((ciclo.totalHoras || 0) / 3600);
  dashCicloHoursInfo.textContent = `${formatValue(execHrs)}h executadas de ${formatValue(totalHrs)}h previstas nesta rodada`;

  dashCicloList.innerHTML = '';
  (ciclo.materias || []).slice(0, 5).forEach(m => {
    const row = document.createElement('div');
    row.className = 'ciclo-row';
    const name = m.Nome || m.Materia?.Nome || 'Matéria';
    const hrs = m.HorasExecutadasTexto || `${Math.floor((m.HorasExecutadas || 0) / 3600)}h`;
    row.innerHTML = `
      <span>${escapeHtml(name)}</span>
      <span style="color: var(--text-muted); font-weight: 600;">${escapeHtml(hrs)}</span>
    `;
    dashCicloList.appendChild(row);
  });
}

function renderSubjectsSummary(subjects) {
  tbodySubjectsSummary.innerHTML = '';

  if (!subjects || subjects.length === 0) {
    tbodySubjectsSummary.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhuma matéria encontrada.</td></tr>';
    return;
  }

  subjects.forEach(s => {
    const tr = document.createElement('tr');

    let accBadge = '<span style="color: var(--text-muted);">—</span>';
    if (s.questions > 0) {
      const cls = s.accuracy >= 80 ? 'accuracy-high' : (s.accuracy >= 65 ? 'accuracy-mid' : 'accuracy-low');
      accBadge = `<span class="accuracy-badge ${cls}">${formatNumber(s.accuracy, 1)}%</span>`;
    }

    tr.innerHTML = `
      <td>
        <div class="subject-cell">
          <span class="subject-dot" style="background-color: ${sanitizeColor(s.color)};"></span>
          <span>${escapeHtml(s.name)}</span>
        </div>
      </td>
      <td><strong>${s.formattedHours}</strong></td>
      <td>${formatNumber(s.percentage, 1)}%</td>
      <td>${s.sessionsCount}</td>
      <td>${s.questions > 0 ? `${s.questions} (${s.correct} acertos)` : '—'}</td>
      <td>${accBadge}</td>
    `;
    tbodySubjectsSummary.appendChild(tr);
  });
}

function renderModalitiesAndShifts(metrics) {
  // Same four modalities as the methodological mix, so Teoria matches in both places.
  studyTypesList.innerHTML = '';
  (metrics.modalities || []).forEach(t => {
    const row = document.createElement('div');
    row.className = 'type-row';
    row.innerHTML = `
      <div class="type-info">
        <strong>${escapeHtml(t.name)}</strong>
        <span style="color: var(--text-muted);">${t.formattedDuration} (${formatNumber(t.percentage, 1)}%)</span>
      </div>
      <div class="progress-bar-bg" style="height: 5px;">
        <div class="progress-bar-fill" style="width: ${t.percentage}%;"></div>
      </div>
    `;
    studyTypesList.appendChild(row);
  });

  // Shifts
  shiftMadrugada.textContent = metrics.periodDistribution.madrugada.formatted;
  shiftManha.textContent = metrics.periodDistribution.manha.formatted;
  shiftTarde.textContent = metrics.periodDistribution.tarde.formatted;
  shiftNoite.textContent = metrics.periodDistribution.noite.formatted;
}

/** Start time in ms, so the activity list can show the most recent sessions first. */
function activityStartTime(activity) {
  const date = parseDateString(activity.DataInicio);
  if (!date) return 0;
  const [hours = 0, minutes = 0] = String(activity.HoraInicio || '').split(':').map(Number);
  return date.getTime() + ((hours || 0) * 60 + (minutes || 0)) * 60000;
}

function renderActivitiesTable(unsortedActivities) {
  const activities = [...unsortedActivities].sort((a, b) => activityStartTime(b) - activityStartTime(a));
  activitiesCountCaption.textContent = `${activities.length} atividades no filtro atual`;

  const totalPages = Math.ceil(activities.length / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const pageItems = activities.slice(startIdx, endIdx);

  tbodyActivitiesList.innerHTML = '';
  if (pageItems.length === 0) {
    tbodyActivitiesList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhuma atividade encontrada com os filtros selecionados.</td></tr>';
  } else {
    pageItems.forEach(a => {
      const tr = document.createElement('tr');
      const durText = a.DuracaoTexto || formatDurationMs(a.Duracao);
      const questionsText = a.ExercicioQuantidade > 0
        ? `${a.ExercicioAcerto}/${a.ExercicioQuantidade} (${formatNumber(((a.ExercicioAcerto / a.ExercicioQuantidade) * 100), 0)}%)`
        : '—';

      tr.innerHTML = `
        <td>${escapeHtml(a.DataInicio || '—')}</td>
        <td style="color: var(--text-muted);">${escapeHtml(a.HoraInicio || '—')}</td>
        <td>
          <div class="subject-cell">
            <span class="subject-dot" style="background-color: ${sanitizeColor(a.Materia?.Cor)};"></span>
            <span>${escapeHtml(a.Materia?.Nome || '—')}</span>
          </div>
        </td>
        <td>${a.Conteudo?.Nome ? escapeHtml(a.Conteudo.Nome) : '<span style="color: var(--text-faint);">Geral</span>'}</td>
        <td><span class="badge-tag">${escapeHtml(a.TipoEstudo || 'Manual')}</span></td>
        <td><strong>${escapeHtml(durText)}</strong></td>
        <td>${questionsText}</td>
        <td style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-muted);" title="${escapeHtml(a.Anotacoes || '')}">${escapeHtml(a.Anotacoes || '—')}</td>
      `;
      tbodyActivitiesList.appendChild(tr);
    });
  }

  // Update Pagination Controls
  paginationInfo.textContent = `Mostrando ${activities.length === 0 ? 0 : startIdx + 1} a ${Math.min(endIdx, activities.length)} de ${activities.length}`;
  btnPagePrev.disabled = currentPage <= 1;
  btnPageNext.disabled = currentPage >= totalPages;
}

// Event Listeners
segButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    segButtons.forEach(b => b.classList.toggle('active', b === btn));
    currentPeriod = btn.dataset.period;

    if (currentPeriod === 'custom') {
      customDateContainer.classList.remove('hidden');
    } else {
      customDateContainer.classList.add('hidden');
      currentPage = 1;
      updateDashboard();
    }
  });
});

btnApplyCustomDates.addEventListener('click', () => {
  currentPage = 1;
  updateDashboard();
});

selectSubject.addEventListener('change', (e) => {
  selectedSubjectId = e.target.value;
  currentPage = 1;
  updateDashboard();
});

selectType.addEventListener('change', (e) => {
  selectedStudyType = e.target.value;
  currentPage = 1;
  updateDashboard();
});

inputSearchActivities.addEventListener('input', (e) => {
  activitiesSearchQuery = e.target.value;
  currentPage = 1;
  renderActivitiesTable(getTableActivities());
});

btnPagePrev.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderActivitiesTable(getTableActivities());
  }
});

btnPageNext.addEventListener('click', () => {
  currentPage++;
  renderActivitiesTable(getTableActivities());
});

btnSyncNow.addEventListener('click', async () => {
  const generation = ++loadGeneration;
  backgroundRefresh = false;
  btnSyncNow.disabled = true;
  setLoading(true);
  try {
    const isExplicitMock = window.location.search.includes('mock=true');
    const hasStorage = Boolean(window.chrome?.storage?.local);
    const isMock = isExplicitMock || !hasStorage;
    const snapshot = isMock
      ? await loadMockSnapshot()
      : await AprovadoApi.fetchCompleteSnapshot(true);
    if (generation !== loadGeneration) return;
    fullSnapshot = snapshot;
    usingMockData = isMock;
    backgroundRefresh = false;
    applySnapshot();
  } catch (err) {
    if (generation !== loadGeneration) return;
    backgroundRefresh = false;
    console.error('Erro na sincronização:', err);
    showDisconnected();
  } finally {
    if (generation === loadGeneration) {
      btnSyncNow.disabled = false;
      setLoading(false);
    }
  }
});

// Dropdown Handling
btnExportDropdown.addEventListener('click', (e) => {
  e.stopPropagation();
  exportMenu.classList.toggle('hidden');
});

document.addEventListener('click', () => {
  exportMenu.classList.add('hidden');
});

exportCsvActivities.addEventListener('click', () => {
  if (!fullSnapshot) return;
  const filtered = getExportActivities();
  AprovadoExport.exportActivitiesCSV(filtered);
});

exportCsvSubjects.addEventListener('click', () => {
  if (!fullSnapshot) return;
  const filtered = getExportActivities();
  const metrics = computeStudyMetrics(filtered, fullSnapshot.materias);
  AprovadoExport.exportSubjectsSummaryCSV(metrics.subjects);
});

exportJsonBackup.addEventListener('click', () => {
  if (!fullSnapshot) return;
  AprovadoExport.exportFullBackupJSON(fullSnapshot);
});

exportCopyMd.addEventListener('click', async () => {
  if (!fullSnapshot) return;
  const filtered = getExportActivities();
  const metrics = computeStudyMetrics(
    filtered,
    fullSnapshot.materias,
    fullSnapshot.ciclo,
    fullSnapshot.revisoesPendentes
  );
  try {
    await AprovadoExport.copyReportToClipboard(metrics, fullSnapshot.user);
    copyReportTitle.textContent = 'Relatório Copiado! ✓';
  } catch (err) {
    console.error('Falha ao copiar:', err);
    copyReportTitle.textContent = 'Falha ao copiar. Tente novamente.';
  }
  setTimeout(() => {
    copyReportTitle.textContent = 'Copiar Relatório (Markdown)';
  }, 2000);
});

/* ==========================================================================
   Tab Navigation & Historical Patterns Renderers
   ========================================================================== */

function viewFromHash(hash = window.location.hash) {
  const wanted = String(hash || '').toLowerCase();
  const match = Object.entries(VIEW_HASHES).find(([, value]) => value === wanted);
  return match ? match[0] : 'overview';
}

// Shows one section and keeps the tab bar and the filters in sync with it.
function setView(view) {
  currentView = VIEW_HASHES[view] ? view : 'overview';
  const filtersApply = FILTERED_VIEWS.includes(currentView);

  [['overview', 'tab-overview'], ['historical', 'tab-historical-patterns'], ['activities', 'tab-activities']].forEach(([name, id]) => {
    const pane = document.getElementById(id);
    pane?.classList.toggle('hidden', !fullSnapshot || currentView !== name);
    pane?.classList.toggle('active', currentView === name);
  });

  viewTabs.forEach(tab => {
    const selected = tab.dataset.view === currentView;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.setAttribute('tabindex', selected ? '0' : '-1');
    tab.setAttribute('aria-current', selected ? 'page' : 'false');
  });

  segButtons.forEach(b => {
    b.classList.toggle('active', b.dataset.period === currentPeriod);
    b.disabled = !filtersApply;
  });
  [selectSubject, selectType, inputDateStart, inputDateEnd, btnApplyCustomDates].forEach(control => { control.disabled = !filtersApply; });
  filterBar?.querySelectorAll('[data-filter-scope]').forEach(el => {
    el.classList.toggle('is-disabled', !filtersApply);
    el.setAttribute('aria-disabled', filtersApply ? 'false' : 'true');
  });
  filterNote?.classList.toggle('hidden', filtersApply);
  customDateContainer.classList.toggle('hidden', currentPeriod !== 'custom');

  if (currentView === 'historical' && fullSnapshot) {
    renderHistoricalPatternsTab(fullSnapshot.atividades, fullSnapshot.materias);
  }
}

// Clicking a tab changes the address, so Back/Forward and shared links reach the same section.
function navigateToView(view) {
  setView(view);
  const hash = VIEW_HASHES[currentView];
  if (window.location.hash !== hash) window.location.hash = hash;
}

function setupViewSwitch() {
  setView(viewFromHash());
  const order = Array.from(viewTabs);
  order.forEach((tab, index) => {
    tab.addEventListener('click', () => navigateToView(tab.dataset.view));
    tab.addEventListener('keydown', event => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      const target = event.key === 'Home' ? order[0] : event.key === 'End' ? order[order.length - 1]
        : step ? order[(index + step + order.length) % order.length] : null;
      if (!target) return;
      event.preventDefault?.();
      navigateToView(target.dataset.view);
      target.focus?.();
    });
  });
  window.addEventListener('hashchange', () => setView(viewFromHash()));
}

function setupPeriodRankingToggle() {
  const toggle = document.getElementById('period-ranking-toggle');
  if (!toggle) return;
  toggle.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPeriodGranularity = btn.dataset.granularity === 'year' ? 'year' : 'semester';
      toggle.querySelectorAll('.seg-btn').forEach(b => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      renderPeriodRanking(cachedHistoricalPatterns?.semesters);
    });
  });
}

function renderHistoricalPatternsTab(activities = [], materias = []) {
  const now = new Date();
  const year = now.getFullYear();
  const dateKey = `${year}-${now.getMonth()}-${now.getDate()}`;
  if (cachedHistoricalPatterns && cachedHistoricalActivities === activities
      && cachedHistoricalMaterias === materias && cachedHistoricalDate === dateKey) return;

  cachedHistoricalActivities = activities;
  cachedHistoricalMaterias = materias;
  cachedHistoricalDate = dateKey;
  const patterns = computeHistoricalPatterns(activities, materias, { endYear: year, heatmapYear: currentHeatmapYear });
  cachedHistoricalPatterns = patterns;

  renderExecutiveSummaryMetrics(patterns.history);
  renderHistoricalConclusions(patterns);
  renderPeriodRanking(patterns.semesters);
  renderMultiannualCards(patterns.history);
  setupHeatmapControls(activities, patterns.history);
  renderCircadian(patterns.circadian);
  renderEfficiencyNote(patterns.efficiency);
  renderHourWeekdayHeatmap(patterns.hourWeekday);
  renderSessionProfile(patterns.sessions);
  renderQuadrants(patterns.quadrants);
  renderMixAndInsights(patterns.mix, patterns.insights);
}

/** Three plain-language takeaways at the top of the historical analysis. */
function renderHistoricalConclusions(patterns) {
  const list = document.getElementById('hist-conclusions-list');
  if (!list) return;
  const history = patterns.history;
  const efficiency = patterns.efficiency;
  const quadrants = patterns.quadrants?.quadrants;
  const items = [];

  const peak = history?.peakYear;
  const peakYear = peak ? history.years.find(y => y.year === peak.year) : null;
  items.push({
    title: 'Seu melhor ano',
    headline: peak ? String(peak.year) : 'Sem registros',
    text: peak
      ? `Foram ${formatNumber(peak.hours, 1)}h líquidas${peakYear ? ` em ${formatNumber(peakYear.activeDaysCount, 0)} dias com estudo` : ''}${peakYear && peakYear.accuracy !== null ? `, com ${formatNumber(peakYear.accuracy, 1)}% de assertividade` : ''}.`
      : 'Estude e sincronize para ver qual ano rendeu mais.'
  });

  const best = efficiency?.mostEfficientHour;
  const volumePeak = efficiency?.volumePeakHour;
  items.push({
    title: 'Horário em que você mais acerta',
    headline: best ? best.label : 'Ainda sem horário',
    text: best
      ? `${formatNumber(best.accuracy, 1)}% de assertividade em ${formatNumber(best.questions, 0)} questões${volumePeak && volumePeak.hour !== best.hour ? `. Você estuda mais às ${volumePeak.label}.` : '.'}`
      : `A assertividade por horário aparece quando um horário soma ${formatNumber(efficiency?.minQuestions ?? 50, 0)} questões ou mais.`
  });

  const byAccuracy = (a, b) => a.accuracy - b.accuracy;
  const bottleneck = quadrants ? [...quadrants.gargalosCriticos].sort(byAccuracy)[0] : null;
  const risk = quadrants ? [...quadrants.zonaRisco].sort(byAccuracy)[0] : null;
  const noExercises = quadrants ? [...quadrants.semExercicios].sort((a, b) => b.totalHours - a.totalHours)[0] : null;
  const cutoff = patterns.quadrants ? formatNumber(patterns.quadrants.accuracyCutoff, 0) : '';
  let attention;
  if (bottleneck) {
    attention = { headline: bottleneck.name, text: `${formatNumber(bottleneck.totalHours, 1)}h estudadas e ${formatNumber(bottleneck.accuracy, 1)}% de assertividade, abaixo do corte de ${cutoff}%. Vale trocar leitura por questões.` };
  } else if (risk) {
    attention = { headline: risk.name, text: `Pouco tempo (${formatNumber(risk.totalHours, 1)}h) e ${formatNumber(risk.accuracy, 1)}% de assertividade. Falta base.` };
  } else if (noExercises) {
    attention = { headline: noExercises.name, text: `${formatNumber(noExercises.totalHours, 1)}h estudadas e nenhuma questão registrada. Resolva questões para medir o rendimento.` };
  } else {
    attention = { headline: 'Nenhuma por enquanto', text: 'Nenhuma matéria combina muito tempo com assertividade baixa.' };
  }
  items.push({ title: 'Matéria que pede atenção', ...attention });

  list.innerHTML = items.map(item => `
    <div class="hist-conclusion">
      <span class="hist-conclusion-title">${escapeHtml(item.title)}</span>
      <strong class="hist-conclusion-headline" title="${escapeHtml(item.headline)}">${escapeHtml(item.headline)}</strong>
      <span class="hist-conclusion-text">${escapeHtml(item.text)}</span>
    </div>`).join('');
}

function renderExecutiveSummaryMetrics(historyData) {
  if (!historyData) return;
  const histTotalYears = document.getElementById('hist-total-years');
  const histYearsRange = document.getElementById('hist-years-range');
  const histTotalHours = document.getElementById('hist-total-hours');
  const histTotalHoursDecimal = document.getElementById('hist-total-hours-decimal');
  const histTotalSessions = document.getElementById('hist-total-sessions');
  const histActiveDays = document.getElementById('hist-active-days');
  const histAccuracy = document.getElementById('hist-accuracy');
  const histQuestionsDetail = document.getElementById('hist-questions-detail');
  const histPeakYear = document.getElementById('hist-peak-year');
  const histPeakHours = document.getElementById('hist-peak-hours');

  if (histTotalYears) histTotalYears.textContent = `${historyData.totalYearsCount} anos`;
  const range = `${historyData.startYear} – ${historyData.endYear}`;
  if (histYearsRange) histYearsRange.textContent = range;
  const historyTitle = document.getElementById('historical-section-title');
  if (historyTitle) historyTitle.textContent = `Histórico multianual e fases de estudo (${range})`;

  if (histTotalHours) {
    const totalMs = historyData.years.reduce((acc, y) => acc + (y.totalDurationMs || 0), 0);
    histTotalHours.textContent = formatDurationMs(totalMs);
  }
  if (histTotalHoursDecimal) {
    histTotalHoursDecimal.textContent = `${formatNumber(historyData.totalCumulativeHours, 1)} horas líquidas`;
  }

  if (histTotalSessions) {
    histTotalSessions.textContent = historyData.totalCumulativeSessions.toLocaleString('pt-BR');
  }
  if (histActiveDays) {
    const totalActiveDays = historyData.years.reduce((acc, y) => acc + (y.activeDaysCount || 0), 0);
    histActiveDays.textContent = `${totalActiveDays.toLocaleString('pt-BR')} dias com estudo`;
  }

  if (histAccuracy) {
    histAccuracy.textContent = historyData.overallHistoricalAccuracy !== null
      ? `${formatNumber(historyData.overallHistoricalAccuracy, 1)}%`
      : 'N/A';
  }
  if (histQuestionsDetail) {
    histQuestionsDetail.textContent = `${historyData.totalCumulativeCorrect.toLocaleString('pt-BR')} acertos de ${historyData.totalCumulativeQuestions.toLocaleString('pt-BR')} questões`;
  }

  if (histPeakYear) {
    histPeakYear.textContent = historyData.peakYear ? String(historyData.peakYear.year) : '----';
  }
  if (histPeakHours) {
    histPeakHours.textContent = historyData.peakYear
      ? `${formatNumber(historyData.peakYear.hours, 1)}h no melhor ano`
      : 'Sem registros';
  }
}

function renderMultiannualCards(historyData) {
  const container = document.getElementById('multiannual-cards-grid');
  if (!container || !historyData) return;

  container.innerHTML = '';
  const maxHours = Math.max(...historyData.years.map(y => y.totalHours), 1);
  const sortedYears = [...historyData.years].sort((a, b) => b.year - a.year);

  sortedYears.forEach(yearData => {
    const card = document.createElement('div');
    card.className = `year-card ${yearData.isCurrentYear ? 'current-year' : ''}`;

    let phaseClass = 'phase-hiato';
    if (yearData.phase === 'ALTA_INTENSIDADE') phaseClass = 'phase-alta';
    else if (yearData.phase === 'MANUTENCAO') phaseClass = 'phase-manutencao';

    const barPercent = Math.min(100, (yearData.totalHours / maxHours) * 100);

    const phaseName = { ALTA_INTENSIDADE: 'Alta intensidade', MANUTENCAO: 'Manutenção', HIATO: 'Hiato' }[yearData.phase] || yearData.phaseLabel;

    card.innerHTML = `
      <div class="year-card-header">
        <div class="year-title-wrap">
          <span class="year-number">${yearData.year}</span>
          ${yearData.isCurrentYear ? '<span class="current-year-tag">Em andamento</span>' : ''}
        </div>
        <span class="phase-badge ${phaseClass}" title="${escapeHtml(yearData.phaseDescription)}">${escapeHtml(phaseName)}</span>
      </div>
      <div class="year-hours-main">${formatNumber(yearData.totalHours, 1)}h</div>
      <div class="year-duration-sub">${escapeHtml(yearData.formattedDuration)}</div>
      <div class="year-bar-track">
        <div class="year-bar-fill" style="width: ${barPercent.toFixed(1)}%"></div>
      </div>
      <div class="year-meta-grid">
        <div class="year-meta-item">
          <span>Sessões:</span>
          <span class="year-meta-val">${yearData.sessionsCount}</span>
        </div>
        <div class="year-meta-item">
          <span>Dias ativos:</span>
          <span class="year-meta-val">${yearData.activeDaysCount}</span>
        </div>
        <div class="year-meta-item">
          <span>Assertividade:</span>
          <span class="year-meta-val">${yearData.accuracy !== null ? formatNumber(yearData.accuracy, 1) + '%' : 'N/A'}</span>
        </div>
        <div class="year-meta-item">
          <span>Média diária:</span>
          <span class="year-meta-val">${formatNumber(yearData.avgDailyHoursActive, 1)}h/dia</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function setupHeatmapControls(activities, historyData) {
  const select = document.getElementById('heatmap-year-select');
  if (!select) return;

  const start = historyData?.startYear ?? 2016;
  const end = historyData?.endYear ?? new Date().getFullYear();
  currentHeatmapYear = Math.min(end, Math.max(start, currentHeatmapYear));

  // Rebuild only on a new snapshot; preserve the user's selected year.
  select.innerHTML = '';
  for (let y = end; y >= start; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = `${y}`;
    select.appendChild(opt);
  }
  select.value = String(currentHeatmapYear);
  // Replace the handler rather than accumulating listeners or capturing old data.
  select.onchange = () => {
    currentHeatmapYear = parseInt(select.value, 10);
    renderHeatmap(cachedHistoricalActivities || [], currentHeatmapYear);
  };

  renderHeatmap(activities, currentHeatmapYear);
}

function renderHeatmap(activities, selectedYear) {
  const container = document.getElementById('heatmap-svg-container');
  const kpiHours = document.getElementById('heatmap-kpi-hours');
  const kpiDays = document.getElementById('heatmap-kpi-days');
  const kpiPeakDay = document.getElementById('heatmap-kpi-peak-day');
  const kpiStreak = document.getElementById('heatmap-kpi-streak');
  const tooltip = document.getElementById('heatmap-tooltip');
  if (!container) return;

  const heatmapData = computeActivityHeatmap(activities, selectedYear);

  if (kpiHours) kpiHours.textContent = `${formatNumber(heatmapData.totalYearHours, 1)}h (${heatmapData.formattedTotalHours})`;
  if (kpiDays) kpiDays.textContent = `${heatmapData.activeDaysCount} de ${heatmapData.totalDays} dias`;
  if (kpiPeakDay) {
    kpiPeakDay.textContent = heatmapData.maxDailyHours > 0
      ? `${formatNumber(heatmapData.maxDailyHours, 1)}h (${formatDateBR(heatmapData.maxDailyDate)})`
      : '0.0h';
  }
  if (kpiStreak) {
    const yearEntry = cachedHistoricalPatterns?.history?.years?.find(y => y.year === selectedYear);
    kpiStreak.textContent = `${yearEntry?.longestStreak || 0} dias`;
  }

  const cellStep = 14;
  const cellSize = 11;
  const gutterLeft = 32;
  const gutterTop = 22;
  const weeksCount = heatmapData.weeks.length;
  const svgWidth = gutterLeft + (weeksCount * cellStep) + 8;
  const svgHeight = gutterTop + (7 * cellStep) + 8;

  const weekdayInitials = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  let svgHtml = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="heatmap-svg" width="${svgWidth}" height="${svgHeight}" role="img" aria-label="Mapa de calor de estudos de ${selectedYear}">`;

  // Weekday initials (D, S, T, Q, Q, S, S)
  for (let d = 0; d < 7; d++) {
    const yPos = gutterTop + (d * cellStep) + 9;
    svgHtml += `<text x="14" y="${yPos}" class="heatmap-day-label">${weekdayInitials[d]}</text>`;
  }

  // Month labels
  let lastMonth = -1;
  heatmapData.weeks.forEach((w, wIndex) => {
    const firstInYearDay = w.days.find(d => d.inTargetYear);
    if (firstInYearDay) {
      const monthIndex = parseInt(firstInYearDay.date.split('-')[1], 10) - 1;
      if (monthIndex !== lastMonth) {
        lastMonth = monthIndex;
        const xPos = gutterLeft + (wIndex * cellStep);
        svgHtml += `<text x="${xPos}" y="12" class="heatmap-month-label">${monthNames[monthIndex]}</text>`;
      }
    }
  });

  // Cells
  heatmapData.weeks.forEach((w, wIndex) => {
    const xPos = gutterLeft + (wIndex * cellStep);
    w.days.forEach((d, dIndex) => {
      const yPos = gutterTop + (dIndex * cellStep);
      const isOutOfYear = !d.inTargetYear;
      svgHtml += `
        <rect
          x="${xPos}"
          y="${yPos}"
          width="${cellSize}"
          height="${cellSize}"
          rx="2"
          ry="2"
          class="heatmap-cell level-${d.level} ${isOutOfYear ? 'out-of-year' : ''}"
          data-date="${d.date}"
          data-hours="${d.hours}"
          data-duration="${formatDurationMs(d.ms)}"
          data-sessions="${d.sessionsCount}"
          data-questions="${d.questions}"
          data-correct="${d.correct}"
          data-in-year="${d.inTargetYear}"
        />
      `;
    });
  });

  svgHtml += `</svg>`;
  container.innerHTML = svgHtml;

  // Tooltip event delegation on container (registered once)
  if (tooltip && !container.dataset.hasDelegatedTooltip) {
    container.dataset.hasDelegatedTooltip = 'true';

    container.addEventListener('mouseover', (e) => {
      const cell = e.target?.closest?.('.heatmap-cell');
      if (!cell || cell.getAttribute('data-in-year') !== 'true') return;

      const date = cell.getAttribute('data-date');
      const hours = parseFloat(cell.getAttribute('data-hours') || '0');
      const duration = cell.getAttribute('data-duration') || '0h 0m';
      const sessions = parseInt(cell.getAttribute('data-sessions') || '0', 10);
      const questions = parseInt(cell.getAttribute('data-questions') || '0', 10);
      const correct = parseInt(cell.getAttribute('data-correct') || '0', 10);
      const acc = questions > 0 ? formatNumber(((correct / questions) * 100), 1) + '%' : 'N/A';

      tooltip.innerHTML = `
        <div class="tooltip-title">${formatDateBR(date)}</div>
        <div class="tooltip-row"><span>Duração:</span><strong>${duration} (${formatNumber(hours, 1)}h)</strong></div>
        <div class="tooltip-row"><span>Sessões:</span><strong>${sessions}</strong></div>
        <div class="tooltip-row"><span>Questões:</span><strong>${questions > 0 ? `${correct}/${questions} (${acc})` : 'Nenhuma'}</strong></div>
      `;
      tooltip.classList.remove('hidden');
      tooltip.setAttribute('aria-hidden', 'false');
      positionTooltip(e, tooltip);
    });

    container.addEventListener('mousemove', (e) => {
      const cell = e.target?.closest?.('.heatmap-cell');
      if (cell && cell.getAttribute('data-in-year') === 'true') {
        positionTooltip(e, tooltip);
      }
    });

    container.addEventListener('mouseout', (e) => {
      const cell = e.target?.closest?.('.heatmap-cell');
      if (!cell || cell.contains(e.relatedTarget)) return;
      tooltip.classList.add('hidden');
      tooltip.setAttribute('aria-hidden', 'true');
    });
  }
}

function renderCircadian(circadianData) {
  if (!circadianData) return;

  // 1. 24-Hour Histogram
  const histogramContainer = document.getElementById('circadian-histogram-chart');
  const peakNote = document.getElementById('circadian-peak-note');
  if (histogramContainer) {
    histogramContainer.innerHTML = '';
    const maxHours = Math.max(...circadianData.hourly.map(h => h.hours), 0.1);

    circadianData.hourly.forEach(h => {
      const col = document.createElement('div');
      col.className = 'circadian-bar-col';
      const isPeak = h.hour === circadianData.peakHour.hour;
      const heightPercent = Math.max(3, (h.hours / maxHours) * 100);

      const accText = h.accuracy !== null ? `${formatNumber(h.accuracy, 1)}%` : 'N/A';
      col.title = `${h.label}: ${formatNumber(h.hours, 1)}h (${formatNumber(h.percentage, 1)}%) • ${h.sessions} sessões • Assertividade: ${accText}`;

      col.innerHTML = `
        <div class="circadian-bar ${isPeak ? 'is-peak' : ''}" style="height: ${heightPercent.toFixed(1)}%"></div>
        <span class="circadian-label">${h.hour % 2 === 0 ? h.label : ''}</span>
      `;
      histogramContainer.appendChild(col);
    });
  }

  if (peakNote) {
    const peakLabel = circadianData.peakHour?.label || `${String(circadianData.peakHour?.hour ?? 0).padStart(2, '0')}h`;
    peakNote.innerHTML = `Pico de estudo às <strong>${peakLabel}</strong> com <strong>${formatNumber(circadianData.peakHour.hours, 1)}h</strong> (${formatNumber(circadianData.peakHour.percentage, 1)}% do tempo total)`;
  }

  // 2. 4 Daytime Shifts (sum strictly to 100%)
  const shiftsContainer = document.getElementById('circadian-shifts-container');
  if (shiftsContainer) {
    shiftsContainer.innerHTML = '';
    const shiftDefs = [
      { key: 'madrugada', name: 'Madrugada', range: '00h às 06h' },
      { key: 'manha', name: 'Manhã', range: '06h às 12h' },
      { key: 'tarde', name: 'Tarde', range: '12h às 18h' },
      { key: 'noite', name: 'Noite', range: '18h às 24h' }
    ];

    shiftDefs.forEach(s => {
      const shiftData = circadianData.shifts[s.key] || { hours: 0, percentage: 0, sessions: 0 };
      const isDominant = circadianData.dominantShift === s.key;

      const card = document.createElement('div');
      card.className = `shift-card ${isDominant ? 'is-dominant' : ''}`;
      card.innerHTML = `
        <div class="shift-card-header">
          <span>${escapeHtml(s.name)}</span>
          ${isDominant ? '<span class="dominant-tag">Turno dominante</span>' : ''}
        </div>
        <div class="shift-hours-val">${formatNumber(shiftData.hours, 1)}h</div>
        <div class="shift-card-footer">
          <span class="shift-pct-pill">${formatNumber(shiftData.percentage, 1)}%</span>
          <span class="shift-sessions-val">${shiftData.sessions} sessões</span>
        </div>
      `;
      shiftsContainer.appendChild(card);
    });
  }

  // 3. Weekday Ranking
  const weekdayContainer = document.getElementById('weekday-ranking-container');
  if (weekdayContainer) {
    const maxDayHours = Math.max(...circadianData.weekdayRanking.map(d => d.hours), 0.1);
    const sortedDays = [...circadianData.weekdayRanking].sort((a, b) => a.volumeRank - b.volumeRank);

    let tableHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 70px;">Posição</th>
            <th>Dia da Semana</th>
            <th>Volume de Estudo</th>
            <th>% do Tempo</th>
            <th>Sessões</th>
            <th>Dias Ativos</th>
            <th>Consistência</th>
          </tr>
        </thead>
        <tbody>
    `;

    sortedDays.forEach(day => {
      const barWidth = Math.min(100, (day.hours / maxDayHours) * 100);
      let rankClass = '';
      if (day.volumeRank === 1) rankClass = 'rank-1';
      else if (day.volumeRank === 2) rankClass = 'rank-2';
      else if (day.volumeRank === 3) rankClass = 'rank-3';

      tableHtml += `
        <tr>
          <td><span class="rank-badge ${rankClass}">${day.volumeRank}º</span></td>
          <td><strong>${escapeHtml(day.dayName)}</strong></td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span>${formatNumber(day.hours, 1)}h</span>
              <div class="progress-bar-bg" style="width: 80px; height: 6px;">
                <div class="progress-bar-fill" style="width: ${barWidth.toFixed(0)}%"></div>
              </div>
            </div>
          </td>
          <td>${formatNumber(day.percentage, 1)}%</td>
          <td>${day.sessions}</td>
          <td>${day.activeDaysCount}</td>
          <td>
            <span title="Posição em consistência: ${day.consistencyRank}º">${formatNumber(day.consistencyScore, 0)}% (${day.consistencyRank}º)</span>
          </td>
        </tr>
      `;
    });

    tableHtml += `</tbody></table>`;
    weekdayContainer.innerHTML = tableHtml;
  }
}

function renderQuadrants(quadrantsData) {
  if (!quadrantsData) return;

  const cutoffInfo = document.getElementById('quadrants-cutoff-info');
  const svgContainer = document.getElementById('quadrants-svg-container');
  const breakdownContainer = document.getElementById('quadrants-breakdown-container');
  const semExerciciosContainer = document.getElementById('quadrants-sem-exercicios-container');
  const tooltip = document.getElementById('heatmap-tooltip');

  if (cutoffInfo) {
    cutoffInfo.innerHTML = `
      Linhas de corte: <strong>${formatNumber(quadrantsData.medianHours, 1)}h</strong> (mediana de tempo) e
      <strong>${formatNumber(quadrantsData.accuracyCutoff, 1)}%</strong> de assertividade ·
      <strong>${quadrantsData.summary.totalSubjects}</strong> matérias classificadas
      (<strong>${quadrantsData.summary.strongCount}</strong> pontos fortes, <strong>${quadrantsData.summary.bottlenecksCount}</strong> gargalos críticos)
    `;
  }

  // Collect subjects
  const { pontosFortes, gargalosCriticos, baseSolida, zonaRisco, semExercicios } = quadrantsData.quadrants;
  const plottedSubjects = [...pontosFortes, ...gargalosCriticos, ...baseSolida, ...zonaRisco];

  // SVG Geometry
  const svgWidth = 640;
  const svgHeight = 380;
  const left = 78;
  const right = 36;
  const top = 30;
  const bottom = 50;
  const plotWidth = svgWidth - left - right;
  const plotHeight = svgHeight - top - bottom;

  const maxHoursRaw = Math.max(...plottedSubjects.map(s => s.totalHours), quadrantsData.medianHours * 1.5, 20);
  const maxHours = Math.ceil(maxHoursRaw / 10) * 10;

  const cutoffX = left + (quadrantsData.medianHours / maxHours) * plotWidth;
  const cutoffY = top + (1 - (quadrantsData.accuracyCutoff / 100)) * plotHeight;
  const tick = '#8b9bb0';

  let svgHtml = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="quadrant-svg" role="img" aria-label="Matriz de rendimento: tempo investido por assertividade">
      <rect x="${left}" y="${top}" width="${cutoffX - left}" height="${cutoffY - top}" class="matrix-quadrant-bg q-solida" />
      <rect x="${cutoffX}" y="${top}" width="${left + plotWidth - cutoffX}" height="${cutoffY - top}" class="matrix-quadrant-bg q-fortes" />
      <rect x="${left}" y="${cutoffY}" width="${cutoffX - left}" height="${top + plotHeight - cutoffY}" class="matrix-quadrant-bg q-risco" />
      <rect x="${cutoffX}" y="${cutoffY}" width="${left + plotWidth - cutoffX}" height="${top + plotHeight - cutoffY}" class="matrix-quadrant-bg q-gargalos" />

      <text x="${left + 10}" y="${top + 18}" class="matrix-quadrant-label ql-solida">Base sólida</text>
      <text x="${left + plotWidth - 10}" y="${top + 18}" text-anchor="end" class="matrix-quadrant-label ql-fortes">Pontos fortes</text>
      <text x="${left + 10}" y="${top + plotHeight - 10}" class="matrix-quadrant-label ql-risco">Zona de risco</text>
      <text x="${left + plotWidth - 10}" y="${top + plotHeight - 10}" text-anchor="end" class="matrix-quadrant-label ql-gargalos">Gargalos críticos</text>

      <line x1="${cutoffX}" y1="${top}" x2="${cutoffX}" y2="${top + plotHeight}" class="matrix-cutoff-line" />
      <line x1="${left}" y1="${cutoffY}" x2="${left + plotWidth}" y2="${cutoffY}" class="matrix-cutoff-line" />

      <text x="${cutoffX + 5}" y="${top + 34}" class="matrix-cutoff-label">Mediana ${formatNumber(quadrantsData.medianHours, 1)}h</text>
      <text x="${left + 5}" y="${cutoffY + 13}" text-anchor="start" class="matrix-cutoff-label">Corte ${formatNumber(quadrantsData.accuracyCutoff, 1)}%</text>

      <line x1="${left}" y1="${top + plotHeight}" x2="${left + plotWidth}" y2="${top + plotHeight}" stroke="#334155" stroke-width="1.5" />
      <line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="#334155" stroke-width="1.5" />

      <text x="${left - 8}" y="${top + 4}" text-anchor="end" fill="${tick}" font-size="10">100%</text>
      <text x="${left - 8}" y="${top + (plotHeight * 0.5) + 4}" text-anchor="end" fill="${tick}" font-size="10">50%</text>
      <text x="${left - 8}" y="${top + plotHeight + 3}" text-anchor="end" fill="${tick}" font-size="10">0%</text>
      <text x="16" y="${top + (plotHeight * 0.5)}" text-anchor="middle" fill="${tick}" font-size="11" transform="rotate(-90 16 ${top + (plotHeight * 0.5)})">Assertividade (%)</text>

      <text x="${left}" y="${top + plotHeight + 16}" text-anchor="middle" fill="${tick}" font-size="10">0h</text>
      <text x="${left + (plotWidth * 0.5)}" y="${top + plotHeight + 16}" text-anchor="middle" fill="${tick}" font-size="10">${formatNumber((maxHours * 0.5), 0)}h</text>
      <text x="${left + plotWidth}" y="${top + plotHeight + 16}" text-anchor="middle" fill="${tick}" font-size="10">${formatValue(maxHours)}h</text>
      <text x="${left + (plotWidth * 0.5)}" y="${top + plotHeight + 36}" text-anchor="middle" fill="${tick}" font-size="11">Tempo investido (horas)</text>
  `;

  // Point labels: name beside each dot, nudged down when two labels would overlap.
  const placed = [];
  const labelFor = s => (s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name);
  const points = plottedSubjects.map(s => ({
    s,
    cx: left + (s.totalHours / maxHours) * plotWidth,
    cy: top + (1 - (s.accuracy / 100)) * plotHeight
  })).sort((a, b) => a.cy - b.cy);
  points.forEach(point => {
    const text = labelFor(point.s);
    const width = text.length * 5.6;
    const flip = point.cx + 12 + width > left + plotWidth + right - 4;
    const x1 = flip ? point.cx - 12 - width : point.cx + 12;
    let y = point.cy + 3.5;
    while (placed.some(o => Math.abs(o.y - y) < 11 && x1 < o.x2 && x1 + width > o.x1)) y += 11;
    placed.push({ x1, x2: x1 + width, y });
    point.label = { text, x: flip ? point.cx - 12 : point.cx + 12, y, anchor: flip ? 'end' : 'start' };
  });

  svgHtml += points.map(point => `
      <text x="${point.label.x.toFixed(1)}" y="${point.label.y.toFixed(1)}" text-anchor="${point.label.anchor}" class="matrix-dot-label"><title>${escapeHtml(point.s.name)}</title>${escapeHtml(point.label.text)}</text>`).join('');

  plottedSubjects.forEach(s => {
    const cx = left + (s.totalHours / maxHours) * plotWidth;
    const cy = top + (1 - (s.accuracy / 100)) * plotHeight;
    svgHtml += `
      <circle
        cx="${cx.toFixed(1)}"
        cy="${cy.toFixed(1)}"
        r="6"
        fill="${sanitizeColor(s.color)}"
        stroke="#ffffff"
        stroke-width="1.5"
        class="matrix-dot"
        data-name="${escapeHtml(s.name)}"
        data-hours="${s.totalHours}"
        data-acc="${s.accuracy}"
        data-questions="${s.questions}"
        data-correct="${s.correct}"
      >
        <title>${escapeHtml(s.name)}: ${formatValue(s.totalHours)}h | ${formatValue(s.accuracy)}% acertos</title>
      </circle>
    `;
  });

  svgHtml += `</svg>`;
  if (svgContainer) svgContainer.innerHTML = svgHtml;

  // Tooltip interaction on matrix dots
  if (tooltip && svgContainer) {
    const dots = svgContainer.querySelectorAll('.matrix-dot');
    dots.forEach(dot => {
      dot.addEventListener('mouseenter', (e) => {
        const name = dot.getAttribute('data-name');
        const hours = parseFloat(dot.getAttribute('data-hours') || '0');
        const acc = parseFloat(dot.getAttribute('data-acc') || '0');
        const q = parseInt(dot.getAttribute('data-questions') || '0', 10);
        const c = parseInt(dot.getAttribute('data-correct') || '0', 10);

        tooltip.innerHTML = `
          <div class="tooltip-title">${escapeHtml(name)}</div>
          <div class="tooltip-row"><span>Tempo Total:</span><strong>${formatNumber(hours, 1)}h</strong></div>
          <div class="tooltip-row"><span>Assertividade:</span><strong>${formatNumber(acc, 1)}%</strong></div>
          <div class="tooltip-row"><span>Exercícios:</span><strong>${c} acertos de ${q}</strong></div>
        `;
        tooltip.classList.remove('hidden');
        tooltip.setAttribute('aria-hidden', 'false');
        positionTooltip(e, tooltip);
      });

      dot.addEventListener('mousemove', (e) => {
        positionTooltip(e, tooltip);
      });

      dot.addEventListener('mouseleave', () => {
        tooltip.classList.add('hidden');
        tooltip.setAttribute('aria-hidden', 'true');
      });
    });
  }

  // Breakdown Panels
  if (breakdownContainer) {
    breakdownContainer.innerHTML = `
      <!-- Pontos Fortes -->
      <div class="quadrant-panel panel-fortes">
        <div class="quadrant-panel-header">
          <span class="quadrant-panel-title text-accent">Pontos fortes (${pontosFortes.length})</span>
          <span class="quadrant-panel-sub">Alto tempo e alta assertividade</span>
        </div>
        <p class="quadrant-reco">Mantenha o ritmo e revise de vez em quando.</p>
        <div class="subject-pills-list">
          ${renderSubjectPills(pontosFortes)}
        </div>
      </div>

      <!-- Gargalos Críticos -->
      <div class="quadrant-panel panel-gargalos">
        <div class="quadrant-panel-header">
          <span class="quadrant-panel-title text-danger">Gargalos críticos (${gargalosCriticos.length})</span>
          <span class="quadrant-panel-sub">Alto tempo e baixa assertividade</span>
        </div>
        <p class="quadrant-reco">Troque leitura por questões e revise os erros.</p>
        <div class="subject-pills-list">
          ${renderSubjectPills(gargalosCriticos)}
        </div>
      </div>

      <!-- Base Sólida -->
      <div class="quadrant-panel panel-solida">
        <div class="quadrant-panel-header">
          <span class="quadrant-panel-title text-blue">Base sólida (${baseSolida.length})</span>
          <span class="quadrant-panel-sub">Baixo tempo e alta assertividade</span>
        </div>
        <p class="quadrant-reco">Bom rendimento com pouco tempo: amplie aos poucos.</p>
        <div class="subject-pills-list">
          ${renderSubjectPills(baseSolida)}
        </div>
      </div>

      <!-- Zona de Risco -->
      <div class="quadrant-panel panel-risco">
        <div class="quadrant-panel-header">
          <span class="quadrant-panel-title text-warning">Zona de risco (${zonaRisco.length})</span>
          <span class="quadrant-panel-sub">Baixo tempo e baixa assertividade</span>
        </div>
        <p class="quadrant-reco">Comece pela teoria básica e por questões fáceis.</p>
        <div class="subject-pills-list">
          ${renderSubjectPills(zonaRisco)}
        </div>
      </div>
    `;
  }

  // Sem Exercícios Alert
  if (semExerciciosContainer) {
    if (semExercicios.length > 0) {
      semExerciciosContainer.classList.remove('hidden');
      semExerciciosContainer.innerHTML = `
        <strong>Matérias sem exercícios registrados:</strong>
        ${semExercicios.map(s => `<strong>${escapeHtml(s.name)}</strong> (${formatNumber(s.totalHours, 1)}h)`).join(', ')}.
        Resolva questões para calibrar o rendimento e posicionar na matriz.
      `;
    } else {
      semExerciciosContainer.classList.add('hidden');
    }
  }
}

function renderSubjectPills(subjects = []) {
  if (!subjects.length) {
    return `<div style="font-size: 11px; color: var(--text-faint); padding: 4px 0;">Nenhuma matéria neste quadrante.</div>`;
  }
  return subjects.map(s => `
    <div class="subject-pill">
      <div class="subject-pill-left">
        <span class="subject-dot" style="background-color: ${sanitizeColor(s.color)};"></span>
        <span style="font-weight: 600;">${escapeHtml(s.name)}</span>
      </div>
      <div class="subject-pill-right">
        <span>${formatNumber(s.totalHours, 1)}h</span>
        <span class="accuracy-badge ${s.accuracy >= 80 ? 'accuracy-high' : (s.accuracy >= 65 ? 'accuracy-mid' : 'accuracy-low')}">${s.accuracy !== null ? formatNumber(s.accuracy, 1) + '%' : 'N/A'}</span>
      </div>
    </div>
  `).join('');
}

function renderMixAndInsights(mixData, insightsData) {
  if (!mixData) return;

  const mixBar = document.getElementById('mix-segmented-bar');
  const mixLegend = document.getElementById('mix-legend');
  const recContainer = document.getElementById('mix-recommendations-container');
  const synthesisContainer = document.getElementById('insights-synthesis-container');

  // Segmented Bar
  if (mixBar) {
    const { teoria, questoes, revisao, outros } = mixData.proportions;
    mixBar.innerHTML = `
      <div class="mix-segment mix-seg-teoria" style="width: ${teoria.percentage.toFixed(1)}%" title="Teoria: ${formatNumber(teoria.hours, 1)}h (${formatNumber(teoria.percentage, 1)}%)">
        ${teoria.percentage >= 8 ? `${formatNumber(teoria.percentage, 0)}%` : ''}
      </div>
      <div class="mix-segment mix-seg-questoes" style="width: ${questoes.percentage.toFixed(1)}%" title="Questões: ${formatNumber(questoes.hours, 1)}h (${formatNumber(questoes.percentage, 1)}%)">
        ${questoes.percentage >= 8 ? `${formatNumber(questoes.percentage, 0)}%` : ''}
      </div>
      <div class="mix-segment mix-seg-revisao" style="width: ${revisao.percentage.toFixed(1)}%" title="Revisão: ${formatNumber(revisao.hours, 1)}h (${formatNumber(revisao.percentage, 1)}%)">
        ${revisao.percentage >= 8 ? `${formatNumber(revisao.percentage, 0)}%` : ''}
      </div>
      <div class="mix-segment mix-seg-outros" style="width: ${outros.percentage.toFixed(1)}%" title="Outros: ${formatNumber(outros.hours, 1)}h (${formatNumber(outros.percentage, 1)}%)">
        ${outros.percentage >= 8 ? `${formatNumber(outros.percentage, 0)}%` : ''}
      </div>
    `;
  }

  // Legend
  if (mixLegend) {
    const { teoria, questoes, revisao, outros } = mixData.proportions;
    mixLegend.innerHTML = `
      <div class="mix-legend-item">
        <span class="mix-legend-dot" style="background-color: #3b82f6;"></span>
        <span>Teoria: <strong>${formatNumber(teoria.percentage, 1)}%</strong> (${formatNumber(teoria.hours, 1)}h)</span>
      </div>
      <div class="mix-legend-item">
        <span class="mix-legend-dot" style="background-color: #10b981;"></span>
        <span>Questões: <strong>${formatNumber(questoes.percentage, 1)}%</strong> (${formatNumber(questoes.hours, 1)}h)</span>
      </div>
      <div class="mix-legend-item">
        <span class="mix-legend-dot" style="background-color: #f59e0b;"></span>
        <span>Revisão: <strong>${formatNumber(revisao.percentage, 1)}%</strong> (${formatNumber(revisao.hours, 1)}h)</span>
      </div>
      <div class="mix-legend-item">
        <span class="mix-legend-dot" style="background-color: #8b5cf6;"></span>
        <span>Outros: <strong>${formatNumber(outros.percentage, 1)}%</strong> (${formatNumber(outros.hours, 1)}h)</span>
      </div>
    `;
  }

  // Diagnostic Recommendations
  if (recContainer) {
    recContainer.innerHTML = '';
    mixData.recommendations.forEach(rec => {
      const card = document.createElement('div');
      card.className = `rec-card rec-${rec.severity}`;
      card.innerHTML = `
        <div class="rec-card-header">
          <span class="rec-card-title">${escapeHtml(rec.title)}</span>
          <span class="rec-badge badge-${rec.severity}">${escapeHtml(severityLabel(rec.severity))}</span>
        </div>
        <div class="rec-card-text">${escapeHtml(rec.text)}</div>
      `;
      recContainer.appendChild(card);
    });
  }

  // Rule-based Synthesis
  if (synthesisContainer && insightsData) {
    synthesisContainer.innerHTML = `
      <div class="synthesis-section">
        <div class="synthesis-heading">1. Resumo executivo do histórico</div>
        <div class="synthesis-body">${escapeHtml(insightsData.executiveSummary)}</div>
      </div>
      <div class="synthesis-section">
        <div class="synthesis-heading">2. Seu horário de estudo</div>
        <div class="synthesis-body">${escapeHtml(insightsData.circadianInsights)}</div>
      </div>
      <div class="synthesis-section">
        <div class="synthesis-heading">3. Consistência e cadência semanal</div>
        <div class="synthesis-body">${escapeHtml(insightsData.weeklyCadenceInsights)}</div>
      </div>
      <div class="synthesis-section">
        <div class="synthesis-heading">4. Diagnóstico dos quadrantes de rendimento</div>
        <div class="synthesis-body">${escapeHtml(insightsData.quadrantInsights)}</div>
      </div>
      <div class="synthesis-section">
        <div class="synthesis-heading">5. Recomendações do mix metodológico</div>
        <ul class="synthesis-list">
          ${insightsData.methodRecommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
        </ul>
      </div>
      <div class="synthesis-section">
        <div class="synthesis-heading">6. Tamanho de sessão</div>
        <div class="synthesis-body">${escapeHtml(insightsData.sessionInsights || '')}</div>
      </div>
      <div class="synthesis-section">
        <div class="synthesis-heading">7. Horário mais eficiente</div>
        <div class="synthesis-body">${escapeHtml(insightsData.efficiencyInsights || '')}</div>
      </div>
      <div class="synthesis-section">
        <div class="synthesis-heading">8. Melhor semestre e ano</div>
        <div class="synthesis-body">${escapeHtml(insightsData.periodInsights || '')}</div>
      </div>
    `;
  }
}

/* ==========================================================================
   Best period, hour × weekday, efficiency and session-size renderers
   ========================================================================== */

function formatMinutes(min) {
  if (!Number.isFinite(min) || min <= 0) return '0 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}min` : `${h}h`;
}

function formatAccuracy(value) {
  return value === null || value === undefined ? '—' : `${formatNumber(Number(value), 1)}%`;
}

function renderPeriodRanking(semesterData) {
  const highlights = document.getElementById('period-highlights');
  const tbody = document.getElementById('tbody-period-ranking');
  if (!semesterData || !highlights || !tbody) return;

  const isYear = currentPeriodGranularity === 'year';
  const list = isYear ? semesterData.years : semesterData.semesters;
  const h = isYear ? semesterData.yearHighlights : semesterData.semesterHighlights;
  const unit = isYear ? 'ano' : 'semestre';

  if (!list.length) {
    highlights.innerHTML = `<div class="empty-note">Sem registros suficientes para comparar períodos.</div>`;
    tbody.innerHTML = '';
    return;
  }

  const card = (title, period, value, detail, extraClass = '') => `
    <div class="period-highlight-card ${extraClass}">
      <span class="metric-title">${escapeHtml(title)}</span>
      <div class="metric-value">${period ? escapeHtml(formatPeriodLabel(period.label)) : '—'}</div>
      <div class="metric-footer">${period ? escapeHtml(value) : escapeHtml(detail)}</div>
    </div>`;

  highlights.innerHTML = [
    card(`Melhor ${unit} no conjunto`, h.overallBest,
      h.overallBest ? `${formatValue(h.overallBest.totalHours)}h · ${formatValue(h.overallBest.consistency)}% dos dias · ${formatAccuracy(h.overallBest.accuracy)}` : '', '—', 'is-best'),
    card('Maior volume', h.bestByHours, h.bestByHours ? `${formatValue(h.bestByHours.totalHours)}h em ${h.bestByHours.sessions} sessões` : '', '—'),
    card('Mais consistente', h.bestByConsistency, h.bestByConsistency ? `${formatValue(h.bestByConsistency.consistency)}% dos dias (${h.bestByConsistency.activeDays} dias)` : '', '—'),
    card('Maior assertividade', h.bestByAccuracy, h.bestByAccuracy ? `${formatAccuracy(h.bestByAccuracy.accuracy)} em ${h.bestByAccuracy.totalQuestions} questões` : '',
      `Mínimo de ${semesterData.minQuestions} questões por período`)
  ].join('');

  // Overall position: lower average rank is better; ties share the position (1, 1, 3).
  const overallPosition = new Map();
  [...list].sort((a, b) => a.averageRank - b.averageRank).forEach((p, index, sorted) => {
    overallPosition.set(p, index > 0 && p.averageRank === sorted[index - 1].averageRank ? overallPosition.get(sorted[index - 1]) : index + 1);
  });
  const rows = [...list].reverse();
  tbody.innerHTML = rows.map(p => {
    const mark = (cond) => (cond ? ' class="is-best-cell"' : '');
    const accLow = p.accuracy !== null && p.totalQuestions < semesterData.minQuestions;
    return `
      <tr${p === h.overallBest ? ' class="is-best-row"' : ''}>
        <td><strong>${escapeHtml(isYear ? p.label : formatPeriodLabel(p.label))}</strong>${p.isCurrent ? ' <span class="badge-tag">em andamento</span>' : ''}</td>
        <td${mark(p === h.bestByHours)}>${formatNumber(p.totalHours, 1)}h</td>
        <td>${p.sessions}</td>
        <td>${p.activeDays}</td>
        <td${mark(p === h.bestByConsistency)}>${formatNumber(p.consistency, 1)}%</td>
        <td>${p.longestStreak} dias</td>
        <td${mark(p === h.bestByAccuracy)}${accLow ? ' title="Poucas questões: fora do ranking de assertividade"' : ''}>${formatAccuracy(p.accuracy)}${accLow ? '*' : ''}</td>
        <td title="${p.averageRank !== undefined ? `Média das posições: ${formatNumber(p.averageRank, 2)}. Menor é melhor; empates dividem a posição.` : ''}">${p.averageRank !== undefined ? `${overallPosition.get(p)}º` : '—'}</td>
      </tr>`;
  }).join('');
}

function renderEfficiencyNote(efficiency) {
  const note = document.getElementById('circadian-efficiency-note');
  if (!note) return;
  const best = efficiency?.mostEfficientHour;
  let text = `Assertividade por horário aparece quando um horário acumula pelo menos ${escapeHtml(efficiency?.minQuestions ?? 50)} questões.`;
  if (best) {
    const peak = efficiency.volumePeakHour;
    text = `Melhor assertividade às <strong>${escapeHtml(best.label)}</strong> (${formatAccuracy(best.accuracy)} em ${best.questions} questões)`;
    if (peak && peak.hour !== best.hour) {
      text += ` · Maior volume às <strong>${escapeHtml(peak.label)}</strong>`;
      if (efficiency.gapPoints !== null) {
        text += ` (${formatAccuracy(peak.accuracy)}, ${efficiency.gapPoints > 0 ? '−' : '+'}${formatNumber(Math.abs(efficiency.gapPoints), 1)} p.p.)`;
      }
    } else if (peak) {
      text += ' · também é o horário de maior volume';
    }
  }
  if (efficiency?.mostEfficientShift) {
    text += ` · Turno mais eficiente: <strong>${escapeHtml(efficiency.mostEfficientShift.label)}</strong> (${formatAccuracy(efficiency.mostEfficientShift.accuracy)})`;
  }
  note.innerHTML = text;
}

function heatLevel(value, max) {
  if (!value || max <= 0) return 0;
  const ratio = value / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function renderHourWeekdayHeatmap(matrix) {
  const container = document.getElementById('hour-weekday-container');
  const top = document.getElementById('hour-weekday-top');
  const tooltip = document.getElementById('heatmap-tooltip');
  if (!container || !matrix) return;

  if (top) {
    top.innerHTML = matrix.topSlots.length
      ? `<span class="heatmap-kpi-label">Horários mais frequentes:</span> ` + matrix.topSlots
        .map((slot, i) => `<span class="slot-pill">${i + 1}º ${escapeHtml(slot.label)} · ${formatNumber(slot.hours, 1)}h</span>`).join('')
      : '<span class="heatmap-kpi-label">Sem sessões registradas.</span>';
  }

  const step = 22;
  const size = 19;
  const left = 34;
  const topGutter = 16;
  const width = left + 24 * step + 4;
  const height = topGutter + 7 * step + 4;
  // Monday first reads more naturally for a study week.
  const order = [1, 2, 3, 4, 5, 6, 0];

  let svg = `<svg viewBox="0 0 ${width} ${height}" class="heatmap-svg hour-weekday-svg" width="${width}" height="${height}" role="img" aria-label="Horas de estudo por dia da semana e hora do dia">`;
  for (let hr = 0; hr < 24; hr += 3) {
    svg += `<text x="${left + hr * step}" y="11" class="heatmap-month-label">${String(hr).padStart(2, '0')}h</text>`;
  }
  order.forEach((day, row) => {
    const y = topGutter + row * step;
    svg += `<text x="0" y="${y + 13}" class="heatmap-day-label">${escapeHtml(matrix.days[day].short)}</text>`;
    matrix.cells[day].forEach(cell => {
      svg += `<rect x="${left + cell.hour * step}" y="${y}" width="${size}" height="${size}" rx="3" ry="3"
        class="heatmap-cell hw-cell level-${heatLevel(cell.hours, matrix.maxHours)}"
        data-day-name="${escapeHtml(matrix.days[day].name)}" data-hour="${cell.hour}" data-hours="${cell.hours}" data-sessions="${cell.sessions}" />`;
    });
  });
  svg += '</svg>';
  container.innerHTML = svg;

  if (tooltip && !container.dataset.hasDelegatedTooltip) {
    container.dataset.hasDelegatedTooltip = 'true';

    container.addEventListener('mouseover', (e) => {
      const rect = e.target?.closest?.('.hw-cell');
      if (!rect) return;
      const dayName = rect.getAttribute('data-day-name') || '';
      const hour = parseInt(rect.getAttribute('data-hour'), 10);
      const hours = parseFloat(rect.getAttribute('data-hours') || '0');
      const sessions = parseInt(rect.getAttribute('data-sessions') || '0', 10);

      tooltip.innerHTML = `
        <div class="tooltip-title">${escapeHtml(dayName)}, ${String(hour).padStart(2, '0')}h</div>
        <div class="tooltip-row"><span>Horas:</span><strong>${formatNumber(hours, 1)}h</strong></div>
        <div class="tooltip-row"><span>Sessões:</span><strong>${sessions}</strong></div>`;
      tooltip.classList.remove('hidden');
      tooltip.setAttribute('aria-hidden', 'false');
      positionTooltip(e, tooltip);
    });

    container.addEventListener('mousemove', (e) => {
      if (e.target?.closest?.('.hw-cell')) {
        positionTooltip(e, tooltip);
      }
    });

    container.addEventListener('mouseout', (e) => {
      const rect = e.target?.closest?.('.hw-cell');
      if (!rect || rect.contains(e.relatedTarget)) return;
      tooltip.classList.add('hidden');
      tooltip.setAttribute('aria-hidden', 'true');
    });
  }
}

function renderSessionProfile(profile) {
  const kpis = document.getElementById('session-kpis');
  const bucketsEl = document.getElementById('session-buckets-container');
  const trendEl = document.getElementById('session-trend-container');
  const idealNote = document.getElementById('session-ideal-note');
  if (!profile || !bucketsEl) return;

  if (kpis) {
    const kpi = (label, value) => `<div class="heatmap-kpi-item"><span class="heatmap-kpi-label">${label}</span><span class="heatmap-kpi-val">${value}</span></div>`;
    kpis.innerHTML = [
      kpi('Sessão típica (mediana):', formatMinutes(profile.medianMinutes)),
      kpi('Média:', formatMinutes(profile.meanMinutes)),
      kpi('10% mais longas passam de:', formatMinutes(profile.p90Minutes)),
      kpi('Mais longa:', profile.longest
        ? `${escapeHtml(profile.longest.formatted)}${profile.longest.date ? ` (${formatDateBR(profile.longest.date)})` : ''}`
        : '—')
    ].join('');
  }

  const maxSessions = Math.max(...profile.buckets.map(b => b.sessions), 1);
  bucketsEl.innerHTML = profile.buckets.map(b => {
    const isIdeal = profile.idealBucket?.key === b.key;
    const width = (b.sessions / maxSessions) * 100;
    return `
      <div class="session-bucket-row${isIdeal ? ' is-ideal' : ''}">
        <span class="session-bucket-label">${escapeHtml(b.label)}</span>
        <div class="session-bucket-bar-bg"><div class="session-bucket-bar" style="width: ${width.toFixed(1)}%"></div></div>
        <span class="session-bucket-meta">${b.sessions} (${formatNumber(b.percentage, 1)}%)</span>
        <span class="session-bucket-acc${b.reliable ? '' : ' is-faint'}" title="${b.questions} questões">${formatAccuracy(b.accuracy)}</span>
      </div>`;
  }).join('') + `<div class="session-bucket-footnote">Barras: número de sessões · Direita: assertividade (esmaecida abaixo de ${profile.minQuestions} questões)</div>`;

  if (trendEl) {
    const points = profile.medianByYear;
    if (points.length < 2) {
      trendEl.innerHTML = '<div class="empty-note">É preciso mais de um ano de registros.</div>';
    } else {
      const maxMin = Math.max(...points.map(p => p.medianMinutes), 1);
      trendEl.innerHTML = points.map(p => `
        <div class="session-trend-col" title="${p.year}: mediana de ${formatMinutes(p.medianMinutes)} em ${p.sessions} sessões">
          <span class="session-trend-val">${p.medianMinutes}</span>
          <div class="session-trend-bar" style="height: ${Math.max(4, (p.medianMinutes / maxMin) * 100).toFixed(1)}%"></div>
          <span class="circadian-label">${String(p.year).slice(2)}</span>
        </div>`).join('');
    }
  }

  if (idealNote) {
    if (profile.totalSessions === 0) {
      idealNote.textContent = 'Nenhuma sessão registrada.';
    } else if (profile.idealBucket) {
      idealNote.innerHTML = `Sessão ideal: <strong>${escapeHtml(profile.idealBucket.label)}</strong>, com ${formatAccuracy(profile.idealBucket.accuracy)} de acertos em ${profile.idealBucket.questions} questões.`
        + (profile.trend && profile.trend.direction !== 'estavel'
          ? ` Desde ${profile.trend.fromYear}, suas sessões ficaram ${profile.trend.direction === 'mais_longas' ? 'mais longas' : 'mais curtas'} (${profile.trend.deltaMinutes > 0 ? '+' : ''}${profile.trend.deltaMinutes} min na mediana).`
          : '');
    } else {
      idealNote.textContent = `A sessão ideal aparece quando uma faixa de duração acumula pelo menos ${profile.minQuestions} questões.`;
    }
  }
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('/')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function positionTooltip(e, tooltip) {
  if (!tooltip) return;
  const x = Math.max(10, Math.min(window.innerWidth - 180, e.clientX));
  const y = Math.max(10, e.clientY);
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
