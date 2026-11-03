/** Display formatting in pt-BR. Exports and persisted data keep their own machine formats. */
const formatters = new Map();

function formatter(digits) {
  if (!formatters.has(digits)) {
    formatters.set(digits, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  }
  return formatters.get(digits);
}

/** 1234.5 -> "1.234,5". Non-finite values render as an em dash. */
export function formatNumber(value, digits = 1) {
  const number = Number(value);
  return value === null || value === undefined || !Number.isFinite(number) ? '—' : formatter(digits).format(number);
}

/** 74.25 -> "74,3%". */
export function formatPercent(value, digits = 1) {
  const text = formatNumber(value, digits);
  return text === '—' ? text : `${text}%`;
}

/** 4460.14 -> "4.460,1h". */
export function formatHours(value, digits = 1) {
  const text = formatNumber(value, digits);
  return text === '—' ? text : `${text}h`;
}

/** Keeps a value's own precision (up to `maxDigits`) in pt-BR: 757.3 -> "757,3", 390.01 -> "390,01". */
export function formatValue(value, maxDigits = 2) {
  const number = Number(value);
  if (value === null || value === undefined || !Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: maxDigits }).format(number);
}

/** Instant (ms) of a snapshot's last successful sync, or null. The instant lives in the snapshot, so it never crosses accounts. */
export function getSnapshotSyncedAt(snapshot) {
  const value = snapshot?.syncedAt ? Date.parse(snapshot.syncedAt) : NaN;
  return Number.isFinite(value) ? value : null;
}

const pad2 = value => String(value).padStart(2, '0');

/**
 * Time elapsed since `value` (ms or ISO string) in pt-BR: "agora há pouco", "há 3 min",
 * "há 2 h", "ontem", then dd/mm/aaaa. Future values (clock skew) read as "agora há pouco".
 */
export function formatRelativeTime(value, now = Date.now()) {
  if (value === null || value === undefined || value === '') return '—';
  const then = typeof value === 'string' ? Date.parse(value) : Number(value);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return '—';

  const elapsed = now - then;
  if (elapsed < 60 * 1000) return 'agora há pouco';
  const minutes = Math.floor(elapsed / (60 * 1000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;

  const date = new Date(then);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'ontem';
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** "Atualizado há 3 min", "Atualizado ontem", "Atualizado em 20/10/2026" or "Ainda não sincronizado". */
export function formatSyncLabel(value, now = Date.now()) {
  const text = formatRelativeTime(value, now);
  if (text === '—') return 'Ainda não sincronizado';
  return /^\d/.test(text) ? `Atualizado em ${text}` : `Atualizado ${text}`;
}
