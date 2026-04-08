import type { SessionRecord } from '../types.js';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function checkDuplicate(
  title: string,
  recentSessions: SessionRecord[],
): { isDuplicate: boolean; similarSession?: SessionRecord } {
  const target = normalize(title);

  if (!target) {
    return { isDuplicate: false };
  }

  for (const session of recentSessions) {
    const candidate = normalize(session.title);
    if (!candidate) {
      continue;
    }

    if (candidate === target || candidate.includes(target) || target.includes(candidate)) {
      return { isDuplicate: true, similarSession: session };
    }
  }

  return { isDuplicate: false };
}
