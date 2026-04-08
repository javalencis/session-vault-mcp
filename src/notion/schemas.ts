export const SESSION_SOURCE_OPTIONS = ['opencode', 'claude-code', 'manual'] as const;

export const sessionsDatabaseSchema = {
  title: { name: 'Title', type: 'title' },
  sessionKey: { name: 'Session Key', type: 'rich_text' },
  goal: { name: 'Goal', type: 'rich_text' },
  status: { name: 'Status', type: 'select' },
  summary: { name: 'Summary', type: 'rich_text' },
  decisions: { name: 'Decisions', type: 'rich_text' },
  nextSteps: { name: 'Next Steps', type: 'rich_text' },
  tags: { name: 'Tags', type: 'multi_select' },
  project: { name: 'Project', type: 'rich_text' },
  source: { name: 'Source', type: 'select', options: SESSION_SOURCE_OPTIONS },
} as const;

export const ideasDatabaseSchema = {
  title: { name: 'Title', type: 'title' },
  description: { name: 'Description', type: 'rich_text' },
  tags: { name: 'Tags', type: 'multi_select' },
  project: { name: 'Project', type: 'rich_text' },
  sessionRelation: { name: 'Session Relation', type: 'relation' },
} as const;

export type SessionsDatabaseSchema = typeof sessionsDatabaseSchema;
export type IdeasDatabaseSchema = typeof ideasDatabaseSchema;
