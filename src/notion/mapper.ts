import type { IdeaInput, IdeaRecord, SessionInput, SessionRecord } from '../types.js';
import { ideasDatabaseSchema, sessionsDatabaseSchema } from './schemas.js';

type NotionProperties = Record<string, unknown>;

function toTitle(content: string) {
  return { title: [{ type: 'text', text: { content } }] };
}

function toRichText(content?: string) {
  if (!content) {
    return { rich_text: [] };
  }

  return { rich_text: [{ type: 'text', text: { content } }] };
}

function toMultiSelect(values?: string[]) {
  return { multi_select: (values ?? []).map((name) => ({ name })) };
}

function toSelect(value?: string) {
  if (!value) {
    return { select: null };
  }
  return { select: { name: value } };
}

function toRelation(pageId?: string) {
  return { relation: pageId ? [{ id: pageId }] : [] };
}

function fromTitle(prop: any): string {
  return prop?.title?.map((item: any) => item?.plain_text ?? '').join('') ?? '';
}

function fromRichText(prop: any): string {
  return prop?.rich_text?.map((item: any) => item?.plain_text ?? '').join('') ?? '';
}

function fromMultiSelect(prop: any): string[] {
  return prop?.multi_select?.map((item: any) => item?.name).filter(Boolean) ?? [];
}

function fromSelect(prop: any): string | undefined {
  return prop?.select?.name;
}

function fromRelation(prop: any): string | undefined {
  return prop?.relation?.[0]?.id;
}

function buildSessionKey(input: SessionInput): string {
  if (input.sessionKey) {
    return input.sessionKey;
  }

  return input.title.trim().toLowerCase().replace(/\s+/g, '-');
}

export function mapSessionInputToNotionProperties(input: SessionInput): NotionProperties {
  const properties: NotionProperties = {
    [sessionsDatabaseSchema.title.name]: toTitle(input.title),
    [sessionsDatabaseSchema.sessionKey.name]: toRichText(buildSessionKey(input)),
    [sessionsDatabaseSchema.goal.name]: toRichText(input.goal),
    [sessionsDatabaseSchema.summary.name]: toRichText(input.summary),
    [sessionsDatabaseSchema.decisions.name]: toRichText((input.decisions ?? []).join('\n')),
    [sessionsDatabaseSchema.nextSteps.name]: toRichText((input.nextSteps ?? []).join('\n')),
    [sessionsDatabaseSchema.tags.name]: toMultiSelect(input.tags),
    [sessionsDatabaseSchema.project.name]: toRichText(input.project),
    [sessionsDatabaseSchema.source.name]: toSelect(input.source),
  };

  if (input.status) {
    properties[sessionsDatabaseSchema.status.name] = toSelect(input.status);
  }

  return properties;
}

export function mapIdeaInputToNotionProperties(input: IdeaInput): NotionProperties {
  return {
    [ideasDatabaseSchema.title.name]: toTitle(input.title),
    [ideasDatabaseSchema.description.name]: toRichText(input.description),
    [ideasDatabaseSchema.tags.name]: toMultiSelect(input.tags),
    [ideasDatabaseSchema.project.name]: toRichText(input.project),
    [ideasDatabaseSchema.sessionRelation.name]: toRelation(input.sessionId),
  };
}

export function mapNotionPageToSessionRecord(page: any): SessionRecord {
  const props = page.properties ?? {};
  return {
    id: page.id,
    sessionKey: fromRichText(props[sessionsDatabaseSchema.sessionKey.name]),
    title: fromTitle(props[sessionsDatabaseSchema.title.name]),
    goal: fromRichText(props[sessionsDatabaseSchema.goal.name]) || undefined,
    status: fromSelect(props[sessionsDatabaseSchema.status.name]),
    summary: fromRichText(props[sessionsDatabaseSchema.summary.name]),
    decisions: fromRichText(props[sessionsDatabaseSchema.decisions.name])
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
    nextSteps: fromRichText(props[sessionsDatabaseSchema.nextSteps.name])
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
    tags: fromMultiSelect(props[sessionsDatabaseSchema.tags.name]),
    project: fromRichText(props[sessionsDatabaseSchema.project.name]) || undefined,
    source: fromSelect(props[sessionsDatabaseSchema.source.name]) as SessionRecord['source'],
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
    url: page.url,
  };
}

export function mapNotionPageToIdeaRecord(page: any): IdeaRecord {
  const props = page.properties ?? {};
  return {
    id: page.id,
    title: fromTitle(props[ideasDatabaseSchema.title.name]),
    description: fromRichText(props[ideasDatabaseSchema.description.name]),
    tags: fromMultiSelect(props[ideasDatabaseSchema.tags.name]),
    project: fromRichText(props[ideasDatabaseSchema.project.name]) || undefined,
    sessionId: fromRelation(props[ideasDatabaseSchema.sessionRelation.name]),
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
    url: page.url,
  };
}
