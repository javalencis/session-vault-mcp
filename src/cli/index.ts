import { Command } from 'commander';

import { runDoctorCommand } from './doctor.js';
import { runInitCommand } from './init.js';
import { runSetupNotionCommand } from './setup-notion.js';

export const program = new Command()
  .name('session-vault')
  .description('Capture and query coding sessions in Notion via CLI and MCP')
  .version('0.1.1');

program
  .command('init')
  .description('Run interactive setup wizard')
  .action(async () => {
    await runInitCommand();
  });

program
  .command('doctor')
  .description('Run health checks for config and Notion access')
  .action(async () => {
    const ok = await runDoctorCommand();
    if (!ok) {
      process.exitCode = 1;
    }
  });

program
  .command('setup-notion')
  .description('Create Session Vault Notion databases under a parent page')
  .option('-p, --parent-page-id <pageId>', 'Parent page ID where databases will be created')
  .action(async (options: { parentPageId?: string }) => {
    await runSetupNotionCommand(options.parentPageId);
  });
