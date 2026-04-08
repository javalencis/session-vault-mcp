import { describe, expect, it } from 'vitest';
import { scoreSession } from '../../src/scoring/quality.js';

describe('scoreSession', () => {
  it('adds +2 when decisions array has at least one item', () => {
    const result = scoreSession({
      title: 'Feature-ready title',
      summary: 'This summary has enough length to avoid penalties and ensure deterministic behavior.',
      decisions: ['Keep MCP tools isolated'],
    });

    expect(result.score).toBe(4);
  });

  it('adds +2 when summary length is greater than 50 chars', () => {
    const result = scoreSession({
      title: 'Feature-ready title',
      summary: 'This summary is deliberately longer than fifty characters.',
    });

    expect(result.score).toBe(2);
  });

  it('adds +1 when nextSteps has at least one item', () => {
    const result = scoreSession({
      title: 'Feature-ready title',
      summary: 'Long enough summary to avoid short penalty and isolate next steps.',
      nextSteps: ['Ship tests'],
    });

    expect(result.score).toBe(3);
  });

  it('adds +1 when tags has at least one item', () => {
    const result = scoreSession({
      title: 'Feature-ready title',
      summary: 'Long enough summary to avoid short penalty and isolate tags point.',
      tags: ['mvp'],
    });

    expect(result.score).toBe(3);
  });

  it('adds +1 when project is set and tags are absent', () => {
    const result = scoreSession({
      title: 'Feature-ready title',
      summary: 'Long enough summary to avoid short penalty and isolate project point.',
      project: 'session-vault',
    });

    expect(result.score).toBe(3);
  });

  it('subtracts -1 when summary length is less than 20 chars', () => {
    const result = scoreSession({
      title: 'Feature-ready title',
      summary: 'short summary',
    });

    expect(result.score).toBe(-1);
  });

  it('subtracts -2 when title is generic (case-insensitive)', () => {
    const result = scoreSession({
      title: 'SeSsIoN',
      summary: 'This summary is deliberately longer than fifty characters.',
    });

    expect(result.score).toBe(0);
  });

  it('returns save tier when score is >= 3', () => {
    const result = scoreSession({
      title: 'Implement Notion mapper edge cases',
      summary:
        'Implemented robust mapping for rich_text, select, relations and added multiple tests to verify conversions and consistency.',
      decisions: ['Use thin wrappers for Notion API'],
      nextSteps: ['Add MCP tools'],
      tags: ['notion', 'mvp'],
    });

    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.tier).toBe('save');
  });

  it('returns low-quality tier when score is exactly 2', () => {
    const result = scoreSession({
      title: 'Useful title',
      summary: 'A concise but still informative summary to clear fifty chars.',
    });

    expect(result.score).toBe(2);
    expect(result.tier).toBe('low-quality');
  });

  it('returns reject tier when score is <= 1', () => {
    const result = scoreSession({
      title: 'test',
      summary: 'short summary',
    });

    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.tier).toBe('reject');
  });

});
