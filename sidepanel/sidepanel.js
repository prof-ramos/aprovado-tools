import { escapeHtml, sanitizeColor } from '../shared/ui.js';
import { AprovadoApi } from '../shared/api.js';
import { computeStudyMetrics, filterActivitiesByPeriod, isCycleNotStarted } from '../shared/analytics.js';
import { AprovadoExport } from '../shared/export.js';
import { formatNumber, formatSyncLabel, getSnapshotSyncedAt } from '../shared/format.js';
import {
  createTimerState,
  getTimerStorageKey,
  isTimerOwnedBy,
  startTimer,
  pauseTimer,
  resumeTimer,
  getElapsedMs,
  formatElapsedTimer,
  buildActivityPayload
} from '../shared/timer.js';

let currentSnapshot = null;
let currentPeriod = 'all';
// Sync note appended to the "Atualizado há…" label while a refresh runs or after it fails.
let syncNote = '';
let loadSequence = 0;

// Active Timer state
let activeTimerState = createTimerState();
let timerTicker = null;
let restoringTimer = false;
let savingTimer = false;
let timerFeedbackTimeout = null;

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

// Timer DOM Elements
const timerDisplay = document.getElementById('timer-display');
const timerStatusBadge = document.getElementById('timer-status-badge');
const timerSelectMateria = document.getElementById('timer-select-materia');
const timerSelectConteudo = document.getElementById('timer-select-conteudo');
const timerExtraFields = document.getElementById('timer-extra-fields');
const timerSelectTipo = document.getElementById('timer-select-tipo');
const timerInputQuestoes = document.getElementById('timer-input-questoes');
const timerInputAcertos = document.getElementById('timer-input-acertos');
const timerInputAnotacoes = document.getElementById('timer-input-anotacoes');
const btnTimerStart = document.getElementById('btn-timer-start');
const btnTimerPause = document.getElementById('btn-timer-pause');
const btnTimerResume = document.getElementById('btn-timer-resume');
const btnTimerSave = document.getElementById('btn-timer-save');
const btnTimerDiscard = document.getElementById('btn-timer-discard');
const timerFeedback = document.getElementById('timer-feedback');

function renderSyncStatus() {
  const label = formatSyncLabel(getSnapshotSyncedAt(currentSnapshot));
  syncStatus.textContent = syncNote ? `${label} · ${syncNote}` : label;
}

async function loadData(force = false) {
  const load = ++loadSequence;
  setLoading(true);
  let showedCache = false;

  try {
    const snapshot = force
      ? await AprovadoApi.fetchCompleteSnapshot(true)
      : await AprovadoApi.loadSnapshotProgressive({
        onCached: cached => {
          if (load !== loadSequence) return;
          showedCache = true;
          currentSnapshot = cached;
          syncNote = 'atualizando…';
          renderPanel(cached);
          setLoading(false);
        }
      });
    if (load !== loadSequence) return;
    currentSnapshot = snapshot;
    syncNote = '';
    await renderPanel(snapshot);
  } catch (err) {
    if (load !== loadSequence) return;
    console.error('Falha ao carregar dados no painel lateral:', err);
    if (showedCache && err.status !== 401) {
      // Identity was confirmed and the saved data belongs to this account: keep it, say it is old.
      syncNote = 'não foi possível atualizar';
      renderSyncStatus();
    } else {
      showDisconnected();
    }
  } finally {
    if (load === loadSequence) setLoading(false);
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
  restoringTimer = false;
  resetTimerUI();
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
  return initTimerUI();
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

btnSync.addEventListener('click', () => {
  if (!savingTimer) return loadData(true);
});

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

// ----------------------------------------------------
// Timer Functions
// ----------------------------------------------------

function setTimerFeedback(msg, type = '', duration = 0) {
  if (!timerFeedback) return;
  if (timerFeedbackTimeout) clearTimeout(timerFeedbackTimeout);
  timerFeedbackTimeout = null;
  if (!msg) {
    timerFeedback.textContent = '';
    timerFeedback.classList.add('hidden');
    timerFeedback.classList.remove('error', 'success');
    return;
  }
  timerFeedback.textContent = msg;
  timerFeedback.classList.remove('hidden', 'error', 'success');
  if (type) timerFeedback.classList.add(type);
  if (duration) timerFeedbackTimeout = setTimeout(() => setTimerFeedback(''), duration);
}

function updateTimerDisplay() {
  if (!timerDisplay) return;
  const elapsed = getElapsedMs(activeTimerState);
  const formatted = formatElapsedTimer(elapsed);
  timerDisplay.textContent = formatted.text;
}

function startTimerTicker() {
  if (timerTicker) clearInterval(timerTicker);
  updateTimerDisplay();
  if (typeof setInterval === 'function') {
    timerTicker = setInterval(() => {
      updateTimerDisplay();
    }, 500);
  }
}

function stopTimerTicker() {
  if (timerTicker) {
    clearInterval(timerTicker);
    timerTicker = null;
  }
  updateTimerDisplay();
}

function populateTimerMaterias() {
  if (!timerSelectMateria) return;
  timerSelectMateria.innerHTML = '<option value="">Selecione uma matéria...</option>';
  for (const mat of currentSnapshot?.materias || []) {
    const opt = document.createElement('option');
    opt.value = String(mat.Id);
    opt.textContent = mat.Nome;
    timerSelectMateria.appendChild(opt);
  }
  const materiaId = activeTimerState.materia?.Id;
  timerSelectMateria.value = materiaId ? String(materiaId) : '';
  populateTimerConteudos(materiaId);
}

function getTimerMateria(materiaId) {
  return currentSnapshot?.materias?.find(m => String(m.Id) === String(materiaId));
}

function populateTimerConteudos(materiaId) {
  if (!timerSelectConteudo) return;
  timerSelectConteudo.innerHTML = '<option value="">Nenhum conteúdo</option>';
  timerSelectConteudo.value = '';
  const mat = getTimerMateria(materiaId);
  if (mat?.Conteudos && mat.Conteudos.length > 0) {
    for (const c of mat.Conteudos) {
      const opt = document.createElement('option');
      opt.value = String(c.Id);
      opt.textContent = c.Nome;
      timerSelectConteudo.appendChild(opt);
    }
  }
  if (activeTimerState.conteudo?.Id) {
    timerSelectConteudo.value = String(activeTimerState.conteudo.Id);
  }
}

function syncTimerUIWithState() {
  updateTimerDisplay();
  if (!timerStatusBadge) return;

  const isRunning = activeTimerState.status === 'running';
  const isPaused = activeTimerState.status === 'paused';
  const busy = restoringTimer || savingTimer;
  for (const button of [btnTimerStart, btnTimerPause, btnTimerResume, btnTimerSave, btnTimerDiscard]) {
    if (button) button.disabled = busy;
  }
  for (const field of [timerSelectTipo, timerInputQuestoes, timerInputAcertos, timerInputAnotacoes]) {
    if (field) field.disabled = busy;
  }
  btnSync.disabled = savingTimer;

  if (isRunning) {
    timerStatusBadge.textContent = 'Em andamento';
    timerStatusBadge.className = 'section-badge success';
    btnTimerStart?.classList.add('hidden');
    btnTimerPause?.classList.remove('hidden');
    btnTimerResume?.classList.add('hidden');
    btnTimerSave?.classList.add('hidden');
    btnTimerDiscard?.classList.add('hidden');
    timerExtraFields?.classList.add('hidden');
    if (timerSelectMateria) timerSelectMateria.disabled = true;
    if (timerSelectConteudo) timerSelectConteudo.disabled = true;
    startTimerTicker();
  } else if (isPaused) {
    timerStatusBadge.textContent = 'Pausado';
    timerStatusBadge.className = 'section-badge warning';
    btnTimerStart?.classList.add('hidden');
    btnTimerPause?.classList.add('hidden');
    btnTimerResume?.classList.remove('hidden');
    btnTimerSave?.classList.remove('hidden');
    btnTimerDiscard?.classList.remove('hidden');
    timerExtraFields?.classList.remove('hidden');
    if (timerSelectMateria) timerSelectMateria.disabled = true;
    if (timerSelectConteudo) timerSelectConteudo.disabled = true;
    stopTimerTicker();
  } else {
    timerStatusBadge.textContent = 'Parado';
    timerStatusBadge.className = 'section-badge';
    btnTimerStart?.classList.remove('hidden');
    btnTimerPause?.classList.add('hidden');
    btnTimerResume?.classList.add('hidden');
    btnTimerSave?.classList.add('hidden');
    btnTimerDiscard?.classList.add('hidden');
    timerExtraFields?.classList.add('hidden');
    if (timerSelectMateria) timerSelectMateria.disabled = busy;
    if (timerSelectConteudo) timerSelectConteudo.disabled = busy;
    stopTimerTicker();
  }
}

async function persistTimerState(state = activeTimerState) {
  const key = getTimerStorageKey(state.ownerId);
  if (!key || !globalThis.chrome?.storage?.local) return;
  try {
    await chrome.storage.local.set({ [key]: state });
  } catch (err) {
    console.error('Falha ao salvar estado do cronômetro:', err);
  }
}

function resetTimerUI(ownerId = null) {
  activeTimerState = createTimerState(null, null, ownerId);
  if (timerSelectTipo) timerSelectTipo.value = 'Teoria';
  for (const input of [timerInputQuestoes, timerInputAcertos, timerInputAnotacoes]) {
    if (input) input.value = '';
  }
  setTimerFeedback('');
  populateTimerMaterias();
  syncTimerUIWithState();
}

async function initTimerUI() {
  const userId = currentSnapshot?.user?.Id;
  if (isTimerOwnedBy(activeTimerState, userId)) {
    populateTimerMaterias();
    return;
  }

  const key = getTimerStorageKey(userId);
  restoringTimer = Boolean(key && globalThis.chrome?.storage?.local);
  resetTimerUI(userId);
  if (!restoringTimer) return;

  const initialState = activeTimerState;
  let storedState;
  try {
    const data = await chrome.storage.local.get([key]);
    storedState = data[key];
  } catch (err) {
    console.error('Falha ao restaurar cronômetro:', err);
  }
  // Another account may have been loaded while Chrome was reading storage.
  if (activeTimerState !== initialState) return;
  if (isTimerOwnedBy(storedState, userId)) activeTimerState = storedState;
  restoringTimer = false;
  populateTimerMaterias();
  syncTimerUIWithState();
}

function canChangeTimer(status) {
  return !savingTimer && !restoringTimer && activeTimerState.status === status &&
    isTimerOwnedBy(activeTimerState, currentSnapshot?.user?.Id);
}

function readTimerSelection() {
  const materia = getTimerMateria(timerSelectMateria?.value);
  const conteudo = materia?.Conteudos?.find(c => String(c.Id) === timerSelectConteudo?.value);
  return createTimerState(materia, conteudo, activeTimerState.ownerId);
}

timerSelectMateria?.addEventListener('change', () => {
  if (!canChangeTimer('stopped')) return;
  activeTimerState = createTimerState(getTimerMateria(timerSelectMateria.value), null, activeTimerState.ownerId);
  populateTimerConteudos(timerSelectMateria.value);
  persistTimerState();
});

timerSelectConteudo?.addEventListener('change', () => {
  if (!canChangeTimer('stopped')) return;
  activeTimerState = readTimerSelection();
  persistTimerState();
});

btnTimerStart?.addEventListener('click', () => {
  if (!canChangeTimer('stopped')) return;
  setTimerFeedback('');
  const selection = readTimerSelection();
  if (!selection.materia) {
    setTimerFeedback('Selecione uma matéria antes de iniciar.', 'error');
    return;
  }
  activeTimerState = startTimer(selection);
  syncTimerUIWithState();
  persistTimerState();
});

btnTimerPause?.addEventListener('click', () => {
  if (!canChangeTimer('running')) return;
  setTimerFeedback('');
  activeTimerState = pauseTimer(activeTimerState);
  syncTimerUIWithState();
  persistTimerState();
});

btnTimerResume?.addEventListener('click', () => {
  if (!canChangeTimer('paused')) return;
  setTimerFeedback('');
  activeTimerState = resumeTimer(activeTimerState);
  syncTimerUIWithState();
  persistTimerState();
});

btnTimerDiscard?.addEventListener('click', () => {
  if (!canChangeTimer('paused')) return;
  resetTimerUI(activeTimerState.ownerId);
  persistTimerState();
  setTimerFeedback('Sessão descartada.', '', 3000);
});

btnTimerSave?.addEventListener('click', async () => {
  if (!canChangeTimer('paused')) return;
  const submitted = activeTimerState;
  if (getElapsedMs(submitted) <= 0) {
    setTimerFeedback('A duração precisa ser maior que zero.', 'error');
    return;
  }

  savingTimer = true;
  syncTimerUIWithState();
  setTimerFeedback('Salvando atividade no AprovadoApp...', '');

  try {
    const options = {
      tipoEstudo: timerSelectTipo?.value || 'Teoria',
      exercicioQuantidade: timerInputQuestoes?.value ? Number(timerInputQuestoes.value) : null,
      exercicioAcerto: timerInputAcertos?.value ? Number(timerInputAcertos.value) : null,
      anotacoes: timerInputAnotacoes?.value || ''
    };

    await AprovadoApi.createActivity(buildActivityPayload(submitted, options), submitted.ownerId);
    if (activeTimerState !== submitted) {
      await persistTimerState(createTimerState(null, null, submitted.ownerId));
      return;
    }

    resetTimerUI(submitted.ownerId);
    setTimerFeedback('Atividade salva com sucesso! Sincronizando...', 'success');
    await persistTimerState();

    // Sincroniza snapshot para refletir a nova sessão nas métricas.
    await loadData(true);
    if (isTimerOwnedBy(submitted, currentSnapshot?.user?.Id)) {
      setTimerFeedback('Atividade registrada com sucesso! ✓', 'success', 4000);
    }
  } catch (err) {
    console.error('Erro ao salvar atividade:', err);
    if (activeTimerState !== submitted) return;
    if (err.status === 401) {
      await loadData(true);
      if (currentSnapshot) {
        setTimerFeedback('A autenticação mudou. O salvamento foi cancelado.', 'error');
      }
    } else {
      setTimerFeedback(`Erro ao salvar: ${err.message}`, 'error');
    }
  } finally {
    savingTimer = false;
    syncTimerUIWithState();
  }
});

// Initialize timer display immediately on script load
syncTimerUIWithState();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => loadData(false));
} else {
  loadData(false);
}
