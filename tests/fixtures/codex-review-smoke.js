// Temporary fixture for checking automatic GitHub reviews; not production code.
export function formatReviewSmokeLabel(label) {
  const normalized = String(label ?? '').trim().replace(/\s+/g, ' ');
  return normalized;
}
