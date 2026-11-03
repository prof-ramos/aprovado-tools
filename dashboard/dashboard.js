import { AprovadoApi } from '../shared/api.js';
import {
  computeStudyMetrics,
  filterActivitiesByPeriod,
  formatDurationMs,
  formatDurationHours,
  computeHistoricalPatterns,
  computeActivityHeatmap
} from '../shared/analytics.js';
import { AprovadoExport } from '../shared/export.js';

let fullSnapshot = null;
let currentPeriod = 'all';
let selectedSubjectId = 'all';
let selectedStudyType = 'all';
let activitiesSearchQuery = '';
let currentPage = 1;
const PAGE_SIZE = 50;

let currentHeatmapYear = 2026;
let cachedHistoricalPatterns = null;

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

const segButtons = document.querySelectorAll('.seg-btn');
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
  setLoading(true);
  setupTabNavigation();

  const isExplicitMock = window.location.search.includes('mock=true');
  const hasStorage = Boolean(window.chrome?.storage?.local);

  try {
    if (isExplicitMock || !hasStorage) {
      fullSnapshot = await loadMockSnapshot();
    } else {
      const auth = await AprovadoApi.checkAuth();
      if (!auth.isAuthenticated) {
        showDisconnected();
        return;
      }
      fullSnapshot = await AprovadoApi.fetchCompleteSnapshot();
    }

    renderUserHeader(fullSnapshot.user);
    populateFilterSelects(fullSnapshot);
    updateDashboard();
    renderHistoricalPatternsTab(fullSnapshot.atividades, fullSnapshot.materias);
  } catch (err) {
    console.error('Falha ao inicializar dashboard:', err);
    showDisconnected();
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  if (isLoading) {
    loadingOverlay.classList.remove('hidden');
  } else {
    loadingOverlay.classList.add('hidden');
  }
}

function showDisconnected() {
  alertDisconnected.classList.remove('hidden');
  userStatusText.textContent = 'Desconectado';
  userStatusText.style.color = '#ef4444';
}

function renderUserHeader(user) {
  alertDisconnected.classList.add('hidden');
  if (!user) return;
  userAvatar.textContent = (user.Nome || 'E').charAt(0).toUpperCase();
  userDisplayName.textContent = `${user.Nome || ''} ${user.Sobrenome || ''}`.trim() || 'Estudante';
  userStatusText.textContent = 'Sincronizado via AprovadoApp';
  userStatusText.style.color = '#34d399';
}

function populateFilterSelects(snapshot) {
  // Populate Subjects
  selectSubject.innerHTML = '<option value="all">Todas as Disciplinas</option>';
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

  selectType.innerHTML = '<option value="all">Todas as Modalidades</option>';
  Array.from(typesSet).sort().forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    selectType.appendChild(opt);
  });
}

function getFilteredActivities() {
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

  if (activitiesSearchQuery) {
    const q = activitiesSearchQuery.toLowerCase();
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
  renderActivitiesTable(filtered);
}

function renderKpiBanner(metrics) {
  dashTotalTime.textContent = metrics.formattedTotalDuration;
  dashTotalHoursDecimal.textContent = `${metrics.formattedTotalHours} líquidas`;

  dashTotalSessions.textContent = metrics.totalSessions;
  dashActiveDays.textContent = `${metrics.distinctDaysCount} dias com estudo`;

  if (metrics.totalQuestions > 0) {
    dashQuestionsAccuracy.textContent = `${metrics.overallAccuracy}%`;
    dashQuestionsCounts.textContent = `${metrics.totalCorrect} acertos de ${metrics.totalQuestions} questões`;
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

function renderDailyTimelineChart(dailyHistory) {
  dailyTimelineChart.innerHTML = '';

  if (!dailyHistory || dailyHistory.length === 0) {
    dailyTimelineChart.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; margin: auto;">Nenhuma atividade no período selecionado.</div>';
    return;
  }

  // Show at most 30 recent entries for chart readability
  const data = dailyHistory.slice(-30);
  const maxHours = Math.max(...data.map(d => parseFloat(d.hours)), 0.1);

  data.forEach(item => {
    const col = document.createElement('div');
    col.className = 'chart-bar-col';

    const h = parseFloat(item.hours);
    const heightPct = Math.max(4, Math.round((h / maxHours) * 160));

    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    bar.style.height = `${heightPct}px`;
    bar.title = `${item.date}: ${item.hours}h (${item.count} sessões${item.questions ? `, ${item.questions} questões` : ''})`;

    const label = document.createElement('span');
    label.className = 'chart-bar-label';
    // Format "YYYY-MM-DD" -> "DD/MM"
    const parts = item.date.split('-');
    label.textContent = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.date;

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

  dashCicloPct.textContent = `${ciclo.porcentagem}%`;
  dashCicloFill.style.width = `${Math.min(100, Math.max(0, parseFloat(ciclo.porcentagem)))}%`;

  const execHrs = Math.floor((ciclo.executadas || 0) / 3600);
  const totalHrs = Math.floor((ciclo.totalHoras || 0) / 3600);
  dashCicloHoursInfo.textContent = `${execHrs}h executadas de ${totalHrs}h previstas nesta rodada`;

  dashCicloList.innerHTML = '';
  (ciclo.materias || []).slice(0, 5).forEach(m => {
    const row = document.createElement('div');
    row.className = 'ciclo-row';
    const name = m.Nome || m.Materia?.Nome || 'Disciplina';
    const hrs = m.HorasExecutadasTexto || `${Math.floor((m.HorasExecutadas || 0) / 3600)}h`;
    row.innerHTML = `
      <span>${name}</span>
      <span style="color: var(--text-muted); font-weight: 600;">${hrs}</span>
    `;
    dashCicloList.appendChild(row);
  });
}

function renderSubjectsSummary(subjects) {
  tbodySubjectsSummary.innerHTML = '';

  if (!subjects || subjects.length === 0) {
    tbodySubjectsSummary.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhuma disciplina encontrada.</td></tr>';
    return;
  }

  subjects.forEach(s => {
    const tr = document.createElement('tr');

    let accBadge = '<span style="color: var(--text-muted);">—</span>';
    if (s.questions > 0) {
      const cls = s.accuracy >= 80 ? 'accuracy-high' : (s.accuracy >= 65 ? 'accuracy-mid' : 'accuracy-low');
      accBadge = `<span class="accuracy-badge ${cls}">${s.accuracy.toFixed(1)}%</span>`;
    }

    tr.innerHTML = `
      <td>
        <div class="subject-cell">
          <span class="subject-dot" style="background-color: ${s.color};"></span>
          <span>${s.name}</span>
        </div>
      </td>
      <td><strong>${s.formattedHours}</strong></td>
      <td>${s.percentage.toFixed(1)}%</td>
      <td>${s.sessionsCount}</td>
      <td>${s.questions > 0 ? `${s.questions} (${s.correct} acertos)` : '—'}</td>
      <td>${accBadge}</td>
    `;
    tbodySubjectsSummary.appendChild(tr);
  });
}

function renderModalitiesAndShifts(metrics) {
  // Types
  studyTypesList.innerHTML = '';
  (metrics.types || []).forEach(t => {
    const row = document.createElement('div');
    row.className = 'type-row';
    row.innerHTML = `
      <div class="type-info">
        <strong>${t.name}</strong>
        <span style="color: var(--text-muted);">${t.formattedDuration} (${t.percentage.toFixed(1)}%)</span>
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

function renderActivitiesTable(activities) {
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
        ? `${a.ExercicioAcerto}/${a.ExercicioQuantidade} (${((a.ExercicioAcerto / a.ExercicioQuantidade) * 100).toFixed(0)}%)`
        : '—';

      tr.innerHTML = `
        <td>${a.DataInicio || '—'}</td>
        <td style="color: var(--text-muted);">${a.HoraInicio || '—'}</td>
        <td>
          <div class="subject-cell">
            <span class="subject-dot" style="background-color: ${a.Materia?.Cor || '#3b82f6'};"></span>
            <span>${a.Materia?.Nome || '—'}</span>
          </div>
        </td>
        <td>${a.Conteudo?.Nome || '<span style="color: var(--text-faint);">Geral</span>'}</td>
        <td><span class="badge-tag">${a.TipoEstudo || 'Manual'}</span></td>
        <td><strong>${durText}</strong></td>
        <td>${questionsText}</td>
        <td style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-muted);" title="${a.Anotacoes || ''}">${a.Anotacoes || '—'}</td>
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
    segButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
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
  updateDashboard();
});

btnPagePrev.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderActivitiesTable(getFilteredActivities());
  }
});

btnPageNext.addEventListener('click', () => {
  currentPage++;
  renderActivitiesTable(getFilteredActivities());
});

btnSyncNow.addEventListener('click', async () => {
  btnSyncNow.disabled = true;
  setLoading(true);
  try {
    const isExplicitMock = window.location.search.includes('mock=true');
    const hasStorage = Boolean(window.chrome?.storage?.local);
    if (isExplicitMock || !hasStorage) {
      fullSnapshot = await loadMockSnapshot();
    } else {
      fullSnapshot = await AprovadoApi.fetchCompleteSnapshot(true);
    }
    renderUserHeader(fullSnapshot.user);
    populateFilterSelects(fullSnapshot);
    updateDashboard();
    renderHistoricalPatternsTab(fullSnapshot.atividades, fullSnapshot.materias);
  } catch (err) {
    console.error('Erro na sincronização:', err);
    showDisconnected();
  } finally {
    btnSyncNow.disabled = false;
    setLoading(false);
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
  const filtered = getFilteredActivities();
  AprovadoExport.exportActivitiesCSV(filtered);
});

exportCsvSubjects.addEventListener('click', () => {
  if (!fullSnapshot) return;
  const filtered = getFilteredActivities();
  const metrics = computeStudyMetrics(filtered, fullSnapshot.materias);
  AprovadoExport.exportSubjectsSummaryCSV(metrics.subjects);
});

exportJsonBackup.addEventListener('click', () => {
  if (!fullSnapshot) return;
  AprovadoExport.exportFullBackupJSON(fullSnapshot);
});

exportCopyMd.addEventListener('click', async () => {
  if (!fullSnapshot) return;
  const filtered = getFilteredActivities();
  const metrics = computeStudyMetrics(
    filtered,
    fullSnapshot.materias,
    fullSnapshot.ciclo,
    fullSnapshot.revisoesPendentes
  );
  await AprovadoExport.copyReportToClipboard(metrics, fullSnapshot.user);
  copyReportTitle.textContent = 'Relatório Copiado! ✓';
  setTimeout(() => {
    copyReportTitle.textContent = 'Copiar Relatório (Markdown)';
  }, 2000);
});

/* ==========================================================================
   Tab Navigation & Historical Patterns Renderers
   ========================================================================== */

function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.dash-tab-btn');
  const tabPanes = document.querySelectorAll('.dash-tab-pane');
  const filterBar = document.querySelector('.filter-bar');

  function switchTab(targetTabId) {
    tabButtons.forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === targetTabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.tabIndex = isActive ? 0 : -1;
    });

    tabPanes.forEach(pane => {
      const isActive = pane.id === targetTabId;
      pane.classList.toggle('active', isActive);
      pane.classList.toggle('hidden', !isActive);
    });

    if (filterBar) {
      filterBar.classList.toggle('hidden', targetTabId !== 'tab-overview');
    }

    if (targetTabId === 'tab-historical-patterns' && fullSnapshot) {
      renderHistoricalPatternsTab(fullSnapshot.atividades, fullSnapshot.materias);
    }
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      switchTab(target);
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const btnArray = Array.from(tabButtons);
        const currentIndex = btnArray.indexOf(btn);
        const nextIndex = e.key === 'ArrowRight'
          ? (currentIndex + 1) % btnArray.length
          : (currentIndex - 1 + btnArray.length) % btnArray.length;
        btnArray[nextIndex].focus();
        btnArray[nextIndex].click();
      }
    });
  });
}

function renderHistoricalPatternsTab(activities = [], materias = []) {
  if (!activities || !activities.length) return;

  const patterns = computeHistoricalPatterns(activities, materias);
  cachedHistoricalPatterns = patterns;

  renderExecutiveSummaryMetrics(patterns.history);
  renderMultiannualCards(patterns.history);
  setupHeatmapControls(activities, patterns.history);
  renderCircadian(patterns.circadian);
  renderQuadrants(patterns.quadrants);
  renderMixAndInsights(patterns.mix, patterns.insights);
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
  if (histYearsRange) histYearsRange.textContent = `${historyData.startYear} – ${historyData.endYear}`;

  if (histTotalHours) {
    const totalMs = historyData.years.reduce((acc, y) => acc + (y.totalDurationMs || 0), 0);
    histTotalHours.textContent = formatDurationMs(totalMs);
  }
  if (histTotalHoursDecimal) {
    histTotalHoursDecimal.textContent = `${historyData.totalCumulativeHours.toFixed(1)} horas líquidas`;
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
      ? `${historyData.overallHistoricalAccuracy.toFixed(1)}%`
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
      ? `${historyData.peakYear.hours.toFixed(1)}h no melhor ano`
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

    card.innerHTML = `
      <div class="year-card-header">
        <div class="year-title-wrap">
          <span class="year-number">${yearData.year}</span>
          ${yearData.isCurrentYear ? '<span class="current-year-tag">Em Andamento</span>' : ''}
        </div>
        <span class="phase-badge ${phaseClass}" title="${escapeHtml(yearData.phaseDescription)}">${escapeHtml(yearData.phaseLabel)}</span>
      </div>
      <div class="year-hours-main">${yearData.totalHours.toFixed(1)}h</div>
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
          <span class="year-meta-val">${yearData.accuracy !== null ? yearData.accuracy.toFixed(1) + '%' : 'N/A'}</span>
        </div>
        <div class="year-meta-item">
          <span>Média diária:</span>
          <span class="year-meta-val">${yearData.avgDailyHoursActive.toFixed(1)}h/dia</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function setupHeatmapControls(activities, historyData) {
  const select = document.getElementById('heatmap-year-select');
  if (!select) return;

  const start = historyData?.startYear || 2016;
  const end = historyData?.endYear || 2026;

  if (select.children.length === 0) {
    for (let y = end; y >= start; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `${y}`;
      if (y === currentHeatmapYear) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener('change', () => {
      currentHeatmapYear = parseInt(select.value, 10);
      renderHeatmap(activities, currentHeatmapYear);
    });
  }

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

  if (kpiHours) kpiHours.textContent = `${heatmapData.totalYearHours.toFixed(1)}h (${heatmapData.formattedTotalHours})`;
  if (kpiDays) kpiDays.textContent = `${heatmapData.activeDaysCount} de ${heatmapData.totalDays} dias`;
  if (kpiPeakDay) {
    kpiPeakDay.textContent = heatmapData.maxDailyHours > 0
      ? `${heatmapData.maxDailyHours.toFixed(1)}h (${formatDateBR(heatmapData.maxDailyDate)})`
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

  // Tooltip listeners
  if (tooltip) {
    const cells = container.querySelectorAll('.heatmap-cell');
    cells.forEach(cell => {
      const inYear = cell.getAttribute('data-in-year') === 'true';
      if (!inYear) return;

      cell.addEventListener('mouseenter', (e) => {
        const date = cell.getAttribute('data-date');
        const hours = parseFloat(cell.getAttribute('data-hours') || '0');
        const duration = cell.getAttribute('data-duration') || '0h 0m';
        const sessions = parseInt(cell.getAttribute('data-sessions') || '0', 10);
        const questions = parseInt(cell.getAttribute('data-questions') || '0', 10);
        const correct = parseInt(cell.getAttribute('data-correct') || '0', 10);
        const acc = questions > 0 ? ((correct / questions) * 100).toFixed(1) + '%' : 'N/A';

        tooltip.innerHTML = `
          <div class="tooltip-title">${formatDateBR(date)}</div>
          <div class="tooltip-row"><span>Duração:</span><strong>${duration} (${hours.toFixed(1)}h)</strong></div>
          <div class="tooltip-row"><span>Sessões:</span><strong>${sessions}</strong></div>
          <div class="tooltip-row"><span>Questões:</span><strong>${questions > 0 ? `${correct}/${questions} (${acc})` : 'Nenhuma'}</strong></div>
        `;
        tooltip.classList.remove('hidden');
        tooltip.setAttribute('aria-hidden', 'false');
        positionTooltip(e, tooltip);
      });

      cell.addEventListener('mousemove', (e) => {
        positionTooltip(e, tooltip);
      });

      cell.addEventListener('mouseleave', () => {
        tooltip.classList.add('hidden');
        tooltip.setAttribute('aria-hidden', 'true');
      });
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

      const accText = h.accuracy !== null ? `${h.accuracy.toFixed(1)}%` : 'N/A';
      col.title = `${h.label}: ${h.hours.toFixed(1)}h (${h.percentage.toFixed(1)}%) • ${h.sessions} sessões • Assertividade: ${accText}`;

      col.innerHTML = `
        <div class="circadian-bar ${isPeak ? 'is-peak' : ''}" style="height: ${heightPercent.toFixed(1)}%"></div>
        <span class="circadian-label">${h.hour % 2 === 0 ? h.label : ''}</span>
      `;
      histogramContainer.appendChild(col);
    });
  }

  if (peakNote) {
    const peakLabel = circadianData.peakHour?.label || `${String(circadianData.peakHour?.hour ?? 0).padStart(2, '0')}h`;
    peakNote.innerHTML = `Pico de estudo às <strong>${peakLabel}</strong> com <strong>${circadianData.peakHour.hours.toFixed(1)}h</strong> (${circadianData.peakHour.percentage.toFixed(1)}% do tempo total)`;
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
          <span>${s.name}</span>
          ${isDominant ? '<span class="dominant-tag">Turno dominante</span>' : ''}
        </div>
        <div class="shift-hours-val">${shiftData.hours.toFixed(1)}h</div>
        <div class="shift-card-footer">
          <span class="shift-pct-pill">${shiftData.percentage.toFixed(1)}%</span>
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
              <span>${day.hours.toFixed(1)}h</span>
              <div class="progress-bar-bg" style="width: 80px; height: 6px;">
                <div class="progress-bar-fill" style="width: ${barWidth.toFixed(0)}%"></div>
              </div>
            </div>
          </td>
          <td>${day.percentage.toFixed(1)}%</td>
          <td>${day.sessions}</td>
          <td>${day.activeDaysCount}</td>
          <td>
            <span title="Posição em consistência: ${day.consistencyRank}º">${day.consistencyScore.toFixed(0)}% (${day.consistencyRank}º)</span>
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
      Corte de Tempo (Mediana): <strong>${quadrantsData.medianHours.toFixed(1)}h</strong> • 
      Corte de Assertividade: <strong>${quadrantsData.accuracyCutoff.toFixed(1)}%</strong> • 
      Disciplinas Classificadas: <strong>${quadrantsData.summary.totalSubjects}</strong> 
      (<strong>${quadrantsData.summary.strongCount}</strong> pontos fortes, 
      <strong>${quadrantsData.summary.bottlenecksCount}</strong> gargalos críticos)
    `;
  }

  // Collect subjects
  const { pontosFortes, gargalosCriticos, baseSolida, zonaRisco, semExercicios } = quadrantsData.quadrants;
  const plottedSubjects = [...pontosFortes, ...gargalosCriticos, ...baseSolida, ...zonaRisco];

  // SVG Geometry
  const svgWidth = 600;
  const svgHeight = 360;
  const left = 60;
  const right = 30;
  const top = 30;
  const bottom = 45;
  const plotWidth = svgWidth - left - right;
  const plotHeight = svgHeight - top - bottom;

  const maxHoursRaw = Math.max(...plottedSubjects.map(s => s.totalHours), quadrantsData.medianHours * 1.5, 20);
  const maxHours = Math.ceil(maxHoursRaw / 10) * 10;

  const cutoffX = left + (quadrantsData.medianHours / maxHours) * plotWidth;
  const cutoffY = top + (1 - (quadrantsData.accuracyCutoff / 100)) * plotHeight;

  let svgHtml = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="quadrant-svg" role="img" aria-label="Matriz de Rendimento: Tempo vs Assertividade">
      <!-- Background Quadrant Tints -->
      <!-- Base Sólida (Top-Left: low hours, high accuracy) -->
      <rect x="${left}" y="${top}" width="${cutoffX - left}" height="${cutoffY - top}" class="matrix-quadrant-bg q-solida" />
      <text x="${left + 10}" y="${top + 20}" fill="#3b82f6" font-size="11" font-weight="700" opacity="0.6">BASE SÓLIDA</text>

      <!-- Pontos Fortes (Top-Right: high hours, high accuracy) -->
      <rect x="${cutoffX}" y="${top}" width="${left + plotWidth - cutoffX}" height="${cutoffY - top}" class="matrix-quadrant-bg q-fortes" />
      <text x="${left + plotWidth - 10}" y="${top + 20}" text-anchor="end" fill="#10b981" font-size="11" font-weight="700" opacity="0.6">PONTOS FORTES</text>

      <!-- Zona de Risco (Bottom-Left: low hours, low accuracy) -->
      <rect x="${left}" y="${cutoffY}" width="${cutoffX - left}" height="${top + plotHeight - cutoffY}" class="matrix-quadrant-bg q-risco" />
      <text x="${left + 10}" y="${top + plotHeight - 10}" fill="#f59e0b" font-size="11" font-weight="700" opacity="0.6">ZONA DE RISCO</text>

      <!-- Gargalos Críticos (Bottom-Right: high hours, low accuracy) -->
      <rect x="${cutoffX}" y="${cutoffY}" width="${left + plotWidth - cutoffX}" height="${top + plotHeight - cutoffY}" class="matrix-quadrant-bg q-gargalos" />
      <text x="${left + plotWidth - 10}" y="${top + plotHeight - 10}" text-anchor="end" fill="#f87171" font-size="11" font-weight="600" opacity="0.8">Gargalos críticos</text>

      <!-- Cutoff Lines -->
      <line x1="${cutoffX}" y1="${top}" x2="${cutoffX}" y2="${top + plotHeight}" class="matrix-cutoff-line" />
      <line x1="${left}" y1="${cutoffY}" x2="${left + plotWidth}" y2="${cutoffY}" class="matrix-cutoff-line" />

      <!-- Cutoff Labels -->
      <text x="${cutoffX + 4}" y="${top + 14}" fill="#f59e0b" font-size="9" font-weight="600">Mediana: ${quadrantsData.medianHours.toFixed(1)}h</text>
      <text x="${left + 4}" y="${cutoffY - 4}" fill="#f59e0b" font-size="9" font-weight="600">Corte: ${quadrantsData.accuracyCutoff.toFixed(1)}%</text>

      <!-- Axes -->
      <line x1="${left}" y1="${top + plotHeight}" x2="${left + plotWidth}" y2="${top + plotHeight}" stroke="#334155" stroke-width="1.5" />
      <line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="#334155" stroke-width="1.5" />

      <!-- Y-Axis Labels -->
      <text x="${left - 8}" y="${top + 4}" text-anchor="end" fill="#64748b" font-size="9">100%</text>
      <text x="${left - 8}" y="${top + (plotHeight * 0.5) + 4}" text-anchor="end" fill="#64748b" font-size="9">50%</text>
      <text x="${left - 8}" y="${top + plotHeight + 3}" text-anchor="end" fill="#64748b" font-size="9">0%</text>
      <text x="${left - 25}" y="${top + (plotHeight * 0.5)}" text-anchor="middle" fill="#94a3b8" font-size="10" transform="rotate(-90 ${left - 25} ${top + (plotHeight * 0.5)})">Assertividade (%)</text>

      <!-- X-Axis Labels -->
      <text x="${left}" y="${top + plotHeight + 16}" text-anchor="middle" fill="#64748b" font-size="9">0h</text>
      <text x="${left + (plotWidth * 0.5)}" y="${top + plotHeight + 16}" text-anchor="middle" fill="#64748b" font-size="9">${(maxHours * 0.5).toFixed(0)}h</text>
      <text x="${left + plotWidth}" y="${top + plotHeight + 16}" text-anchor="middle" fill="#64748b" font-size="9">${maxHours}h</text>
      <text x="${left + (plotWidth * 0.5)}" y="${top + plotHeight + 32}" text-anchor="middle" fill="#94a3b8" font-size="10">Tempo Investido (Horas)</text>

      <!-- Plotted Subject Circles -->
  `;

  plottedSubjects.forEach(s => {
    const cx = left + (s.totalHours / maxHours) * plotWidth;
    const cy = top + (1 - (s.accuracy / 100)) * plotHeight;
    svgHtml += `
      <circle
        cx="${cx.toFixed(1)}"
        cy="${cy.toFixed(1)}"
        r="7"
        fill="${s.color || '#3b82f6'}"
        stroke="#ffffff"
        stroke-width="1.5"
        class="matrix-dot"
        data-name="${escapeHtml(s.name)}"
        data-hours="${s.totalHours}"
        data-acc="${s.accuracy}"
        data-questions="${s.questions}"
        data-correct="${s.correct}"
      >
        <title>${escapeHtml(s.name)}: ${s.totalHours}h | ${s.accuracy}% acertos</title>
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
          <div class="tooltip-title">${name}</div>
          <div class="tooltip-row"><span>Tempo Total:</span><strong>${hours.toFixed(1)}h</strong></div>
          <div class="tooltip-row"><span>Assertividade:</span><strong>${acc.toFixed(1)}%</strong></div>
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
        <div class="method-alert-box">
          <strong>Alerta de método:</strong> Alto tempo investido com assertividade abaixo do corte (${quadrantsData.accuracyCutoff}%). Interrompa leituras passivas e utilize engenharia reversa com foco nos cadernos de erros.
        </div>
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
        <strong>Disciplinas sem exercícios registrados:</strong> 
        ${semExercicios.map(s => `<strong>${escapeHtml(s.name)}</strong> (${s.totalHours.toFixed(1)}h)`).join(', ')}. 
        Resolva questões para calibrar o rendimento e posicionar na matriz.
      `;
    } else {
      semExerciciosContainer.classList.add('hidden');
    }
  }
}

function renderSubjectPills(subjects = []) {
  if (!subjects.length) {
    return `<div style="font-size: 11px; color: var(--text-faint); padding: 4px 0;">Nenhuma disciplina neste quadrante.</div>`;
  }
  return subjects.map(s => `
    <div class="subject-pill">
      <div class="subject-pill-left">
        <span class="subject-dot" style="background-color: ${s.color || '#3b82f6'};"></span>
        <span style="font-weight: 600;">${escapeHtml(s.name)}</span>
      </div>
      <div class="subject-pill-right">
        <span>${s.totalHours.toFixed(1)}h</span>
        <span class="accuracy-badge ${s.accuracy >= 75 ? 'acc-high' : 'acc-low'}">${s.accuracy !== null ? s.accuracy.toFixed(1) + '%' : 'N/A'}</span>
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
      <div class="mix-segment mix-seg-teoria" style="width: ${teoria.percentage.toFixed(1)}%" title="Teoria: ${teoria.hours.toFixed(1)}h (${teoria.percentage.toFixed(1)}%)">
        ${teoria.percentage >= 8 ? `${teoria.percentage.toFixed(0)}%` : ''}
      </div>
      <div class="mix-segment mix-seg-questoes" style="width: ${questoes.percentage.toFixed(1)}%" title="Questões: ${questoes.hours.toFixed(1)}h (${questoes.percentage.toFixed(1)}%)">
        ${questoes.percentage >= 8 ? `${questoes.percentage.toFixed(0)}%` : ''}
      </div>
      <div class="mix-segment mix-seg-revisao" style="width: ${revisao.percentage.toFixed(1)}%" title="Revisão: ${revisao.hours.toFixed(1)}h (${revisao.percentage.toFixed(1)}%)">
        ${revisao.percentage >= 8 ? `${revisao.percentage.toFixed(0)}%` : ''}
      </div>
      <div class="mix-segment mix-seg-outros" style="width: ${outros.percentage.toFixed(1)}%" title="Outros: ${outros.hours.toFixed(1)}h (${outros.percentage.toFixed(1)}%)">
        ${outros.percentage >= 8 ? `${outros.percentage.toFixed(0)}%` : ''}
      </div>
    `;
  }

  // Legend
  if (mixLegend) {
    const { teoria, questoes, revisao, outros } = mixData.proportions;
    mixLegend.innerHTML = `
      <div class="mix-legend-item">
        <span class="mix-legend-dot" style="background-color: #3b82f6;"></span>
        <span>Teoria: <strong>${teoria.percentage.toFixed(1)}%</strong> (${teoria.hours.toFixed(1)}h)</span>
      </div>
      <div class="mix-legend-item">
        <span class="mix-legend-dot" style="background-color: #10b981;"></span>
        <span>Questões: <strong>${questoes.percentage.toFixed(1)}%</strong> (${questoes.hours.toFixed(1)}h)</span>
      </div>
      <div class="mix-legend-item">
        <span class="mix-legend-dot" style="background-color: #f59e0b;"></span>
        <span>Revisão: <strong>${revisao.percentage.toFixed(1)}%</strong> (${revisao.hours.toFixed(1)}h)</span>
      </div>
      <div class="mix-legend-item">
        <span class="mix-legend-dot" style="background-color: #8b5cf6;"></span>
        <span>Outros: <strong>${outros.percentage.toFixed(1)}%</strong> (${outros.hours.toFixed(1)}h)</span>
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
          <span class="rec-badge badge-${rec.severity}">${escapeHtml(rec.severity)}</span>
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
        <div class="synthesis-heading">2. Padrão circadiano e cronotipo</div>
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
    `;
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

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
