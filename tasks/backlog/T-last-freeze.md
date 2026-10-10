# T-last — Freeze, red-team, demo (last 75 minutes)

1. No new features. Fix bugs only.
2. `README.md`: the problem (3 lines), the solution, how to run, an architecture sketch, and **"How we used Cline"**: Plan/Act, .clinerules, Memory Bank, checkpoints, Cline CLI runs driven from Claude (logs in `.cline-runs/`), and the Cline SDK agent inside the product.
3. `npm run demo:reset` — resets and seeds demo data.
4. Final `npm test` + `npm run build`, commit, `git tag round2-final`.
