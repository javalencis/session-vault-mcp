import type { QualityResult, SessionInput } from '../types.js';

const GENERIC_TITLE_PATTERN = /^(session|test|prueba|sesion|untitled)$/i;

export function scoreSession(input: SessionInput): QualityResult {
  let score = 0;
  const reasons: string[] = [];

  const decisions = input.decisions ?? [];
  const nextSteps = input.nextSteps ?? [];
  const tags = input.tags ?? [];
  const summaryLength = input.summary.trim().length;
  const normalizedTitle = input.title.trim();

  if (decisions.length > 0) {
    score += 2;
    reasons.push('+2 includes at least one decision');
  }

  if (summaryLength > 50) {
    score += 2;
    reasons.push('+2 summary has meaningful length (>50 chars)');
  }

  if (nextSteps.length > 0) {
    score += 1;
    reasons.push('+1 includes next steps');
  }

  if (tags.length > 0 || Boolean(input.project?.trim())) {
    score += 1;
    reasons.push('+1 includes tags or project');
  }

  if (summaryLength < 20) {
    score -= 1;
    reasons.push('-1 summary is too short (<20 chars)');
  }

  if (GENERIC_TITLE_PATTERN.test(normalizedTitle)) {
    score -= 2;
    reasons.push('-2 title is too generic');
  }

  const tier: QualityResult['tier'] = score >= 3 ? 'save' : score === 2 ? 'low-quality' : 'reject';
  reasons.push(`tier=${tier}`);

  return { score, reasons, tier };
}
