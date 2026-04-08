# Skill Registry

Generated: 2026-04-07
Project: session-vault

## Sources Scanned
- User-level: `~/.claude/skills`, `~/.config/opencode/skills`, `~/.gemini/skills`, `~/.agents/skills`
- User-level (not found): `~/.cursor/skills`, `~/.copilot/skills`
- Project-level: `.claude/skills`, `.gemini/skills`, `.agent/skills`, `skills` (none found)

Deduplication rule: project-level overrides user-level. No project-level skills were found.

## Project Conventions Files
No convention files found in project root:
- `agents.md`
- `AGENTS.md`
- `CLAUDE.md`
- `.cursorrules`
- `GEMINI.md`
- `copilot-instructions.md`

## Registered Skills

| Skill | Source | Trigger (summary) |
|---|---|---|
| analytics-tracking | `~/.agents/skills` | Tracking setup/audit, GA4/GTM/events/conversions attribution |
| branch-pr | `~/.config/opencode/skills` | Creating/opening pull requests |
| find-skills | `~/.agents/skills` | User asks to find/install capabilities as skills |
| frontend-design | `~/.agents/skills` | Build/style frontend UI, pages, components |
| go-testing | `~/.config/opencode/skills` | Go tests, Bubbletea testing, coverage |
| issue-creation | `~/.config/opencode/skills` | Create GitHub issues (bug/feature) |
| judgment-day | `~/.config/opencode/skills` | User asks dual/adversarial review ("judgment day") |
| next-best-practices | `~/.agents/skills` | Next.js architecture/pattern guidance |
| prisma-database-setup | `~/.agents/skills` | Prisma provider setup/migration troubleshooting |
| seo-audit | `~/.agents/skills` | SEO diagnostics/audit/ranking/indexing issues |
| shadcn | `~/.agents/skills` | shadcn/ui component/project operations |
| skill-creator | `~/.config/opencode/skills` | Create new AI agent skills |
| vercel-react-best-practices | `~/.agents/skills` | React/Next performance and optimization patterns |
| webapp-testing | `~/.agents/skills` | Playwright-based local webapp testing |

## Compact Rules (auto-resolution hints)
- If task mentions **PR/open review branch** → load `branch-pr`
- If task mentions **issue/bug report/feature request issue** → load `issue-creation`
- If task mentions **Go tests/Bubbletea/teatest** → load `go-testing`
- If task mentions **create a skill/agent instructions** → load `skill-creator`
- If task mentions **judgment day/dual review/adversarial review** → load `judgment-day`
- If task mentions **tracking/GA4/GTM/events/conversion measurement** → load `analytics-tracking`
- If task mentions **SEO audit/ranking/indexing/crawl issues** → load `seo-audit`
- If task mentions **shadcn/ui components or presets** → load `shadcn`
- If task mentions **React/Next optimization/performance** → load `vercel-react-best-practices`
- If task mentions **Next.js best practices/app router conventions** → load `next-best-practices`
- If task mentions **Prisma database provider setup** → load `prisma-database-setup`
- If task mentions **frontend UI construction/styling** → load `frontend-design`
- If task mentions **test local webapp with browser automation** → load `webapp-testing`
- If user asks for **discovering installable skills** → load `find-skills`
