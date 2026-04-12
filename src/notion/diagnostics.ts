export type NotionValidationCategory = 'missing-key' | 'auth-permission' | 'transport' | 'unknown';

export type NotionValidationTarget = 'api-key' | 'sessions-db' | 'ideas-db';

export type NotionDiagnostic = {
  category: NotionValidationCategory;
  code: string;
  summary: string;
  detail?: string;
  troubleshooting: string[];
};

export type NotionValidationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      diagnostic: NotionDiagnostic;
    };

type ValidationTargetMeta = {
  envVar: 'NOTION_API_KEY' | 'NOTION_SESSIONS_DB_ID' | 'NOTION_IDEAS_DB_ID';
  label: string;
};

const TARGET_META: Record<NotionValidationTarget, ValidationTargetMeta> = {
  'api-key': {
    envVar: 'NOTION_API_KEY',
    label: 'Notion API key',
  },
  'sessions-db': {
    envVar: 'NOTION_SESSIONS_DB_ID',
    label: 'Sessions database',
  },
  'ideas-db': {
    envVar: 'NOTION_IDEAS_DB_ID',
    label: 'Ideas database',
  },
};

const AUTH_PERMISSION_CODES = new Set(['unauthorized', 'restricted_resource', 'object_not_found']);

const TRANSPORT_MARKERS = [
  'fetch failed',
  'network',
  'timeout',
  'timed out',
  'dns',
  'tls',
  'socket',
  'econnreset',
  'econnrefused',
  'enotfound',
  'eai_again',
];

function missingKeyTroubleshooting(envVar: ValidationTargetMeta['envVar']): string[] {
  return [
    `Set ${envVar} in your shell environment or ~/.config/session-vault/config.json.`,
    'Run session-vault doctor after updating environment variables.',
  ];
}

const TRANSPORT_TROUBLESHOOTING = [
  'Verify network access, VPN/proxy settings, and TLS interception rules.',
  'If using Node <22.21.0, upgrade Node and retry.',
  'Run session-vault doctor to re-check connectivity diagnostics.',
];

function asTrimmedOrUndefined(value?: string): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number') {
    return status;
  }

  return undefined;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown Notion error';
}

function formatMissingKeyDiagnostic(target: NotionValidationTarget): NotionDiagnostic {
  const { envVar } = TARGET_META[target];

  return {
    category: 'missing-key',
    code: `notion.missing_key.${envVar}`,
    summary: `Missing required environment variable: ${envVar}.`,
    troubleshooting: missingKeyTroubleshooting(envVar),
  };
}

function formatAuthPermissionDiagnostic(target: NotionValidationTarget, error: unknown): NotionDiagnostic {
  const { label } = TARGET_META[target];
  const code = getErrorCode(error) ?? 'forbidden';

  return {
    category: 'auth-permission',
    code: `notion.auth_permission.${code}`,
    summary: `Notion rejected access for ${label.toLowerCase()}.`,
    detail: getErrorMessage(error),
    troubleshooting: [
      'Verify your Notion integration token has access to the target workspace/page.',
      'Ensure the page or databases are shared with the integration.',
      'Run session-vault doctor after updating permissions.',
    ],
  };
}

function formatTransportDiagnostic(error: unknown): NotionDiagnostic {
  return {
    category: 'transport',
    code: 'notion.transport.fetch_failed',
    summary: 'Notion request failed due to network or transport issues.',
    detail: getErrorMessage(error),
    troubleshooting: [...TRANSPORT_TROUBLESHOOTING],
  };
}

function formatUnknownDiagnostic(error: unknown): NotionDiagnostic {
  return {
    category: 'unknown',
    code: 'notion.unknown',
    summary: 'Notion validation failed with an unexpected error.',
    detail: getErrorMessage(error),
    troubleshooting: ['Run session-vault doctor to re-check diagnostics and inspect details.'],
  };
}

function isTransportError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const code = (getErrorCode(error) ?? '').toLowerCase();

  return TRANSPORT_MARKERS.some((marker) => message.includes(marker) || code.includes(marker));
}

function classifyNotionError(target: NotionValidationTarget, error: unknown): NotionDiagnostic {
  const status = getErrorStatus(error);
  const code = getErrorCode(error);

  if (status === 401 || status === 403 || (code && AUTH_PERMISSION_CODES.has(code))) {
    return formatAuthPermissionDiagnostic(target, error);
  }

  if (isTransportError(error)) {
    return formatTransportDiagnostic(error);
  }

  return formatUnknownDiagnostic(error);
}

type RunNotionValidationInput = {
  target: NotionValidationTarget;
  requiredValue?: string;
  operation: () => Promise<unknown>;
};

export async function runNotionValidation(input: RunNotionValidationInput): Promise<NotionValidationResult> {
  if (!asTrimmedOrUndefined(input.requiredValue)) {
    return {
      ok: false,
      diagnostic: formatMissingKeyDiagnostic(input.target),
    };
  }

  try {
    await input.operation();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      diagnostic: classifyNotionError(input.target, error),
    };
  }
}
