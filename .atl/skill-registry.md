# Skill Registry

Generated: 2026-04-12
Project: session-vault

## Sources Scanned
- User-level: `~/.claude/skills`, `~/.config/opencode/skills`, `~/.gemini/skills`, `~/.agents/skills`
- User-level (not found): `~/.cursor/skills`, `~/.copilot/skills`
- Project-level: `.claude/skills`, `.gemini/skills`, `.agent/skills`, `skills` (none found)

Deduplication rule: project-level overrides user-level. No project-level overrides detected.

## Project Convention Files
None found in repository root:
- `agents.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `GEMINI.md`, `copilot-instructions.md`

## Registered Skills

| Skill | Source | Trigger (summary) |
|---|---|---|
| analytics-tracking | `~/.agents/skills` | Tracking setup/audit for GA4, GTM, events, conversions |
| branch-pr | `~/.config/opencode/skills` | Create/open pull requests |
| find-skills | `~/.agents/skills` | Discover/install capabilities as skills |
| frontend-design | `~/.agents/skills` | Build/style frontend UI, pages, and components |
| go-testing | `~/.config/opencode/skills` | Go tests, Bubbletea, teatest coverage |
| issue-creation | `~/.config/opencode/skills` | Create GitHub issues (bug/feature) |
| judgment-day | `~/.config/opencode/skills` | Dual/adversarial review workflow |
| next-best-practices | `~/.agents/skills` | Next.js architecture and conventions |
| prisma-database-setup | `~/.agents/skills` | Prisma provider setup/migration troubleshooting |
| seo-audit | `~/.agents/skills` | SEO diagnostics, ranking/indexing/crawl audits |
| shadcn | `~/.agents/skills` | shadcn/ui components/project operations |
| skill-creator | `~/.config/opencode/skills` | Create and document new AI agent skills |
| vercel-react-best-practices | `~/.agents/skills` | React/Next performance optimization patterns |
| webapp-testing | `~/.agents/skills` | Playwright-based local webapp testing |

## Auto-Resolution Hints
- PR flow → `branch-pr`
- Issue creation/reporting → `issue-creation`
- Go testing/Bubbletea → `go-testing`
- New skill authoring → `skill-creator`
- Adversarial review / “judgment day” → `judgment-day`
- Tracking/measurement setup → `analytics-tracking`
- SEO audit/ranking/indexing issues → `seo-audit`
- shadcn/ui work → `shadcn`
- React/Next performance work → `vercel-react-best-practices`
- Next.js best-practices review → `next-best-practices`
- Prisma DB setup/migration → `prisma-database-setup`
- Frontend UI design/build → `frontend-design`
- Browser-driven local app testing → `webapp-testing`
- Skill discovery requests → `find-skills`
