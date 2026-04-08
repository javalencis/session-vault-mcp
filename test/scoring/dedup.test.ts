import { describe, expect, it } from 'vitest';
import { checkDuplicate } from '../../src/scoring/dedup.js';
import type { SessionRecord } from '../../src/types.js';

const baseSession = (title: string, id: string): SessionRecord => ({
  id,
  title,
  summary: 'summary',
});

describe('checkDuplicate', () => {
  it('detects exact duplicates ignoring case and spaces', () => {
    const sessions = [baseSession(' Add MCP Server ', '1')];
    const result = checkDuplicate('add mcp server', sessions);

    expect(result.isDuplicate).toBe(true);
    expect(result.similarSession?.id).toBe('1');
  });

  it('detects duplicate when candidate includes target', () => {
    const sessions = [baseSession('Add MCP server with registration', '2')];
    const result = checkDuplicate('Add MCP server', sessions);

    expect(result.isDuplicate).toBe(true);
    expect(result.similarSession?.id).toBe('2');
  });

  it('detects duplicate when target includes candidate', () => {
    const sessions = [baseSession('Notion client', '3')];
    const result = checkDuplicate('Notion client wrapper and mapper', sessions);

    expect(result.isDuplicate).toBe(true);
    expect(result.similarSession?.id).toBe('3');
  });

  it('returns non-duplicate when there is no similar title', () => {
    const sessions = [baseSession('Build CLI doctor command', '4')];
    const result = checkDuplicate('Implement search memories tool', sessions);

    expect(result.isDuplicate).toBe(false);
    expect(result.similarSession).toBeUndefined();
  });
});
