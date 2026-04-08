export type SourceType = 'opencode' | 'claude-code' | 'manual';

export interface SessionInput {
  sessionKey?: string;
  key?: string;
  title: string;
  goal?: string;
  status?: string;
  summary: string;
  content?: string;
  goals?: string[];
  decisions?: string[];
  nextSteps?: string[];
  tags?: string[];
  project?: string;
  source?: SourceType;
}

export interface IdeaInput {
  title: string;
  description?: string;
  confidence?: number;
  sessionId?: string;
  tags?: string[];
  project?: string;
}

export interface SessionRecord {
  id: string;
  sessionKey?: string;
  key?: string;
  title: string;
  goal?: string;
  status?: string;
  summary: string;
  content?: string;
  goals?: string[];
  decisions?: string[];
  nextSteps?: string[];
  tags?: string[];
  project?: string;
  source?: SourceType;
  createdAt?: string;
  updatedAt?: string;
  url?: string;
}

export interface IdeaRecord {
  id: string;
  title: string;
  description?: string;
  confidence?: number;
  sessionId?: string;
  tags?: string[];
  project?: string;
  createdAt?: string;
  updatedAt?: string;
  url?: string;
}

export interface QualityResult {
  score: number;
  reasons: string[];
  tier: 'save' | 'low-quality' | 'reject';
}

export interface Config {
  notionApiKey: string;
  notionSessionsDbId?: string;
  notionIdeasDbId?: string;
  notionParentPageId?: string;
}

export type SessionVaultConfig = Config;
