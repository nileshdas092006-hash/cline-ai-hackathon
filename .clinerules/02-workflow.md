# How Cline and Claude share this project

Two agents work on this folder. **Claude** (in Claude Desktop) is the architect and reviewer: it reads the problem statement, writes task specs and reviews. **Cline** is the builder: Cline writes all code.

## At the start of every task
1. Read every file in `memory-bank/` and `tasks/NEXT.md` (and `docs/` when the task refers to it).
2. If the task says Plan, produce a plan only. Otherwise implement.

## While working
- Stay inside the scope of `tasks/NEXT.md`. If something outside it is needed, write it in `tasks/LOG.md` under "Requests for Claude" instead of doing it.
- Run `npm test` before you finish. Do not finish with failing tests unless you explain why in the log.
- This is Windows. Use npm scripts and cross-platform Node code; no bash-only commands.

## At the end of every task
1. Append to `tasks/LOG.md`: task id, files changed, test result (pass/fail counts), open issues, requests for Claude.
2. Update `memory-bank/activeContext.md` and `memory-bank/progress.md`.
3. Commit: `git add -A` then `git commit -m "<task id>: <summary>"`.
4. Do NOT edit `tasks/NEXT.md`, `tasks/backlog/` or `docs/PS.md` — Claude and the user own them.

## Never touch
`.cline-runs/` (run logs; evidence of Cline's work), `../cline-mcp/`, `../setup/`.
