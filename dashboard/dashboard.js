import { AprovadoApi } from '../shared/api.js';
import { computeStudyMetrics, filterActivitiesByPeriod, formatDurationMs } from '../shared/analytics.js';
import { AprovadoExport } from '../shared/export.js';

let fullSnapshot = null;
let currentPeriod = 'all';
let selectedSubjectId = 'all';
let selectedStudyType = 'all';
let activitiesSearchQuery = '';
let currentPage = 1;
const PAGE_SIZE = 50;

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

async function init() {
  setLoading(true);

  try {
    const auth = await AprovadoApi.checkAuth();
    if (!auth.isAuthenticated) {
      showDisconnected();
      return;
    }

    fullSnapshot = await AprovadoApi.fetchCompleteSnapshot();
    renderUserHeader(fullSnapshot.user);
    populateFilterSelects(fullSnapshot);
    updateDashboard();
  } catch (err) {
    console.error('Erro ao inicializar dashboard:', err);
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
    fullSnapshot = await AprovadoApi.fetchCompleteSnapshot(true);
    renderUserHeader(fullSnapshot.user);
    populateFilterSelects(fullSnapshot);
    updateDashboard();
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

document.addEventListener('DOMContentLoaded', init);
