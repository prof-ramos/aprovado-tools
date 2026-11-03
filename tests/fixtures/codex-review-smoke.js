// Temporary fixture for checking automatic GitHub reviews; not production code.
export function formatReviewSmokeLabel(label) {
  return String(label ?? '').trim().replace(/\s+/g, ' ');
}
