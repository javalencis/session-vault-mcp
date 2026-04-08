import { pathToFileURL } from 'node:url';

import { program } from './cli/index.js';

export async function runCli(argv: string[] = process.argv): Promise<void> {
  await program.parseAsync(argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
