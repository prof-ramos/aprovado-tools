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
