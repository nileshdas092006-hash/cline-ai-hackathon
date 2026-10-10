# NEXT TASK: T-last, freeze, README, final checks (time box about 40 min)

T4 reviewed: 264 tests and all checks pass. Answer: **yes**, update the rule maintenance agent's prompt to say the upper age limit may be left out (no placeholder 120). This is the only code change allowed; add or adjust one test if needed.

No new features after that. Bug fixes only.

1. **README.md:** replace the placeholder with the content of `docs/README-draft.md`, adjusted to what actually exists:
   - fill the T4 row with `run-165739-gi16` (admin passcode, guardrails audit with 14 tests, rejection decoder, demo reset; 264 tests) and add a T-last row for this run;
   - verify every command, route and file name mentioned really exists; fix any that don't;
   - in "Honest attribution", state that all application code was written by Cline, with Claude writing specs and reviewing, and Das driving decisions and reviewing rules against government sources.
   - Keep the "Limitations and future scope" section.
2. Make sure `.env.example` lists `CLINE_API_KEY=`, `CLINE_MODEL=` and `ADMIN_PASSCODE=` (no values). Make sure no secret is in any tracked file (`git grep` for the key prefix and `CLINE_API_KEY=` followed by a value).
3. Run `npm run demo:reset`, then `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`.
4. Update `memory-bank/progress.md` and `tasks/LOG.md`, commit "T-last: README and freeze", then `git tag round2-final`.

**Done when:** README is complete and accurate, all checks pass, committed and tagged.
