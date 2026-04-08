import { confirm, select } from '@inquirer/prompts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

type JsonObject = Record<string, unknown>;

const SESSION_VAULT_MCP = {
  type: 'local',
  command: ['npx', '-y', 'session-vault-serve'],
  enabled: true,
} as const;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getGlobalOpenCodeConfigPath(): string {
  return join(homedir(), '.config', 'opencode', 'opencode.json');
}

export async function patchOpenCodeConfig(projectPath: string): Promise<void> {
  const projectConfigPath = join(projectPath, 'opencode.json');
  const globalConfigPath = getGlobalOpenCodeConfigPath();

  const hasProjectConfig = existsSync(projectConfigPath);
  const hasGlobalConfig = existsSync(globalConfigPath);

  let configPath: string;

  if (hasProjectConfig && hasGlobalConfig) {
    const choice = await select({
      message: 'Found OpenCode config in both project and global. Which one should I update?',
      choices: [
        { name: `Global (${globalConfigPath})`, value: 'global' },
        { name: `Project (${projectConfigPath})`, value: 'project' },
      ],
      default: 'global',
    });
    configPath = choice === 'global' ? globalConfigPath : projectConfigPath;
  } else if (hasGlobalConfig) {
    configPath = globalConfigPath;
    console.log(`ℹ️  Found global OpenCode config: ${globalConfigPath}`);
  } else if (hasProjectConfig) {
    configPath = projectConfigPath;
  } else {
    const createConfig = await confirm({
      message: 'No opencode.json found (project or global). Create one in this project?',
      default: true,
    });

    if (!createConfig) {
      console.log('ℹ️  Skipped OpenCode integration.');
      return;
    }
    configPath = projectConfigPath;
  }

  const configExists = existsSync(configPath);
  let parsed: JsonObject = {};

  if (configExists) {
    const raw = readFileSync(configPath, 'utf-8');
    const json = JSON.parse(raw) as unknown;
    if (!isJsonObject(json)) {
      throw new Error(`${configPath} must contain a JSON object at the top level.`);
    }
    parsed = json;
  }

  const previousMcp = isJsonObject(parsed.mcp) ? parsed.mcp : {};
  const previousEntry = previousMcp['session-vault'];

  const nextMcp: JsonObject = {
    ...previousMcp,
    'session-vault': SESSION_VAULT_MCP,
  };

  const merged: JsonObject = {
    ...parsed,
    mcp: nextMcp,
  };

  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf-8');

  if (!configExists) {
    console.log(`✅ Created ${configPath} with session-vault MCP entry.`);
    return;
  }

  if (JSON.stringify(previousEntry) === JSON.stringify(SESSION_VAULT_MCP)) {
    console.log('ℹ️  OpenCode MCP entry already configured for session-vault.');
    return;
  }

  console.log(`✅ Updated ${configPath} with session-vault MCP entry.`);
}
