import { pathToFileURL } from 'node:url';

export async function runServer(): Promise<void> {
  // Phase 1 placeholder; MCP bootstrap lands in Phase 3.
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runServer();
}
