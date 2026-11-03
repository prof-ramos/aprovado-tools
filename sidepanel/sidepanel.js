import { escapeHtml, sanitizeColor } from '../shared/ui.js';
import { AprovadoApi } from '../shared/api.js';
import { computeStudyMetrics, filterActivitiesByPeriod } from '../shared/analytics.js';
import { AprovadoExport } from '../shared/export.js';
import { formatNumber } from '../shared/format.js';

let currentSnapshot = null;
let currentPeriod = 'all';

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

const btnExportCsv = document.getElementById('btn-export-csv');
const btnExportJson = document.getElementById('btn-export-json');
const btnCopyMd = document.getElementById('btn-copy-md');
const copyText = document.getElementById('copy-text');

const pillButtons = document.querySelectorAll('.pill-btn');

async function loadData(force = false) {
  setLoading(true);

  try {
    const auth = await AprovadoApi.checkAuth();
    if (!auth.isAuthenticated) {
      showDisconnected();
      return;
    }

    currentSnapshot = await AprovadoApi.fetchCompleteSnapshot(force);
    renderPanel(currentSnapshot);
  } catch (err) {
    console.error('Falha ao carregar dados no painel lateral:', err);
    showDisconnected();
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
  for (const el of [userAvatar, userName, kpiTime, kpiAvg, kpiSessions, kpiDays,
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

  updateView();
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

  // Render KPIs
  kpiTime.textContent = metrics.formattedTotalHours;
  kpiAvg.textContent = `${metrics.avgDailyDuration}/dia`;
  kpiSessions.textContent = formatNumber(metrics.totalSessions, 0);
  kpiDays.textContent = `${metrics.distinctDaysCount} dias`;

  if (metrics.totalQuestions > 0) {
    kpiQuestions.textContent = `${formatNumber(metrics.totalQuestions, 0)} questões`;
    kpiAccuracy.textContent = `${formatNumber(Number(metrics.overallAccuracy), 1)}% de acertos`;
  } else {
    kpiQuestions.textContent = '0 questões';
    kpiAccuracy.textContent = '0% acertos';
  }

  kpiStreak.textContent = `${metrics.streak.current}d`;
  kpiLongest.textContent = `Recorde: ${metrics.streak.longest}d`;

  // Render Ciclo
  if (metrics.ciclo && metrics.ciclo.porcentagem !== undefined) {
    sectionCiclo.classList.remove('hidden');
    cicloPct.textContent = `${formatNumber(Number(metrics.ciclo.porcentagem), 1)}%`;
    cicloProgressBar.style.width = `${Math.min(100, Math.max(0, metrics.ciclo.porcentagem))}%`;

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
  if (reviews.length > 0) {
    sectionReviews.classList.remove('hidden');
    reviewsCountBadge.textContent = reviews.length;
    reviewsList.innerHTML = '';

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
    sectionReviews.classList.add('hidden');
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
          <span class="subject-bar-stats">${s.formattedHours} (${s.percentage.toFixed(0)}%)</span>
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
    pillButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
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
    copyText.textContent = 'Copiado para Área de Transferência! ✓';
  } catch (err) {
    console.error('Falha ao copiar:', err);
    copyText.textContent = 'Falha ao copiar. Tente novamente.';
  }
  setTimeout(() => {
    copyText.textContent = '📋 Copiar Resumo em Markdown';
  }, 2000);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => loadData(false));
} else {
  loadData(false);
}
