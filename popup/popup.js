import { AprovadoApi } from '../shared/api.js';
import { computeStudyMetrics, filterActivitiesByPeriod } from '../shared/analytics.js';
import { AprovadoExport } from '../shared/export.js';
import { formatNumber } from '../shared/format.js';

let currentSnapshot = null;
let currentPeriod = 'all';

// DOM Elements
const loadingState = document.getElementById('loading-state');
const disconnectedState = document.getElementById('disconnected-state');
const connectedContent = document.getElementById('connected-content');
const authBadge = document.getElementById('auth-badge');
const authStatusText = document.getElementById('auth-status-text');

const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');

const kpiTime = document.getElementById('kpi-time');
const kpiAvgDay = document.getElementById('kpi-avg-day');
const kpiSessions = document.getElementById('kpi-sessions');
const kpiDaysCount = document.getElementById('kpi-days-count');
const kpiQuestions = document.getElementById('kpi-questions');
const kpiAccuracy = document.getElementById('kpi-accuracy');
const kpiStreak = document.getElementById('kpi-streak');
const kpiLongestStreak = document.getElementById('kpi-longest-streak');

const cyclePreview = document.getElementById('cycle-preview');
const cyclePct = document.getElementById('cycle-pct');
const cycleProgressFill = document.getElementById('cycle-progress-fill');

const btnLogin = document.getElementById('btn-login-aprovado');
const btnRetryAuth = document.getElementById('btn-retry-auth');
const btnRefresh = document.getElementById('btn-refresh');
const btnOpenDashboard = document.getElementById('btn-open-dashboard');
const btnOpenSidepanel = document.getElementById('btn-open-sidepanel');

const btnExportActivitiesCsv = document.getElementById('btn-export-activities-csv');
const btnExportSubjectsCsv = document.getElementById('btn-export-subjects-csv');
const btnExportBackupJson = document.getElementById('btn-export-backup-json');
const btnCopyMarkdown = document.getElementById('btn-copy-markdown');
const copyBtnText = document.getElementById('copy-btn-text');

const pillButtons = document.querySelectorAll('.pill-btn');

async function init() {
  setLoading(true);

  try {
    const auth = await AprovadoApi.checkAuth();
    if (!auth.isAuthenticated) {
      showDisconnected();
      return;
    }

    currentSnapshot = await AprovadoApi.fetchCompleteSnapshot();
    renderConnected(currentSnapshot);
  } catch (err) {
    console.error('Falha ao inicializar popup:', err);
    showDisconnected();
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  if (isLoading) {
    loadingState.classList.remove('hidden');
    connectedContent.classList.add('hidden');
    disconnectedState.classList.add('hidden');
  } else {
    loadingState.classList.add('hidden');
  }
}

function showDisconnected() {
  currentSnapshot = null;
  for (const el of [userAvatar, userName, userEmail, kpiTime, kpiAvgDay, kpiSessions,
    kpiDaysCount, kpiQuestions, kpiAccuracy, kpiStreak, kpiLongestStreak, cyclePct]) {
    el.textContent = '';
  }
  cycleProgressFill.style.width = '0%';
  cyclePreview.classList.add('hidden');
  authBadge.className = 'auth-badge disconnected';
  authStatusText.textContent = 'Desconectado';
  disconnectedState.classList.remove('hidden');
  connectedContent.classList.add('hidden');
}

function renderConnected(snapshot) {
  authBadge.className = 'auth-badge connected';
  authStatusText.textContent = 'Conectado';
  disconnectedState.classList.add('hidden');
  connectedContent.classList.remove('hidden');

  const user = snapshot.user || {};
  const initial = (user.Nome || 'E').charAt(0).toUpperCase();
  userAvatar.textContent = initial;
  userName.textContent = `${user.Nome || ''} ${user.Sobrenome || ''}`.trim() || 'Estudante';
  userEmail.textContent = user.Email || '';

  updateMetricsDisplay();
}

function updateMetricsDisplay() {
  if (!currentSnapshot) return;

  const filteredActivities = filterActivitiesByPeriod(currentSnapshot.atividades, currentPeriod);
  const metrics = computeStudyMetrics(
    filteredActivities,
    currentSnapshot.materias,
    currentSnapshot.ciclo,
    currentSnapshot.revisoesPendentes
  );

  kpiTime.textContent = metrics.formattedTotalHours;
  kpiAvgDay.textContent = `${metrics.avgDailyDuration}/dia`;
  kpiSessions.textContent = formatNumber(metrics.totalSessions, 0);
  kpiDaysCount.textContent = `${metrics.distinctDaysCount} dias ativos`;

  if (metrics.totalQuestions > 0) {
    kpiQuestions.textContent = `${formatNumber(metrics.totalQuestions, 0)} questões`;
    kpiAccuracy.textContent = `${formatNumber(Number(metrics.overallAccuracy), 1)}% de acertos`;
  } else {
    kpiQuestions.textContent = '0 questões';
    kpiAccuracy.textContent = 'Sem exercícios';
  }

  kpiStreak.textContent = `${metrics.streak.current} dias`;
  kpiLongestStreak.textContent = `Recorde: ${metrics.streak.longest}d`;

  // Cycle preview
  if (metrics.ciclo && metrics.ciclo.porcentagem !== undefined) {
    cyclePreview.classList.remove('hidden');
    cyclePct.textContent = `${formatNumber(Number(metrics.ciclo.porcentagem), 1)}%`;
    cycleProgressFill.style.width = `${Math.min(100, Math.max(0, metrics.ciclo.porcentagem))}%`;
  } else {
    cyclePreview.classList.add('hidden');
  }
}

// Event Listeners
pillButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    pillButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    updateMetricsDisplay();
  });
});

btnLogin.addEventListener('click', async () => {
  await chrome.tabs.create({ url: 'https://aprovadoapp.com' });
  window.close();
});

btnRetryAuth.addEventListener('click', () => {
  init();
});

btnRefresh.addEventListener('click', async () => {
  btnRefresh.disabled = true;
  setLoading(true);
  try {
    currentSnapshot = await AprovadoApi.fetchCompleteSnapshot(true);
    renderConnected(currentSnapshot);
  } catch (err) {
    console.error('Erro ao atualizar:', err);
    showDisconnected();
  } finally {
    btnRefresh.disabled = false;
    setLoading(false);
  }
});

btnOpenDashboard.addEventListener('click', async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
  window.close();
});

btnOpenSidepanel.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.windowId) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  }
});

// Export Handlers
btnExportActivitiesCsv.addEventListener('click', () => {
  if (!currentSnapshot || !currentSnapshot.atividades) return;
  const filtered = filterActivitiesByPeriod(currentSnapshot.atividades, currentPeriod);
  AprovadoExport.exportActivitiesCSV(filtered);
});

btnExportSubjectsCsv.addEventListener('click', () => {
  if (!currentSnapshot) return;
  const filtered = filterActivitiesByPeriod(currentSnapshot.atividades, currentPeriod);
  const metrics = computeStudyMetrics(filtered, currentSnapshot.materias);
  AprovadoExport.exportSubjectsSummaryCSV(metrics.subjects);
});

btnExportBackupJson.addEventListener('click', () => {
  if (!currentSnapshot) return;
  AprovadoExport.exportFullBackupJSON(currentSnapshot);
});

btnCopyMarkdown.addEventListener('click', async () => {
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
    copyBtnText.textContent = 'Copiado! ✓';
    setTimeout(() => {
      copyBtnText.textContent = 'Copiar Markdown';
    }, 2000);
  } catch (err) {
    console.error('Falha ao copiar:', err);
    copyBtnText.textContent = 'Falha ao copiar. Tente novamente.';
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
