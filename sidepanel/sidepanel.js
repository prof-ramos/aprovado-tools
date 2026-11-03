import { escapeHtml, sanitizeColor } from '../shared/ui.js';
import { AprovadoApi } from '../shared/api.js';
import { computeStudyMetrics, filterActivitiesByPeriod, isCycleNotStarted } from '../shared/analytics.js';
import { AprovadoExport } from '../shared/export.js';
import { formatNumber, formatSyncLabel, getSnapshotSyncedAt } from '../shared/format.js';

let currentSnapshot = null;
let currentPeriod = 'all';
// Sync note appended to the "Atualizado há…" label while a refresh runs or after it fails.
let syncNote = '';

// DOM Elements
const panelLoading = document.getElementById('panel-loading');
const panelDisconnected = document.getElementById('panel-disconnected');
const panelMain = document.getElementById('panel-main');

const btnSync = document.getElementById('btn-sync');
const btnOpenFull = document.getElementById('btn-open-full');
const btnLogin = document.getElementById('btn-login');

const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');

const kpiTime = document.getElementById('kpi-time');
const kpiAvg = document.getElementById('kpi-avg');
const kpiSessions = document.getElementById('kpi-sessions');
const kpiDays = document.getElementById('kpi-days');
const kpiQuestions = document.getElementById('kpi-questions');
const kpiAccuracy = document.getElementById('kpi-accuracy');
const kpiStreak = document.getElementById('kpi-streak');
const kpiLongest = document.getElementById('kpi-longest');

const sectionCiclo = document.getElementById('section-ciclo');
const cicloPct = document.getElementById('ciclo-pct');
const cicloProgressBar = document.getElementById('ciclo-progress-bar');
const cicloSubjectsList = document.getElementById('ciclo-subjects-list');

const sectionReviews = document.getElementById('section-reviews');
const reviewsCountBadge = document.getElementById('reviews-count-badge');
const reviewsList = document.getElementById('reviews-list');

const subjectsBars = document.getElementById('subjects-bars');

const syncStatus = document.getElementById('sync-status');
const todayTime = document.getElementById('today-time');
const todaySessions = document.getElementById('today-sessions');
const todayQuestions = document.getElementById('today-questions');
const todayEmpty = document.getElementById('today-empty');
const weekTime = document.getElementById('week-time');
const weekSessions = document.getElementById('week-sessions');
const weekDays = document.getElementById('week-days');
const cicloEmptyNote = document.getElementById('ciclo-empty-note');
const reviewsEmpty = document.getElementById('reviews-empty');

const btnExportSubjectsCsv = document.getElementById('btn-export-subjects-csv');
const btnExportCsv = document.getElementById('btn-export-csv');
const btnExportJson = document.getElementById('btn-export-json');
const btnCopyMd = document.getElementById('btn-copy-md');
const copyText = document.getElementById('copy-text');

const pillButtons = document.querySelectorAll('.pill-btn');

function renderSyncStatus() {
  const label = formatSyncLabel(getSnapshotSyncedAt(currentSnapshot));
  syncStatus.textContent = syncNote ? `${label} · ${syncNote}` : label;
}

async function loadData(force = false) {
  setLoading(true);
  let showedCache = false;

  try {
    if (force) {
      const auth = await AprovadoApi.checkAuth();
      if (!auth.isAuthenticated) {
        showDisconnected();
        return;
      }
      currentSnapshot = await AprovadoApi.fetchCompleteSnapshot(true);
    } else {
      // The account is confirmed first; only then is its saved snapshot shown right away
      // while the refresh runs in the background.
      currentSnapshot = await AprovadoApi.loadSnapshotProgressive({
        onCached: cached => {
          showedCache = true;
          currentSnapshot = cached;
          syncNote = 'atualizando…';
          renderPanel(cached);
          setLoading(false);
        }
      });
    }
    syncNote = '';
    renderPanel(currentSnapshot);
  } catch (err) {
    console.error('Falha ao carregar dados no painel lateral:', err);
    if (showedCache && err.status !== 401) {
      // Identity was confirmed and the saved data belongs to this account: keep it, say it is old.
      syncNote = 'não foi possível atualizar';
      renderSyncStatus();
    } else {
      showDisconnected();
    }
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  if (isLoading) {
    panelLoading.classList.remove('hidden');
    panelMain.classList.add('hidden');
    panelDisconnected.classList.add('hidden');
  } else {
    panelLoading.classList.add('hidden');
  }
}

function showDisconnected() {
  currentSnapshot = null;
  syncNote = '';
  for (const el of [syncStatus, todayTime, todaySessions, todayQuestions, weekTime, weekSessions, weekDays, userAvatar, userName, kpiTime, kpiAvg, kpiSessions, kpiDays,
    kpiQuestions, kpiAccuracy, kpiStreak, kpiLongest, cicloPct, reviewsCountBadge]) {
    el.textContent = '';
  }
  cicloProgressBar.style.width = '0%';
  for (const el of [cicloSubjectsList, reviewsList, subjectsBars]) el.innerHTML = '';
  sectionCiclo.classList.add('hidden');
  sectionReviews.classList.add('hidden');
  panelDisconnected.classList.remove('hidden');
  panelMain.classList.add('hidden');
}

function renderPanel(snapshot) {
  panelDisconnected.classList.add('hidden');
  panelMain.classList.remove('hidden');

  const user = snapshot.user || {};
  userAvatar.textContent = (user.Nome || 'E').charAt(0).toUpperCase();
  userName.textContent = `${user.Nome || ''} ${user.Sobrenome || ''}`.trim() || 'Estudante';

  renderSyncStatus();
  updateView();
}

function renderDaily() {
  const today = computeStudyMetrics(filterActivitiesByPeriod(currentSnapshot.atividades, 'today'), currentSnapshot.materias);
  todayTime.textContent = today.formattedTotalDuration;
  todaySessions.textContent = formatNumber(today.totalSessions, 0);
  todayQuestions.textContent = today.totalQuestions > 0 ? formatNumber(today.totalQuestions, 0) : '—';
  if (today.totalSessions === 0) todayEmpty.classList.remove('hidden');
  else todayEmpty.classList.add('hidden');

  const week = computeStudyMetrics(filterActivitiesByPeriod(currentSnapshot.atividades, '7d'), currentSnapshot.materias);
  weekTime.textContent = week.formattedTotalDuration;
  weekSessions.textContent = formatNumber(week.totalSessions, 0);
  weekDays.textContent = formatNumber(week.distinctDaysCount, 0);
}

function updateView() {
  if (!currentSnapshot) return;

  const filtered = filterActivitiesByPeriod(currentSnapshot.atividades, currentPeriod);
  const metrics = computeStudyMetrics(
    filtered,
    currentSnapshot.materias,
    currentSnapshot.ciclo,
    currentSnapshot.revisoesPendentes
  );

  renderDaily();

  // Render KPIs
  kpiTime.textContent = metrics.formattedTotalHours;
  kpiAvg.textContent = `${metrics.avgDailyDuration}/dia`;
  kpiSessions.textContent = formatNumber(metrics.totalSessions, 0);
  kpiDays.textContent = `${metrics.distinctDaysCount} dias`;

  if (metrics.totalQuestions > 0) {
    kpiQuestions.textContent = `${formatNumber(metrics.totalQuestions, 0)} questões`;
    kpiAccuracy.textContent = `${formatNumber(Number(metrics.overallAccuracy), 1)}% de acertos`;
  } else {
    kpiQuestions.textContent = '—';
    kpiAccuracy.textContent = 'Nenhuma questão registrada ainda';
  }

  kpiStreak.textContent = `${metrics.streak.current}d`;
  kpiLongest.textContent = `Recorde: ${metrics.streak.longest}d`;

  // Render Ciclo
  if (metrics.ciclo && metrics.ciclo.porcentagem !== undefined) {
    sectionCiclo.classList.remove('hidden');
    cicloPct.textContent = `${formatNumber(Number(metrics.ciclo.porcentagem), 1)}%`;
    cicloProgressBar.style.width = `${Math.min(100, Math.max(0, metrics.ciclo.porcentagem))}%`;
    if (isCycleNotStarted(metrics.ciclo)) cicloEmptyNote.classList.remove('hidden');
    else cicloEmptyNote.classList.add('hidden');

    cicloSubjectsList.innerHTML = '';
    const items = (metrics.ciclo.materias || []).slice(0, 5);
    items.forEach(m => {
      const row = document.createElement('div');
      row.className = 'ciclo-item';
      const mName = m.Nome || m.Materia?.Nome || 'Matéria';
      const mHrs = m.HorasExecutadasTexto || `${Math.floor((m.HorasExecutadas || 0) / 3600)}h`;
      row.innerHTML = `<span>${escapeHtml(mName)}</span><span style="color: var(--text-muted);">${escapeHtml(mHrs)}</span>`;
      cicloSubjectsList.appendChild(row);
    });
  } else {
    sectionCiclo.classList.add('hidden');
  }

  // Render Pending Reviews
  const reviews = currentSnapshot.revisoesPendentes || [];
  sectionReviews.classList.remove('hidden');
  reviewsCountBadge.textContent = reviews.length;
  reviewsList.innerHTML = '';
  if (reviews.length > 0) {
    reviewsEmpty.classList.add('hidden');

    reviews.slice(0, 4).forEach(r => {
      const item = document.createElement('div');
      item.className = 'review-item';
      const subName = r.Materia?.Nome || 'Revisão pendente';
      const contName = r.Conteudo?.Nome || 'Geral';
      const dateText = r.DataAgendamento || 'Atrasada';

      item.innerHTML = `
        <span class="review-subject">${escapeHtml(subName)} — ${escapeHtml(contName)}</span>
        <span class="review-meta">Agendado para: ${escapeHtml(dateText)}</span>
      `;
      reviewsList.appendChild(item);
    });
  } else {
    reviewsEmpty.classList.remove('hidden');
  }

  // Render Subjects bars
  subjectsBars.innerHTML = '';
  const topSubjects = metrics.subjects.slice(0, 8);
  if (topSubjects.length === 0) {
    subjectsBars.innerHTML = '<span style="font-size: 11px; color: var(--text-muted);">Nenhuma atividade registrada no período.</span>';
  } else {
    topSubjects.forEach(s => {
      const row = document.createElement('div');
      row.className = 'subject-bar-row';
      row.innerHTML = `
        <div class="subject-bar-info">
          <span class="subject-name-tag">
            <span class="subject-color-dot" style="background-color: ${sanitizeColor(s.color)};"></span>
            <span>${escapeHtml(s.name)}</span>
          </span>
          <span class="subject-bar-stats">${s.formattedHours} (${formatNumber(s.percentage, 0)}%)</span>
        </div>
        <div class="progress-bar-bg" style="height: 5px;">
          <div class="progress-bar-fill" style="width: ${s.percentage}%; background-color: ${sanitizeColor(s.color)};"></div>
        </div>
      `;
      subjectsBars.appendChild(row);
    });
  }
}

// Event Listeners
pillButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    pillButtons.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    currentPeriod = btn.dataset.period;
    updateView();
  });
});

btnSync.addEventListener('click', () => loadData(true));

btnOpenFull.addEventListener('click', async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
});

btnLogin.addEventListener('click', async () => {
  await chrome.tabs.create({ url: 'https://aprovadoapp.com' });
});

btnExportCsv.addEventListener('click', () => {
  if (!currentSnapshot?.atividades) return;
  const filtered = filterActivitiesByPeriod(currentSnapshot.atividades, currentPeriod);
  AprovadoExport.exportActivitiesCSV(filtered);
});

btnExportSubjectsCsv.addEventListener('click', () => {
  if (!currentSnapshot) return;
  const filtered = filterActivitiesByPeriod(currentSnapshot.atividades, currentPeriod);
  const metrics = computeStudyMetrics(filtered, currentSnapshot.materias);
  AprovadoExport.exportSubjectsSummaryCSV(metrics.subjects);
});

btnExportJson.addEventListener('click', () => {
  if (!currentSnapshot) return;
  AprovadoExport.exportFullBackupJSON(currentSnapshot);
});

btnCopyMd.addEventListener('click', async () => {
  if (!currentSnapshot) return;
  const filtered = filterActivitiesByPeriod(currentSnapshot.atividades, currentPeriod);
  const metrics = computeStudyMetrics(
    filtered,
    currentSnapshot.materias,
    currentSnapshot.ciclo,
    currentSnapshot.revisoesPendentes
  );
  try {
    await AprovadoExport.copyReportToClipboard(metrics, currentSnapshot.user);
    copyText.textContent = 'Copiado! ✓';
  } catch (err) {
    console.error('Falha ao copiar:', err);
    copyText.textContent = 'Falha ao copiar. Tente novamente.';
  }
  setTimeout(() => {
    copyText.textContent = 'Copiar relatório (Markdown)';
  }, 2000);
});

// Keep "Atualizado há…" honest while the panel stays open.
if (typeof setInterval === 'function') {
  setInterval(() => { if (currentSnapshot) renderSyncStatus(); }, 30000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => loadData(false));
} else {
  loadData(false);
}
